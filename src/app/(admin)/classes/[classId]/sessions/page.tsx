import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { displayedLessonNumbers } from "@/lib/lesson-number";
import { isLocked } from "@/lib/session-timeline";
import { cairoToday } from "@/lib/datetime";
import { markDayOff, clearDayOff, removeClassLesson } from "@/actions/sessions";
import { currentOperationId } from "@/lib/operation";
import { GenerateSessions } from "./generate-sessions";
import { AddClassLesson, UpdateFutureFromPlan } from "./session-edit";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const user = await requireRole("admin", "teacher");
  const { classId } = await params;
  const isAdmin = user.role === "admin";
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    select: {
      id: true,
      name: true,
      yearGroup: true,
      planStartDate: true,
      school: { select: { name: true } },
    },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="page-title">Class not found</h1>
        <Link href="/classes" className="link text-sm">← Classes</Link>
      </div>
    );
  }

  const rows = await prisma.classSession.findMany({
    where: { classId },
    orderBy: { scheduledDate: "asc" },
    select: {
      id: true,
      scheduledDate: true,
      dayOff: true,
      cancellationReason: true,
      planItemId: true,
      notes: true,
      topic: { select: { title: true } },
      _count: { select: { attendance: true } },
      parentUpdate: { select: { id: true } },
      classroomUpload: { select: { id: true } },
      homework: { select: { id: true } },
    },
  });

  const today = cairoToday();
  const sessions = rows.map((r) => {
    const hasData =
      r._count.attendance > 0 || !!r.parentUpdate || !!r.classroomUpload || !!r.homework;
    const locked = isLocked({ scheduledDate: r.scheduledDate, hasData }, today);
    return { ...r, locked, isAdhoc: r.planItemId === null };
  });
  const numbers = displayedLessonNumbers(sessions);
  const anyLogged = sessions.some(
    (s) => s._count.attendance > 0 || !!s.parentUpdate || !!s.classroomUpload || !!s.homework,
  );

  const topics = await prisma.topic.findMany({
    where: { operationId, yearGroup: klass.yearGroup },
    orderBy: { sortOrder: "asc" },
    select: { id: true, title: true, chapter: true },
  });
  const upcoming = sessions
    .filter((s) => !s.locked)
    .map((s) => ({
      id: s.id,
      label: `${dateFmt.format(s.scheduledDate)} · ${s.dayOff ? "Day off" : s.topic?.title ?? "—"}`,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
        <h1 className="page-title mt-1">Sessions — {klass.name}</h1>
        <p className="page-subtitle">
          {klass.school.name} · {klass.yearGroup} · plan start{" "}
          {klass.planStartDate ? dateFmt.format(klass.planStartDate) : "not set"}
        </p>
      </div>

      {sessions.length === 0 ? (
        <section className="card flex flex-col gap-3 p-5">
          <p className="text-sm text-muted">
            No sessions yet. Generating creates one dated session per lesson in the{" "}
            {klass.yearGroup} plan, on this class&apos;s weekday from its plan start date.
          </p>
          <GenerateSessions classId={classId} label="Generate sessions" />
        </section>
      ) : (
        <>
          <div className="card overflow-hidden">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-16">Lesson</th>
                  <th>Date</th>
                  <th>Topic</th>
                  <th className="w-24">Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr key={s.id} className={s.dayOff ? "opacity-50" : ""}>
                    <td>{numbers[i] ?? "—"}</td>
                    <td>{dateFmt.format(s.scheduledDate)}</td>
                    <td>
                      {s.dayOff ? (
                        <span>Day off{s.cancellationReason ? ` · ${s.cancellationReason}` : ""}</span>
                      ) : (
                        <span className="flex flex-col">
                          <span className="flex items-center gap-2">
                            {s.topic?.title ?? "—"}
                            {s.isAdhoc && <span className="badge-brand">Class-specific</span>}
                          </span>
                          {s.notes ? <span className="text-xs text-muted">{s.notes}</span> : null}
                        </span>
                      )}
                    </td>
                    <td>
                      {s.locked ? (
                        <span className="text-xs font-medium text-muted">Delivered</span>
                      ) : (
                        <span className="text-xs font-medium text-success">Upcoming</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        {s.isAdhoc && !s.locked && (
                          <form action={removeClassLesson.bind(null, s.id)}>
                            <button type="submit" className="font-medium text-danger hover:underline">
                              Remove
                            </button>
                          </form>
                        )}
                        {isAdmin &&
                          (s.dayOff ? (
                            <form action={clearDayOff.bind(null, s.id)}>
                              <button type="submit" className="link">Restore</button>
                            </form>
                          ) : (
                            <form action={markDayOff.bind(null, s.id)} className="flex items-center gap-2">
                              <input name="reason" placeholder="day-off reason" className="input w-36 !py-1 text-xs" />
                              <button type="submit" className="font-medium text-danger hover:underline">
                                Day off
                              </button>
                            </form>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AddClassLesson classId={classId} topics={topics} upcoming={upcoming} />
            <UpdateFutureFromPlan classId={classId} />
          </div>

          {isAdmin && !anyLogged && (
            <div>
              <p className="mb-2 text-xs text-muted">
                Setup only: regenerating replaces <em>all</em> sessions from the plan. It&apos;s
                blocked once attendance is logged — after that, use the tools above to change the
                upcoming schedule without losing any records.
              </p>
              <GenerateSessions classId={classId} label="Regenerate sessions" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
