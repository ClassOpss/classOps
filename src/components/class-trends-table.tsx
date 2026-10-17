import Link from "next/link";
import { GROUP_META, GROUP_ORDER, type TrendGroup } from "@/lib/class-trend-classify";
import type { ClassTrends, TrendCell } from "@/lib/class-trends";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

const DOT: Record<string, string> = {
  red: "bg-danger",
  orange: "bg-orange-500",
  amber: "bg-amber-400",
  green: "bg-success",
  grey: "bg-faint",
};

export function TrendDot({ group }: { group: TrendGroup }) {
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[GROUP_META[group].tone]}`} aria-hidden />;
}

function Cell({ c }: { c: TrendCell }) {
  if (!c) return <span className="text-faint">—</span>;
  if (c.kind === "absent") return <span className="text-xs text-faint">absent</span>;
  return (
    <span title={`${Math.round(c.pct)}% · ${c.rank} of ${c.n}`}>
      <span className="font-medium">{c.letter ?? `${Math.round(c.pct)}%`}</span>
      {c.letter && <span className="block text-[0.65rem] text-faint">{Math.round(c.pct)}%</span>}
    </span>
  );
}

// Month filter chips — "All" plus every month that has an assessment.
export function TrendMonthFilter({ base, data, period }: {
  base: string;
  data: ClassTrends;
  period: { month: number; year: number } | null;
}) {
  if (data.months.length === 0) return null;
  return (
    <nav className="-mx-1 flex flex-wrap gap-1.5 px-1">
      <Link href={base} className={period ? "badge-neutral" : "badge-brand"}>All</Link>
      {data.months.map((m) => {
        const active = period?.month === m.month && period.year === m.year;
        return (
          <Link
            key={`${m.year}-${m.month}`}
            href={`${base}?month=${m.month}&year=${m.year}`}
            className={active ? "badge-brand" : "badge-neutral"}
          >
            {MONTHS[m.month - 1]} {m.year}
          </Link>
        );
      })}
    </nav>
  );
}

// Count per group, in action order.
export function TrendCounts({ counts }: { counts: ClassTrends["counts"] }) {
  const groups = GROUP_ORDER.filter((g) => counts[g]);
  if (groups.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {groups.map((g) => (
        <li key={g} className="flex items-center gap-1.5">
          <TrendDot group={g} />
          <span className="text-muted">{GROUP_META[g].label}</span>
          <b className="tabular-nums">{counts[g]}</b>
        </li>
      ))}
    </ul>
  );
}

export function ClassTrendsTable({ data, studentHref }: { data: ClassTrends; studentHref?: (id: string) => string }) {
  if (data.columns.length === 0) {
    return <p className="card px-4 py-6 text-center text-sm text-muted">No assessments in this period yet.</p>;
  }
  if (data.rows.length === 0) {
    return <p className="card px-4 py-6 text-center text-sm text-muted">No students.</p>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Student</th>
            {data.columns.map((c) => (
              <th key={c.id} className="whitespace-nowrap px-2 py-2.5 text-center font-medium">
                {c.label}
                <span className="block font-normal text-faint">
                  {dayFmt.format(c.date)}
                  {c.isDiagnostic && " · mock"}
                </span>
              </th>
            ))}
            <th className="hidden min-w-[16rem] px-3 py-2.5 font-medium sm:table-cell">Trend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.rows.map((r) => (
            <tr key={r.id}>
              <td className="sticky left-0 z-10 min-w-48 max-w-48 bg-card px-3 py-2.5 sm:min-w-0 sm:max-w-none sm:whitespace-nowrap">
                {studentHref ? (
                  <Link href={studentHref(r.id)} className="link font-medium">{r.name}</Link>
                ) : (
                  <span className="font-medium">{r.name}</span>
                )}
                {/* Phones: the trend sits under the name so it's visible without scrolling. */}
                <span className="mt-1 flex items-start gap-1.5 sm:hidden">
                  <span className="mt-1"><TrendDot group={r.trend.group} /></span>
                  <span className="text-xs">
                    <b>{GROUP_META[r.trend.group].label}</b>
                    <span className="block text-muted">{r.trend.reason}</span>
                  </span>
                </span>
              </td>
              {r.cells.map((c, i) => (
                <td key={data.columns[i].id} className="px-2 py-2.5 text-center tabular-nums">
                  <Cell c={c} />
                </td>
              ))}
              <td className="hidden px-3 py-2.5 sm:table-cell">
                <span className="flex items-start gap-2">
                  <span className="mt-1.5"><TrendDot group={r.trend.group} /></span>
                  <span>
                    <b>{GROUP_META[r.trend.group].label}</b>
                    <span className="block text-xs text-muted">{r.trend.reason}</span>
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const TREND_FOOTNOTE =
  "Movement is judged on standing in the class, so a hard paper that pulled everyone down isn't a decline. " +
  "Needs remedial = below 50% on the last 2. Letters use automatic Edexcel-style boundaries from the class marks (or a manual override); the lowest grade is D. " +
  "These are patterns to act on, not predictions — with 2–3 results, check before concluding.";

export function parsePeriod(sp: { month?: string; year?: string }) {
  const m = Number(sp.month);
  const y = Number(sp.year);
  return m >= 1 && m <= 12 && y > 2000 ? { month: m, year: y } : null;
}
