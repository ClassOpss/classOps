import {
  GRADE_TREND_TEXT,
  HW_TREND_TEXT,
  type GradeTrend,
  type GradeTrendLabel,
  type HwTrend,
  type HwTrendLabel,
} from "@/lib/trend";

const GRADE_CLS: Record<GradeTrendLabel, string> = {
  improving: "badge-success",
  slipping: "badge-danger",
  steady_above: "badge-neutral",
  steady_level: "badge-neutral",
  steady_below: "badge-warn",
};
const HW_CLS: Record<HwTrendLabel, string> = {
  improving: "badge-success",
  slipping: "badge-danger",
  steady: "badge-neutral",
};
const ARROW: Record<string, string> = { improving: "↗", slipping: "↘" };

export function GradeTrendBadge({ trend }: { trend: GradeTrend }) {
  if (!trend) return null;
  return (
    <span className={GRADE_CLS[trend.label]} title={`Standing in class moved ${trend.change >= 0 ? "+" : ""}${trend.change.toFixed(1)} SD (latest 3 vs earlier ${trend.points.length - 3})`}>
      {ARROW[trend.label] ?? "→"} {GRADE_TREND_TEXT[trend.label]}
    </span>
  );
}

export function HwTrendBadge({ trend }: { trend: HwTrend }) {
  if (!trend || trend.label === "steady") return null; // steady HW is the norm — keep cards quiet
  return (
    <span className={HW_CLS[trend.label]}>
      {ARROW[trend.label]} {HW_TREND_TEXT[trend.label]}
    </span>
  );
}

// Tiny line of the student's standing (z vs the rest of the class); dashed line = class average.
export function GapSparkline({ trend, width = 84, height = 24 }: { trend: GradeTrend; width?: number; height?: number }) {
  if (!trend) return null;
  const gaps = trend.points.map((p) => p.z);
  const span = Math.max(1, ...gaps.map(Math.abs)); // symmetric around the class line
  const pad = 3;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (gaps.length - 1);
  const y = (g: number) => height / 2 - (g / span) * (height / 2 - pad);
  const d = gaps.map((g, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(g).toFixed(1)}`).join(" ");
  const tone =
    trend.label === "improving" ? "text-success" : trend.label === "slipping" ? "text-danger" : "text-muted";
  return (
    <svg width={width} height={height} className={tone} aria-label="Grade trend vs class average" role="img">
      <line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="2 2" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(gaps.length - 1)} cy={y(gaps[gaps.length - 1])} r={2.2} fill="currentColor" />
    </svg>
  );
}
