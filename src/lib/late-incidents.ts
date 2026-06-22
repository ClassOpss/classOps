import { formatInTimeZone } from "date-fns-tz";
import type { IncidentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CAIRO_TZ, sessionDeadline, saturdayDeadline } from "@/lib/datetime";
import { subGroupStudentIds, activeAt } from "@/lib/roster";
import { OPERATION_DEFAULTS, operationConfig, type OperationConfig } from "@/lib/config";

type Queued = {
  assistantId: string;
  sessionId: string | null;
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

function key(q: { assistantId: string; sessionId: string | null; type: string; deadline: Date }): string {
  return `${q.assistantId}|${q.sessionId ?? ""}|${q.type}|${q.deadline.getTime()}`;
}

export type DetectResult = { created: number; checked: number };

// Daily run (9pm): one incident per active assistant per missed daily session task.
async function detectDaily(now: Date, cfgs: CfgMap): Promise<Queued[]> {
  const today = cairoDate(now);

  const sessions = await prisma.classSession.findMany({
    where: { scheduledDate: today, dayOff: false },
    select: {
      id: true,
      responsibleAssistantId: true,
      coveredById: true,
      class: { select: { operationId: true } },
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
    const deadline = sessionDeadline(today, cfgFor(cfgs, operationId));
    if (s.attendance.length === 0) queued.push({ assistantId, sessionId: s.id, type: "attendance", deadline, operationId });
    if (!s.parentUpdate) queued.push({ assistantId, sessionId: s.id, type: "parent_update", deadline, operationId });
    if (!s.classroomUpload) queued.push({ assistantId, sessionId: s.id, type: "classroom_upload", deadline, operationId });
  }
  return queued;
}

// Weekly run (Saturday 9pm): incident per assistant whose sub-group HW/grades aren't complete
// for items due this week (Sunday–Saturday).
async function detectWeekly(now: Date, cfgs: CfgMap): Promise<Queued[]> {
  const weekEnd = cairoDate(now); // Saturday
  const weekStart = new Date(weekEnd);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6); // Sunday

  const queued: Queued[] = [];

  const homeworks = await prisma.homeworkAssignment.findMany({
    where: { noHomework: false, deadline: { gte: weekStart, lte: weekEnd } },
    select: {
      classId: true,
      sessionId: true,
      deadline: true,
      submissions: { select: { studentId: true } },
      class: {
        select: {
          operationId: true,
          assignments: { where: activeAt(now), select: { assistantId: true } },
        },
      },
    },
  });
  for (const hw of homeworks) {
    const operationId = hw.class.operationId;
    const deadline = saturdayDeadline(hw.deadline, cfgFor(cfgs, operationId));
    const submitted = new Set(hw.submissions.map((s) => s.studentId));
    for (const { assistantId } of hw.class.assignments) {
      const subIds = await subGroupStudentIds(hw.classId, assistantId, now);
      if (subIds.length === 0) continue;
      const reviewed = subIds.filter((id) => submitted.has(id)).length;
      if (reviewed < subIds.length) {
        queued.push({ assistantId, sessionId: hw.sessionId, type: "hw_correction", deadline, operationId });
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
          assignments: { where: activeAt(now), select: { assistantId: true } },
        },
      },
    },
  });
  for (const a of assessments) {
    const operationId = a.class.operationId;
    const deadline = saturdayDeadline(a.date, cfgFor(cfgs, operationId));
    const graded = new Set(a.grades.map((g) => g.studentId));
    for (const { assistantId } of a.class.assignments) {
      const subIds = await subGroupStudentIds(a.classId, assistantId, now);
      if (subIds.length === 0) continue;
      const done = subIds.filter((id) => graded.has(id)).length;
      if (done < subIds.length) {
        queued.push({ assistantId, sessionId: null, type: "grade_entry", deadline, operationId });
      }
    }
  }
  return queued;
}

// Idempotent: never creates a second incident for the same (assistant, session, type, deadline).
export async function detectLateIncidents(now: Date, weekly: boolean): Promise<DetectResult> {
  const cfgs = await loadConfigs();
  const queued = weekly ? await detectWeekly(now, cfgs) : await detectDaily(now, cfgs);
  if (queued.length === 0) return { created: 0, checked: 0 };

  const deadlines = [...new Set(queued.map((q) => q.deadline.getTime()))].map((t) => new Date(t));
  const existing = await prisma.lateIncident.findMany({
    where: { deadline: { in: deadlines } },
    select: { assistantId: true, sessionId: true, type: true, deadline: true },
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
        type: q.type,
        deadline: q.deadline,
        deductionAmount: cfgFor(cfgs, q.operationId).lateDeduction,
      })),
    });
  }
  return { created: fresh.length, checked: queued.length };
}
