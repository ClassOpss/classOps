import Link from "next/link";
import type { YearGroup } from "@prisma/client";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { YEAR_GROUPS } from "@/lib/constants";
import { currentOperationId } from "@/lib/operation";

export default async function ProgressPage() {
  await requireRole("admin", "teacher");
  const operationId = await currentOperationId();

  const now = new Date();
  const classes = await prisma.class.findMany({
    where: { active: true, operationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      yearGroup: true,
      school: { select: { name: true } },
      sessions: { select: { scheduledDate: true, dayOff: true } },
    },
  });

  // Per class: total real lessons + lessons delivered so far (non-day-off, date <= today).
  const rows = classes.map((c) => {
    const real = c.sessions.filter((s) => !s.dayOff);
    const delivered = real.filter((s) => s.scheduledDate <= now).length;
    return {
      id: c.id,
      name: c.name,
      school: c.school.name,
      yearGroup: c.yearGroup,
      total: real.length,
      delivered,
      hasSessions: c.sessions.length > 0,
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Class Progress</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Where each class is in its year-group plan. &quot;Behind&quot; is relative to the
          furthest-along class in the same year group.
        </p>
      </div>

      {YEAR_GROUPS.map((yg) => {
        const group = rows.filter((r) => r.yearGroup === (yg as YearGroup));
        if (group.length === 0) return null;
        const leader = Math.max(...group.map((r) => r.delivered));
        const ordered = [...group].sort((a, b) => b.delivered - a.delivered);

        return (
          <section key={yg}>
            <h2 className="mb-3 font-medium">{yg}</h2>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
                <tr>
                  <th className="py-2">Class</th>
                  <th className="py-2">School</th>
                  <th className="py-2">Progress</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((r) => {
                  const behind = leader - r.delivered;
                  return (
                    <tr key={r.id} className="border-b border-black/5 dark:border-white/5">
                      <td className="py-2">
                        <Link href={`/classes/${r.id}/sessions`} className="text-blue-600 hover:underline">
                          {r.name}
                        </Link>
                      </td>
                      <td className="py-2">{r.school}</td>
                      <td className="py-2">
                        {r.hasSessions ? `Lesson ${r.delivered} of ${r.total}` : "—"}
                      </td>
                      <td className="py-2">
                        {!r.hasSessions ? (
                          <span className="text-black/40">No sessions generated</span>
                        ) : behind === 0 ? (
                          <span className="text-green-600">On track</span>
                        ) : (
                          <span className="text-amber-600">Behind by {behind}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      {rows.length === 0 && (
        <p className="text-sm text-black/50 dark:text-white/50">No active classes yet.</p>
      )}
    </div>
  );
}
