import { formatInTimeZone } from "date-fns-tz";
import type { IncidentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CAIRO_TZ, sessionDeadline, saturdayDeadline, quizPrepDeadline, quizAnnounceDeadline, latenessApplies } from "@/lib/datetime";
import { scheduledQuizDatesBetween, effectiveQuizDate, quizPrepComplete, quizAnnounced, addDays } from "@/lib/quiz";
import { subGroupStudentIds, activeAt } from "@/lib/roster";
import { OPERATION_DEFAULTS, operationConfig, type OperationConfig } from "@/lib/config";
import { loadAllVacations, isSchoolOnVacation, type VacationSpan } from "@/lib/vacations";
import { hasLms } from "@/lib/lms";

type VacMap = Map<string, VacationSpan[]>;

// Skip a session/item during its school's vacation — the school isn't running, so
// nothing is "missed" (no fine, and the assistant's record stays clean).
function onVacation(vacs: VacMap, operationId: string, schoolId: string, date: Date): boolean {
  return isSchoolOnVacation(schoolId, date, vacs.get(operationId) ?? []);
}

type Queued = {
  assistantId: string;
  sessionId: string | null;
  homeworkId: string | null;
  quizPrepId?: string | null;
  type: IncidentType;
  deadline: Date;
  operationId: string;
};

// Deadline timing + deduction are per-operation. The cron spans every operation, so
// load all configs once and look up by operationId (no per-row DB hit).
type CfgMap = Map<string, OperationConfig>;

async function loadConfigs(): Promise<CfgMap> {
  const ops = await prisma.operation.findMany();
  return new Map(ops.map((o) => [o.id, operationConfig(o)]));
}

function cfgFor(cfgs: CfgMap, operationId: string): OperationConfig {
  return cfgs.get(operationId) ?? OPERATION_DEFAULTS;
}

// The Cairo calendar day of `now`, as a UTC-midnight Date (matches @db.Date storage).
function cairoDate(now: Date): Date {
  return new Date(`${formatInTimeZone(now, CAIRO_TZ, "yyyy-MM-dd")}T00:00:00.000Z`);
}

function key(q: {
  assistantId: string;
  sessionId: string | null;
  homeworkId?: string | null;
  quizPrepId?: string | null;
  type: string;
  deadline: Date;
}): string {
  return `${q.assistantId}|${q.sessionId ?? ""}|${q.homeworkId ?? ""}|${q.quizPrepId ?? ""}|${q.type}|${q.deadline.getTime()}`;
}

export type DetectResult = { created: number; checked: number };

// Daily run (9pm): one incident per active assistant per missed daily session task.
async function detectDaily(now: Date, cfgs: CfgMap, vacs: VacMap): Promise<Queued[]> {
  const today = cairoDate(now);

  const sessions = await prisma.classSession.findMany({
    where: { scheduledDate: today, dayOff: false },
    select: {
      id: true,
      createdAt: true,
      responsibleAssistantId: true,
      coveredById: true,
      class: { select: { operationId: true, schoolId: true, lmsType: true } },
      attendance: { select: { id: true }, take: 1 },
      parentUpdate: { select: { id: true } },
      classroomUpload: { select: { id: true } },
    },
  });

  const queued: Queued[] = [];
  for (const s of sessions) {
    // Daily tasks belong to ONE assistant: the coverer if covered, else the session owner.
    const assistantId = s.coveredById ?? s.responsibleAssistantId;
    if (!assistantId) continue; // unassigned day -> nobody to charge
    const operationId = s.class.operationId;
    if (onVacation(vacs, operationId, s.class.schoolId, today)) continue; // school break -> not missed
    const deadline = sessionDeadline(today, cfgFor(cfgs, operationId));
    // A makeup session added after its deadline had already passed can't be "missed".
    if (!latenessApplies(s.createdAt, deadline)) continue;
    if (s.attendance.length === 0) queued.push({ assistantId, sessionId: s.id, homeworkId: null, type: "attendance", deadline, operationId });
    if (!s.parentUpdate) queued.push({ assistantId, sessionId: s.id, homeworkId: null, type: "parent_update", deadline, operationId });
    // Classes with no LMS have nothing to upload — never charge a late for it.
    if (hasLms(s.class.lmsType) && !s.classroomUpload)
      queued.push({ assistantId, sessionId: s.id, homeworkId: null, type: "classroom_upload", deadline, operationId });
  }
  return queued;
}

