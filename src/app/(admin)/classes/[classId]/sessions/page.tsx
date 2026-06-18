import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { displayedLessonNumbers } from "@/lib/lesson-number";
import { markDayOff, clearDayOff } from "@/actions/sessions";
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

  const klass = await prisma.class.findUnique({
    where: { id: classId },
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
        <h1 className="text-xl font-semibold">Class not found</h1>
        <Link href="/classes" className="text-sm text-blue-600 hover:underline">← Classes</Link>
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
        <Link href={`/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← {klass.name}</Link>
        <h1 className="mt-1 text-xl font-semibold">Sessions — {klass.name}</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {klass.school.name} · {klass.yearGroup} · plan start{" "}
          {klass.planStartDate ? dateFmt.format(klass.planStartDate) : "not set"}
        </p>
      </div>

      {sessions.length === 0 ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-black/60 dark:text-white/60">
            No sessions yet. Generating creates one dated session per lesson in the{" "}
            {klass.yearGroup} plan, on this class&apos;s weekday from its plan start date.
          </p>
          <GenerateSessions classId={classId} label="Generate sessions" />
        </section>
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="w-16 py-2">Lesson</th>
                <th className="py-2">Date</th>
                <th className="py-2">Topic</th>
                {isAdmin && <th className="py-2">Day off</th>}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-black/5 dark:border-white/5 ${
                    s.dayOff ? "text-black/40 dark:text-white/40" : ""
                  }`}
                >
                  <td className="py-2">{numbers[i] ?? "—"}</td>
                  <td className="py-2">{dateFmt.format(s.scheduledDate)}</td>
                  <td className="py-2">
                    {s.dayOff ? (
                      <span>Day off{s.cancellationReason ? ` · ${s.cancellationReason}` : ""}</span>
                    ) : (
                      (s.topic?.title ?? "—")
                    )}
                  </td>
                  {isAdmin && (
                    <td className="py-2">
                      {s.dayOff ? (
                        <form action={clearDayOff.bind(null, s.id)}>
                          <button type="submit" className="text-blue-600 hover:underline">Restore</button>
                        </form>
                      ) : (
                        <form action={markDayOff.bind(null, s.id)} className="flex items-center gap-2">
                          <input
                            name="reason"
                            placeholder="reason (e.g. holiday)"
                            className="w-40 rounded-md border border-black/15 bg-white px-2 py-1 text-xs outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent"
                          />
                          <button type="submit" className="text-red-600 hover:underline">Mark</button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {isAdmin && (
            <div className="border-t border-black/10 pt-4 dark:border-white/10">
              <p className="mb-2 text-xs text-black/50 dark:text-white/50">
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
