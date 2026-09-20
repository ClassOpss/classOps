import Link from "next/link";
import { requireRole, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { hasLms } from "@/lib/lms";
import { resolveConfig } from "@/lib/operation";
import { cairoToday, quizPrepDeadline, quizAnnounceDeadline, formatCairo } from "@/lib/datetime";
import { scheduledQuizDatesBetween, effectiveQuizDate, quizPrepComplete, quizAnnounced, addDays } from "@/lib/quiz";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export default async function MyTasksPage() {
  await requireRole("assistant", "admin");
  const user = await requireUser();

  if (!user.assistantId) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="page-title">Tasks</h1>
        <p className="text-sm text-muted">No assistant profile on this account.</p>
      </div>
    );
  }

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 21);

  const assignments = await prisma.classAssignment.findMany({
    where: {
      assistantId: user.assistantId,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      // Skip deactivated classes (per class, so only the deactivated one drops).
      class: { active: true },
    },
    select: { classId: true },
  });
  const classIds = assignments.map((a) => a.classId);

  // Recent, started, owned (or unowned/covered) sessions that are missing a daily task.
  const sessions =
    classIds.length === 0
      ? []
      : await prisma.classSession.findMany({
          where: {
            classId: { in: classIds },
            dayOff: false,
            scheduledDate: { gte: from, lte: now },
            OR: [
              { responsibleAssistantId: user.assistantId },
              { responsibleAssistantId: null },
              { coveredById: user.assistantId },
            ],
          },
          orderBy: { scheduledDate: "desc" },
          select: {
            id: true,
            classId: true,
            scheduledDate: true,
            class: { select: { name: true, lmsType: true } },
            attendance: { select: { id: true }, take: 1 },
            parentUpdate: { select: { id: true } },
            classroomUpload: { select: { id: true } },
          },
        });

  const todos = sessions
    .map((s) => {
      const missing: string[] = [];
      if (s.attendance.length === 0) missing.push("Attendance");
      if (!s.parentUpdate) missing.push("Parent update");
      if (hasLms(s.class.lmsType) && !s.classroomUpload) missing.push("Classroom");
      return { s, missing };
    })
    .filter((t) => t.missing.length > 0);

  // Quiz-prep tasks: for each quiz-enabled class, any biweekly cycle that isn't complete
  // and whose prep deadline is either overdue (last 21 days) or coming up within a week.
  const quizClasses =
    classIds.length === 0
      ? []
      : await prisma.class.findMany({
          where: { id: { in: classIds }, quizStartDate: { not: null } },
          select: {
            id: true,
            name: true,
            quizStartDate: true,
            quizPreps: {
              select: { scheduledDate: true, quizDate: true, quizCreated: true, sentToPrint: true, announcedAt: true },
            },
          },
        });
  const cfg = await resolveConfig();
  const today = cairoToday(now);
  const soon = now.getTime() + 7 * 86_400_000;
  const recent = now.getTime() - 21 * 86_400_000;

  const quizTodos: { classId: string; className: string; kind: string; quizDate: Date; deadline: Date; overdue: boolean }[] = [];
  for (const c of quizClasses) {
    if (!c.quizStartDate) continue;
    const scheduled = scheduledQuizDatesBetween(
      c.quizStartDate,
      addDays(today, -24),
      addDays(today, cfg.quizAnnounceLeadDays + 10),
    );
    const bySched = new Map(c.quizPreps.map((r) => [r.scheduledDate.getTime(), r]));
    const near = (deadline: Date) => {
      const t = deadline.getTime();
      return t <= soon && t >= recent;
    };
    for (const sched of scheduled) {
      const row = bySched.get(sched.getTime());
      const actual = effectiveQuizDate(sched, row);
      const annDl = quizAnnounceDeadline(actual, cfg);
      if (!quizAnnounced(row) && near(annDl))
        quizTodos.push({ classId: c.id, className: c.name, kind: "Announcement", quizDate: actual, deadline: annDl, overdue: now.getTime() > annDl.getTime() });
      const prepDl = quizPrepDeadline(actual, cfg);
      if (!quizPrepComplete(row) && near(prepDl))
        quizTodos.push({ classId: c.id, className: c.name, kind: "Prep", quizDate: actual, deadline: prepDl, overdue: now.getTime() > prepDl.getTime() });
    }
  }
  quizTodos.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">Tasks</h1>
        {(todos.length > 0 || quizTodos.length > 0) && (
          <p className="page-subtitle">Sessions from the last 3 weeks and upcoming quiz prep still needing your attention.</p>
        )}
      </div>

      {todos.length === 0 && quizTodos.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="text-sm font-medium text-success">All caught up</p>
          <p className="mt-1 text-sm text-muted">No outstanding tasks right now.</p>
        </div>
      ) : (
        <>
          {todos.length > 0 && (
            <ul className="flex flex-col gap-2">
              {todos.map(({ s, missing }) => (
                <li key={s.id}>
                  <Link
                    href={`/my/classes/${s.classId}/attendance/${s.id}`}
                    className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-border-strong"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.class.name}</p>
                      <p className="text-xs text-faint">{dateFmt.format(s.scheduledDate)}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {missing.map((m) => (
                        <span key={m} className="badge-warn">{m}</span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {quizTodos.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="section-title mt-2">Quiz tasks</h2>
              <ul className="flex flex-col gap-2">
                {quizTodos.map((q) => (
                  <li key={`${q.classId}-${q.quizDate.getTime()}-${q.kind}`}>
                    <Link
                      href={`/my/classes/${q.classId}/quiz-prep`}
                      className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-border-strong"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{q.className}</p>
                        <p className="text-xs text-faint">
                          Quiz {dateFmt.format(q.quizDate)} · {q.kind.toLowerCase()} by {formatCairo(q.deadline, "d MMM, h:mm a")}
                        </p>
                      </div>
                      <span className={q.overdue ? "badge-danger" : "badge-warn"}>
                        {q.overdue ? "Overdue" : q.kind}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