// Daily run: the biweekly quiz's SHARED sub-tasks — announcement (quizAnnounceLeadDays
// before) and prep = create + send to print (quizPrepLeadDays before) — each due at the
// daily deadline hour before the quiz's ACTUAL date. A cycle whose sub-task isn't done on
// time charges EVERY active assigned assistant (capped to one deduction per cycle in pay).
// Incidents dedupe by (assistant, quizPrepId, type, deadline).
async function detectQuiz(now: Date, cfgs: CfgMap, vacs: VacMap): Promise<Queued[]> {
  const today = cairoDate(now);

  const classes = await prisma.class.findMany({
    where: { active: true, quizStartDate: { not: null } },
    select: {
      id: true,
      createdAt: true,
      quizStartDate: true,
      operationId: true,
      schoolId: true,
      assignments: { where: activeAt(now), select: { assistantId: true } },
      quizPreps: {
        select: { id: true, scheduledDate: true, quizDate: true, quizCreated: true, sentToPrint: true, completedAt: true, announcedAt: true },
      },
    },
  });

  const queued: Queued[] = [];
  for (const c of classes) {
    if (!c.quizStartDate || c.assignments.length === 0) continue;
    const cfg = cfgFor(cfgs, c.operationId);
    const maxLead = Math.max(cfg.quizPrepLeadDays, cfg.quizAnnounceLeadDays);
    // Enumerate scheduled cycles whose deadlines could land today, wide enough to absorb
    // one-off date moves. Overrides live on the row (quizDate); others use the scheduled date.
    const scheduled = scheduledQuizDatesBetween(c.quizStartDate, addDays(today, -21), addDays(today, maxLead + 21));
    const rowBySched = new Map(c.quizPreps.map((r) => [r.scheduledDate.getTime(), r]));

    for (const sched of scheduled) {
      const row = rowBySched.get(sched.getTime());
      const actual = effectiveQuizDate(sched, row);
      if (onVacation(vacs, c.operationId, c.schoolId, actual)) continue; // no quiz that week

      // Need a QuizPrep id to key incidents; create a placeholder once, lazily.
      let quizPrepId = row?.id ?? null;
      const ensureId = async (): Promise<string> => {
        if (quizPrepId) return quizPrepId;
        const created = await prisma.quizPrep.upsert({
          where: { classId_scheduledDate: { classId: c.id, scheduledDate: sched } },
          update: {},
          create: { classId: c.id, scheduledDate: sched, quizDate: actual },
          select: { id: true },
        });
        quizPrepId = created.id;
        return quizPrepId;
      };

      // Queue the sub-task if today is its (Cairo) deadline day and it isn't done on time.
      const consider = async (type: "quiz_prep" | "quiz_announcement", lead: number, deadline: Date, doneOnTime: boolean) => {
        if (addDays(actual, -lead).getTime() !== today.getTime()) return;
        if (!latenessApplies(c.createdAt, deadline)) return; // class created after the deadline
        if (doneOnTime) return;
        const id = await ensureId();
        for (const { assistantId } of c.assignments) {
          queued.push({ assistantId, sessionId: null, homeworkId: null, quizPrepId: id, type, deadline, operationId: c.operationId });
        }
      };

      const prepDl = quizPrepDeadline(actual, cfg);
      const prepOk = quizPrepComplete(row) && row!.completedAt != null && row!.completedAt.getTime() <= prepDl.getTime();
      await consider("quiz_prep", cfg.quizPrepLeadDays, prepDl, prepOk);

      const annDl = quizAnnounceDeadline(actual, cfg);
      const annOk = quizAnnounced(row) && row!.announcedAt!.getTime() <= annDl.getTime();
      await consider("quiz_announcement", cfg.quizAnnounceLeadDays, annDl, annOk);
    }
  }
  return queued;
}

