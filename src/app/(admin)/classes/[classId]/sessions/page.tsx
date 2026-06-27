import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { displayedLessonNumbers } from "@/lib/lesson-number";
import { markDayOff, clearDayOff } from "@/actions/sessions";
import { currentOperationId } from "@/lib/operation";
import { GenerateSessions } from "./generate-sessions";

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

  const sessions = await prisma.classSession.findMany({
    where: { classId },
    orderBy: { scheduledDate: "asc" },
    include: { topic: { select: { title: true } } },
  });
  const numbers = displayedLessonNumbers(sessions);

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
                  {isAdmin && <th>Day off</th>}
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
                        (s.topic?.title ?? "—")
                      )}
                    </td>
                    {isAdmin && (
                      <td>
                        {s.dayOff ? (
                          <form action={clearDayOff.bind(null, s.id)}>
                            <button type="submit" className="link">Restore</button>
                          </form>
                        ) : (
                          <form action={markDayOff.bind(null, s.id)} className="flex items-center gap-2">
                            <input name="reason" placeholder="reason (e.g. holiday)" className="input w-40 !py-1 text-xs" />
                            <button type="submit" className="font-medium text-danger hover:underline">Mark</button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            <div>
              <p className="mb-2 text-xs text-muted">
                Regenerating replaces all sessions (blocked once attendance has been logged).
              </p>
              <GenerateSessions classId={classId} label="Regenerate sessions" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
