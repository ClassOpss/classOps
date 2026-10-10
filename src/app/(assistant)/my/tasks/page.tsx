import Link from "next/link";
import { requireRole, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { taskRequired, type TaskScope } from "@/lib/task-toggles";
import { resolveConfig } from "@/lib/operation";
import { cairoToday, saturdayDeadline, quizPrepDeadline, quizAnnounceDeadline, monthlyReportDeadline, formatCairo } from "@/lib/datetime";
import { monthlyReportProgress, monthlyReportDone, yearMonthOf, previousMonth, monthName } from "@/lib/monthly-reports";
import { subGroupStudentIds } from "@/lib/roster";
import { quizCyclesBetween, quizPrepComplete, quizAnnounced, addDays } from "@/lib/quiz";

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
    select: { classId: true, exemptTasks: true, class: { select: { name: true, disabledTasks: true } } },
  });
  const classIds = [...new Set(assignments.map((a) => a.classId))];
  // Per class: what's turned off for the whole class + what I'm personally excused from.
  const scopeByClass = new Map<string, TaskScope>();
  for (const a of assignments) {
    const prev = scopeByClass.get(a.classId);
    scopeByClass.set(a.classId, {
      disabledTasks: a.class.disabledTasks,
      exemptTasks: [...(prev?.exemptTasks ?? []), ...a.exemptTasks],
    });
  }
  const required = (classId: string, type: Parameters<typeof taskRequired>[0], extra?: Partial<TaskScope>) =>
    taskRequired(type, { ...(scopeByClass.get(classId) ?? { disabledTasks: [] }), ...extra });

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
      if (required(s.classId, "attendance") && s.attendance.length === 0) missing.push("Attendance");
      if (required(s.classId, "parent_update") && !s.parentUpdate) missing.push("Parent update");
      if (required(s.classId, "classroom_upload", { lmsType: s.class.lmsType }) && !s.classroomUpload)
        missing.push("Classroom");
      return { s, missing };
    })
    .filter((t) => t.missing.length > 0);

  // Quiz-prep tasks: for each quiz-enabled class, any biweekly cycle that isn't complete
  // and whose prep deadline is either overdue (last 21 days) or coming up within a week.
  const quizClasses =
    classIds.length === 0
      ? []
      : await prisma.class.findMany({
          where: { id: { in: classIds }, OR: [{ quizStartDate: { not: null } }, { quizPreps: { some: { adHoc: true } } }] },
          select: {
            id: true,
            name: true,
            quizStartDate: true,
            quizPreps: {
              select: {
                scheduledDate: true,
                adHoc: true,
                quizDate: true,
                quizCreated: true,
                sentToPrint: true,
                announcedAt: true,
                assessment: { select: { label: true, type: true } },
              },
            },
          },
        });
  const cfg = await resolveConfig();
  const today = cairoToday(now);
  const soon = now.getTime() + 7 * 86_400_000;
  const recent = now.getTime() - 21 * 86_400_000;

  const quizTodos: { classId: string; className: string; title: string; kind: string; quizDate: Date; deadline: Date; overdue: boolean }[] = [];
  for (const c of quizClasses) {
    const cycles = quizCyclesBetween(
      c.quizStartDate,
      c.quizPreps,
      addDays(today, -24),
      addDays(today, cfg.quizAnnounceLeadDays + 10),
    );
    const near = (deadline: Date) => {
      const t = deadline.getTime();
      return t <= soon && t >= recent;
    };
    for (const { quizDate: actual, row } of cycles) {
      const title = row?.assessment && row.assessment.type !== "quiz" ? row.assessment.label : "Quiz";
      const annDl = quizAnnounceDeadline(actual, cfg);
      if (required(c.id, "quiz_announcement") && !quizAnnounced(row) && near(annDl))
        quizTodos.push({ classId: c.id, className: c.name, title, kind: "Announcement", quizDate: actual, deadline: annDl, overdue: now.getTime() > annDl.getTime() });
      const prepDl = quizPrepDeadline(actual, cfg);
      if (required(c.id, "quiz_prep") && !quizPrepComplete(row) && near(prepDl))
        quizTodos.push({ classId: c.id, className: c.name, title, kind: "Prep", quizDate: actual, deadline: prepDl, overdue: now.getTime() > prepDl.getTime() });
    }
  }
  quizTodos.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  const classNames = new Map(assignments.map((a) => [a.classId, a.class.name]));

  // Weekly sub-group tasks (HW correction / grade entry): anything already due/held whose
  // Saturday deadline is ahead or passed within the last 3 weeks, while MY sub-group isn't
  // fully reviewed yet. Same completeness rule the weekly fine uses.
  const weeklyTodos: {
    key: string; classId: string; className: string; kind: "Homework" | "Grades"; title: string;
    href: string; reviewed: number; total: number; deadline: Date; overdue: boolean;
  }[] = [];
  if (classIds.length > 0) {
    const lookback = addDays(today, -28);
    const [homeworks, assessments] = await Promise.all([
      prisma.homeworkAssignment.findMany({
        where: { classId: { in: classIds }, noHomework: false, deadline: { gte: lookback, lte: today } },
        select: { id: true, classId: true, description: true, deadline: true, submissions: { select: { studentId: true } } },
      }),
      prisma.assessment.findMany({
        where: { classId: { in: classIds }, date: { gte: lookback, lte: today } },
        select: { id: true, classId: true, label: true, date: true, grades: { select: { studentId: true } } },
      }),
    ]);
    const assistantId = user.assistantId;
    const subGroups = new Map<string, string[]>();
    const subGroup = async (classId: string) => {
      let ids = subGroups.get(classId);
      if (!ids) subGroups.set(classId, (ids = await subGroupStudentIds(classId, assistantId, now)));
      return ids;
    };
    const push = async (
      classId: string, kind: "Homework" | "Grades", id: string, title: string, href: string, date: Date, done: string[],
    ) => {
      const deadline = saturdayDeadline(date, cfg);
      if (deadline.getTime() < recent) return; // too old to chase
      const ids = await subGroup(classId);
      if (ids.length === 0) return;
      const seen = new Set(done);
      const reviewed = ids.filter((x) => seen.has(x)).length;
      if (reviewed >= ids.length) return;
      weeklyTodos.push({
        key: `${kind}-${id}`, classId, className: classNames.get(classId) ?? "", kind, title, href,
        reviewed, total: ids.length, deadline, overdue: now.getTime() > deadline.getTime(),
      });
    };
    for (const hw of homeworks) {
      if (!required(hw.classId, "hw_correction")) continue;
      await push(hw.classId, "Homework", hw.id, `HW due ${dateFmt.format(hw.deadline)}${hw.description ? ` · ${hw.description}` : ""}`,
        `/my/classes/${hw.classId}/homework/${hw.id}`, hw.deadline, hw.submissions.map((x) => x.studentId));
    }
    for (const a of assessments) {
      if (!required(a.classId, "grade_entry")) continue;
      await push(a.classId, "Grades", a.id, `${a.label} · ${dateFmt.format(a.date)}`,
        `/my/classes/${a.classId}/assessments/${a.id}`, a.date, a.grades.map((g) => g.studentId));
    }
  }
  weeklyTodos.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

  // Monthly parent reports (due the 30th / Feb 28th): this month's shows up from a week
  // before the deadline; last month's stays listed as overdue until it's done.
  const reportTodos: {
    classId: string; className: string; year: number; month: number; deadline: Date; sent: number; total: number; overdue: boolean;
  }[] = [];
  const thisMonth = yearMonthOf(today);
  const months = [previousMonth(thisMonth.year, thisMonth.month), thisMonth];
  for (const classId of classIds) {
    if (!required(classId, "monthly_report")) continue;
    for (const { year, month } of months) {
      const deadline = monthlyReportDeadline(year, month, cfg);
      const overdue = now.getTime() > deadline.getTime();
      if (!overdue && deadline.getTime() > soon) continue; // not due within a week yet
      if (overdue && deadline.getTime() < recent) continue; // too old to chase
      const progress = await monthlyReportProgress(classId, user.assistantId, year, month, now);
      if (progress.total === 0 || monthlyReportDone(progress)) continue;
      reportTodos.push({ classId, className: classNames.get(classId) ?? "", year, month, deadline, overdue, ...progress });
    }
  }
  reportTodos.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const nothing = todos.length === 0 && weeklyTodos.length === 0 && quizTodos.length === 0 && reportTodos.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">Tasks</h1>
        {!nothing && (
          <p className="page-subtitle">Sessions from the last 3 weeks, homework corrections, grades, upcoming quiz prep and monthly reports still needing your attention.</p>
        )}
      </div>

      {nothing ? (
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

          {weeklyTodos.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="section-title mt-2">Weekly tasks</h2>
              <ul className="flex flex-col gap-2">
                {weeklyTodos.map((w) => (
                  <li key={w.key}>
                    <Link
                      href={w.href}
                      className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-border-strong"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{w.className}</p>
                        <p className="truncate text-xs text-faint">
                          {w.title} · {w.reviewed} of {w.total} {w.kind === "Homework" ? "reviewed" : "graded"} · due {formatCairo(w.deadline, "d MMM, h:mm a")}
                        </p>
                      </div>
                      <span className={w.overdue ? "badge-danger" : "badge-warn"}>{w.overdue ? "Overdue" : w.kind}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reportTodos.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="section-title mt-2">Monthly parent reports</h2>
              <ul className="flex flex-col gap-2">
                {reportTodos.map((r) => (
                  <li key={`${r.classId}-${r.year}-${r.month}`}>
                    <Link
                      href={`/my/classes/${r.classId}/parent-reports?month=${r.month}&year=${r.year}`}
                      className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-border-strong"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{r.className}</p>
                        <p className="text-xs text-faint">
                          {monthName(r.month)} reports · {r.sent} of {r.total} sent · due {formatCairo(r.deadline, "d MMM, h:mm a")}
                        </p>
                      </div>
                      <span className={r.overdue ? "badge-danger" : "badge-warn"}>{r.overdue ? "Overdue" : "Reports"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
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
                          {q.title} {dateFmt.format(q.quizDate)} · {q.kind.toLowerCase()} by {formatCairo(q.deadline, "d MMM, h:mm a")}
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