// Weekly run (Saturday 9pm): incident per assistant whose sub-group HW/grades aren't complete
// for items due this week (Sunday–Saturday).
async function detectWeekly(now: Date, cfgs: CfgMap, vacs: VacMap): Promise<Queued[]> {
  const weekEnd = cairoDate(now); // Saturday
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6); // Sunday

  const queued: Queued[] = [];

  const homeworks = await prisma.homeworkAssignment.findMany({
    where: { noHomework: false, deadline: { gte: weekStart, lte: weekEnd } },
    select: {
      id: true,
      classId: true,
      sessionId: true,
      deadline: true,
      submissions: { select: { studentId: true } },
      class: {
        select: {
          operationId: true,
          schoolId: true,
          assignments: { where: activeAt(now), select: { assistantId: true } },
        },
      },
    },
  });
  for (const hw of homeworks) {
    const operationId = hw.class.operationId;
    if (onVacation(vacs, operationId, hw.class.schoolId, hw.deadline)) continue; // school break
    const deadline = saturdayDeadline(hw.deadline, cfgFor(cfgs, operationId));
    const submitted = new Set(hw.submissions.map((s) => s.studentId));
    for (const { assistantId } of hw.class.assignments) {
      const subIds = await subGroupStudentIds(hw.classId, assistantId, now);
      if (subIds.length === 0) continue;
      const reviewed = subIds.filter((id) => submitted.has(id)).length;
      if (reviewed < subIds.length) {
        // Session-linked HW dedupes by sessionId (unchanged); standalone HW (no session)
        // dedupes by its own id so multiple in a week stay distinct + idempotent.
        queued.push({
          assistantId,
          sessionId: hw.sessionId,
          homeworkId: hw.sessionId ? null : hw.id,
          type: "hw_correction",
          deadline,
          operationId,
        });
      }
    }
  }

  const assessments = await prisma.assessment.findMany({
    where: { date: { gte: weekStart, lte: weekEnd } },
    select: {
      classId: true,
      date: true,
      grades: { select: { studentId: true } },
      class: {
        select: {
          operationId: true,
          schoolId: true,
          assignments: { where: activeAt(now), select: { assistantId: true } },
        },
      },
    },
  });
  for (const a of assessments) {
    const operationId = a.class.operationId;
    if (onVacation(vacs, operationId, a.class.schoolId, a.date)) continue; // school break
    const deadline = saturdayDeadline(a.date, cfgFor(cfgs, operationId));
    const graded = new Set(a.grades.map((g) => g.studentId));
    for (const { assistantId } of a.class.assignments) {
      const subIds = await subGroupStudentIds(a.classId, assistantId, now);
      if (subIds.length === 0) continue;
      const done = subIds.filter((id) => graded.has(id)).length;
      if (done < subIds.length) {
        queued.push({ assistantId, sessionId: null, homeworkId: null, type: "grade_entry", deadline, operationId });
      }
    }
  }
  return queued;
}

// Idempotent: never creates a second incident for the same (assistant, session, type, deadline).
export async function detectLateIncidents(now: Date, weekly: boolean): Promise<DetectResult> {
  const cfgs = await loadConfigs();
  const vacs = await loadAllVacations();
  const queued = weekly
    ? await detectWeekly(now, cfgs, vacs)
    : [...(await detectDaily(now, cfgs, vacs)), ...(await detectQuiz(now, cfgs, vacs))];
  if (queued.length === 0) return { created: 0, checked: 0 };

  const deadlines = [...new Set(queued.map((q) => q.deadline.getTime()))].map((t) => new Date(t));
  const existing = await prisma.lateIncident.findMany({
    where: { deadline: { in: deadlines } },
    select: { assistantId: true, sessionId: true, homeworkId: true, quizPrepId: true, type: true, deadline: true },
  });
  const seen = new Set(existing.map(key));

  const fresh: Queued[] = [];
  for (const q of queued) {
    const k = key(q);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push(q);
  }

  if (fresh.length > 0) {
    await prisma.lateIncident.createMany({
      data: fresh.map((q) => ({
        assistantId: q.assistantId,
        sessionId: q.sessionId,
        homeworkId: q.homeworkId,
        quizPrepId: q.quizPrepId ?? null,
        type: q.type,
        deadline: q.deadline,
        deductionAmount: cfgFor(cfgs, q.operationId).lateDeduction,
      })),
    });
  }
  return { created: fresh.length, checked: queued.length };
}
