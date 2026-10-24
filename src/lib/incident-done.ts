import type { IncidentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatCairo, saturdayDeadline } from "@/lib/datetime";
import { subGroupStudentIds } from "@/lib/roster";
import { loadPaperOwners, papersOf } from "@/lib/paper-owners";
import { quizPrepComplete } from "@/lib/quiz";
import type { OperationConfig } from "@/lib/config";

// When was the task behind a late incident finally done? Computed from the task's own
// records (nothing is stamped on the incident): null = still not done.
//   attendance        -> first attendance row logged for the session
//   parent_update     -> ParentUpdateLog.sentAt;  classroom_upload -> ClassroomUploadLog.uploadedAt
//   hw_correction     -> last first-entry of the assistant's sub-group, once ALL are reviewed
//   grade_entry       -> last grade of the assistant's papers on the week's assessments, once all graded
//   quiz_prep / quiz_announcement -> QuizPrep.completedAt / announcedAt
//   monthly_report    -> last report sent, once every reachable sub-group parent got one
// Sub-groups / paper owners are as of now, like the assistant's own task pages.

export type IncidentRef = {
  id: string;
  assistantId: string;
  sessionId: string | null;
  homeworkId: string | null;
  quizPrepId: string | null;
  type: IncidentType;
  deadline: Date;
};

export type IncidentDone = { doneAt: Date | null; note?: string };

const DAY = 86_400_000;
const maxDate = (ds: Date[]) => (ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : null);

