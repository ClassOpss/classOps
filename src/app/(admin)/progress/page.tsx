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
        <h1 className="page-title">Class Progress</h1>
        <p className="page-subtitle">
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
          <section key={yg} className="card overflow-hidden">
            <div className="border-b border-border px-5 py-3">
              <h2 className="section-title">{yg}</h2>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>School</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((r) => {
                  const behind = leader - r.delivered;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/classes/${r.id}/sessions`} className="link">{r.name}</Link>
                      </td>
                      <td className="text-muted">{r.school}</td>
                      <td className="text-muted">
                        {r.hasSessions ? `Lesson ${r.delivered} of ${r.total}` : "—"}
                      </td>
                      <td>
                        {!r.hasSessions ? (
                          <span className="badge-neutral">No sessions generated</span>
                        ) : behind === 0 ? (
                          <span className="badge-success">On track</span>
                        ) : (
                          <span className="badge-warn">Behind by {behind}</span>
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
        <p className="card px-5 py-6 text-sm text-muted">No active classes yet.</p>
      )}
    </div>
  );
}
