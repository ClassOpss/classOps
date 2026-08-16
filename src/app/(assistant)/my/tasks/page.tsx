import Link from "next/link";
import { requireRole, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

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
            class: { select: { name: true } },
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
      if (!s.classroomUpload) missing.push("Classroom");
      return { s, missing };
    })
    .filter((t) => t.missing.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">Tasks</h1>
        {todos.length > 0 && (
          <p className="page-subtitle">Sessions from the last 3 weeks still needing your attention.</p>
        )}
      </div>

      {todos.length === 0 ? (
        <div className="card px-5 py-8 text-center">
          <p className="text-sm font-medium text-success">All caught up</p>
          <p className="mt-1 text-sm text-muted">No outstanding tasks right now.</p>
        </div>
      ) : (
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
    </div>
  );
}