export async function incidentDoneTimes(
  incidents: IncidentRef[],
  operationId: string,
  cfg: OperationConfig,
  now: Date = new Date(),
): Promise<Map<string, IncidentDone>> {
  const out = new Map<string, IncidentDone>();
  const of = (t: IncidentType) => incidents.filter((i) => i.type === t);
  const ids = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))];

  // Daily session tasks.
  const sessionIds = ids(of("attendance").map((i) => i.sessionId));
  const parentIds = ids(of("parent_update").map((i) => i.sessionId));
  const uploadIds = ids(of("classroom_upload").map((i) => i.sessionId));
  const quizIds = ids([...of("quiz_prep"), ...of("quiz_announcement")].map((i) => i.quizPrepId));
  const [att, parent, upload, quizzes] = await Promise.all([
    sessionIds.length
      ? prisma.attendance.groupBy({ by: ["sessionId"], where: { sessionId: { in: sessionIds } }, _min: { loggedAt: true } })
      : [],
    parentIds.length ? prisma.parentUpdateLog.findMany({ where: { sessionId: { in: parentIds } }, select: { sessionId: true, sentAt: true } }) : [],
    uploadIds.length ? prisma.classroomUploadLog.findMany({ where: { sessionId: { in: uploadIds } }, select: { sessionId: true, uploadedAt: true } }) : [],
    quizIds.length
      ? prisma.quizPrep.findMany({
          where: { id: { in: quizIds } },
          select: { id: true, quizCreated: true, sentToPrint: true, completedAt: true, announcedAt: true },
        })
      : [],
  ]);
  const attAt = new Map(att.map((a) => [a.sessionId, a._min.loggedAt]));
  const parentAt = new Map(parent.map((p) => [p.sessionId, p.sentAt]));
  const uploadAt = new Map(upload.map((u) => [u.sessionId, u.uploadedAt]));
  const quizRow = new Map(quizzes.map((q) => [q.id, q]));
  for (const i of of("attendance")) out.set(i.id, { doneAt: (i.sessionId && attAt.get(i.sessionId)) || null });
  for (const i of of("parent_update")) out.set(i.id, { doneAt: (i.sessionId && parentAt.get(i.sessionId)) || null });
  for (const i of of("classroom_upload")) out.set(i.id, { doneAt: (i.sessionId && uploadAt.get(i.sessionId)) || null });
  for (const i of of("quiz_prep")) {
    const q = i.quizPrepId ? quizRow.get(i.quizPrepId) : undefined;
    out.set(i.id, { doneAt: q && quizPrepComplete(q) ? q.completedAt : null });
  }
  for (const i of of("quiz_announcement")) {
    out.set(i.id, { doneAt: (i.quizPrepId && quizRow.get(i.quizPrepId)?.announcedAt) || null });
  }

  // HW correction: session-linked HW is found by its session, standalone HW by its own id.
  const hwIncidents = of("hw_correction");
  if (hwIncidents.length) {
    const hws = await prisma.homeworkAssignment.findMany({
      where: {
        OR: [
          { sessionId: { in: ids(hwIncidents.map((i) => i.sessionId)) } },
          { id: { in: ids(hwIncidents.map((i) => i.homeworkId)) } },
        ],
      },
      select: { id: true, classId: true, sessionId: true, submissions: { select: { studentId: true, loggedAt: true } } },
    });
    for (const i of hwIncidents) {
      const hw = hws.find((h) => (i.homeworkId ? h.id === i.homeworkId : h.sessionId === i.sessionId));
      if (!hw) {
        out.set(i.id, { doneAt: null });
        continue;
      }
      const sub = await subGroupStudentIds(hw.classId, i.assistantId, now);
      const at = new Map(hw.submissions.map((s) => [s.studentId, s.loggedAt]));
      const done = sub.length > 0 && sub.every((id) => at.has(id));
      out.set(i.id, { doneAt: done ? maxDate(sub.map((id) => at.get(id)!)) : null });
    }
  }

  // Grade entry has no link to its assessment: it's every assessment of the assistant's
  // classes whose correction deadline is this incident's deadline.
  const gradeIncidents = of("grade_entry");
  if (gradeIncidents.length) {
    const times = gradeIncidents.map((i) => i.deadline.getTime());
    const candidates = await prisma.assessment.findMany({
      where: {
        class: {
          operationId,
          assignments: { some: { assistantId: { in: ids(gradeIncidents.map((i) => i.assistantId)) } } },
        },
        date: { gte: new Date(Math.min(...times) - 15 * DAY), lte: new Date(Math.max(...times)) },
      },
      select: {
        id: true,
        label: true,
        date: true,
        class: { select: { name: true, assignments: { select: { assistantId: true } } } },
        grades: { select: { studentId: true, loggedAt: true } },
      },
    });
    const papers = await loadPaperOwners(candidates.map((a) => a.id), now);
    for (const i of gradeIncidents) {
      const mine = candidates.filter(
        (a) =>
          saturdayDeadline(a.date, cfg).getTime() === i.deadline.getTime() &&
          a.class.assignments.some((x) => x.assistantId === i.assistantId),
      );
      let done = mine.length > 0;
      const stamps: Date[] = [];
      for (const a of mine) {
        const p = papers.get(a.id);
        const at = new Map(a.grades.map((g) => [g.studentId, g.loggedAt]));
        for (const sid of p ? papersOf(p.owners, i.assistantId) : []) {
          const t = at.get(sid);
          if (t) stamps.push(t);
          else done = false;
        }
      }
      const note = mine.map((a) => `${a.label} · ${a.class.name}`).join(", ") || undefined;
      out.set(i.id, { doneAt: done ? maxDate(stamps) : null, note });
    }
  }

  // Monthly reports: one incident covers every class the assistant is on that month.
  const monthly = of("monthly_report");
  for (const i of monthly) {
    const year = Number(formatCairo(i.deadline, "yyyy"));
    const month = Number(formatCairo(i.deadline, "M"));
    const classes = await prisma.classAssignment.findMany({
      where: { assistantId: i.assistantId, class: { operationId, active: true } },
      select: { classId: true },
      distinct: ["classId"],
    });
    let done = true;
    const stamps: Date[] = [];
    for (const { classId } of classes) {
      const sub = await subGroupStudentIds(classId, i.assistantId, now);
      const students = await prisma.student.findMany({
        where: { id: { in: sub }, parentPhone: { not: null } },
        select: { parentPhone: true, reportLogs: { where: { year, month }, select: { sentAt: true } } },
      });
      for (const s of students.filter((s) => s.parentPhone?.trim())) {
        if (s.reportLogs[0]) stamps.push(s.reportLogs[0].sentAt);
        else done = false;
      }
    }
    out.set(i.id, { doneAt: done && stamps.length ? maxDate(stamps) : null });
  }

  return out;
}

// "1 min" / "3h" / "2 days" — how far past the deadline something is.
export function lateBy(deadline: Date, at: Date): string {
  const mins = Math.max(1, Math.round((at.getTime() - deadline.getTime()) / 60_000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
