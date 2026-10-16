import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { currentOperationId } from "@/lib/operation";
import { loadOperationTrends } from "@/lib/class-trends";
import { GROUP_META, type TrendGroup } from "@/lib/class-trend-classify";
import { TrendCounts, TrendDot, parsePeriod } from "@/components/class-trends-table";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Listed by name on this page: the groups someone should act on.
const ACTION: TrendGroup[] = ["remedial", "declining", "sudden_drop", "watch"];

export default async function TrendsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  await requireRole("admin", "teacher");
  const period = parsePeriod(await searchParams);
  const classes = await loadOperationTrends(await currentOperationId(), period);

  const seen = new Set<string>();
  const months = classes
    .flatMap((c) => c.trends.months)
    .filter((m) => !seen.has(`${m.year}-${m.month}`) && seen.add(`${m.year}-${m.month}`))
    .sort((a, b) => b.year - a.year || b.month - a.month);
  const q = period ? `?month=${period.month}&year=${period.year}` : "";
  const total = (g: TrendGroup) => classes.reduce((n, c) => n + (c.trends.counts[g] ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Trends</h1>
        <p className="page-subtitle">
          Across all classes: {total("remedial")} need remedial · {total("declining") + total("sudden_drop")} dropping ·{" "}
          {total("improving")} improving
        </p>
      </div>

      {months.length > 0 && (
        <nav className="-mx-1 flex flex-wrap gap-1.5 px-1">
          <Link href="/trends" className={period ? "badge-neutral" : "badge-brand"}>All</Link>
          {months.map((m) => {
            const active = period?.month === m.month && period.year === m.year;
            return (
              <Link
                key={`${m.year}-${m.month}`}
                href={`/trends?month=${m.month}&year=${m.year}`}
                className={active ? "badge-brand" : "badge-neutral"}
              >
                {MONTHS[m.month - 1]} {m.year}
              </Link>
            );
          })}
        </nav>
      )}

      {classes.length === 0 && <p className="card px-4 py-6 text-center text-sm text-muted">No active classes.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {classes.map((c) => {
          const act = c.trends.rows.filter((r) => ACTION.includes(r.trend.group));
          return (
            <section key={c.id} className="card overflow-hidden">
              <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
                <div>
                  <h2 className="section-title">{c.name}</h2>
                  <p className="text-xs text-muted">
                    {c.school.name} · {c.trends.columns.length} assessment{c.trends.columns.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Link href={`/classes/${c.id}/trends${q}`} className="link shrink-0 text-sm">Full table →</Link>
              </div>
              <div className="flex flex-col gap-3 px-4 py-3">
                {c.trends.columns.length === 0 ? (
                  <p className="text-sm text-muted">No assessments in this period.</p>
                ) : (
                  <>
                    <TrendCounts counts={c.trends.counts} />
                    {act.length === 0 ? (
                      <p className="text-sm text-success">Nobody needs action right now.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {act.map((r) => (
                          <li key={r.id} className="flex items-start gap-2 text-sm">
                            <span className="mt-1.5"><TrendDot group={r.trend.group} /></span>
                            <span>
                              <b>{r.name}</b> <span className="text-muted">· {GROUP_META[r.trend.group].label}</span>
                              <span className="block text-xs text-muted">{r.trend.reason}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
