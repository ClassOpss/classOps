// Parent-facing wording of the class-trend groups (lib/class-trend-classify) for the
// monthly report. Pure — unit-tested in scripts/test-class-trends.ts.
//
// Rules (user decisions): never mention class RANK (invites comparison between families);
// never write "sudden drop" (one bad quiz is for the assistant to ask about, not to put in
// writing) — it reads as "lower recently"; where support is needed, point to OFFICE HOURS.
// Plain ASCII punctuation only: the PDF uses the Helvetica core font (no arrows / emoji).

import type { TrendGroup, TrendPoint } from "@/lib/class-trend-classify";

export type ParentTone = "good" | "steady" | "support";
export type ParentTrend = { sentence: string; tone: ParentTone };

const r = (x: number) => `${Math.round(x)}%`;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const OFFICE = "We recommend attending office hours for extra support.";

export function parentTrendSentence(group: TrendGroup, points: TrendPoint[]): ParentTrend | null {
  if (group === "not_enough" || points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const avg = mean(points.map((p) => p.pct));

  switch (group) {
    case "improving":
      return { tone: "good", sentence: `Improving: results have risen from ${r(first.pct)} to ${r(last.pct)} this term. Keep it up!` };
    case "top":
      return { tone: "good", sentence: "Consistently strong results across the term." };
    case "recovered": {
      const mid = points.slice(1, -1);
      const dip = mid.reduce((m, p) => (p.z < m.z ? p : m), mid[0] ?? last);
      return { tone: "good", sentence: `Back on track after a dip on ${dip.label}, now at ${r(last.pct)}.` };
    }
    case "plateau": {
      const where = mean(points.map((p) => (p.n <= 1 ? 1 : 1 - (p.rank - 1) / (p.n - 1))));
      if (where >= 0.67) return { tone: "good", sentence: `Steady, strong results (around ${r(avg)}).` };
      if (where <= 0.33)
        return { tone: "support", sentence: `Results are steady at around ${r(avg)}. Office hours can help move these up.` };
      return { tone: "steady", sentence: `Steady results (around ${r(avg)}).` };
    }
    case "declining":
    case "watch":
    case "sudden_drop":
      return { tone: "support", sentence: `Recent results are lower than earlier in the term. ${OFFICE}` };
    case "remedial": {
      const recent = points.slice(-2).map((p) => r(p.pct)).join(" and ");
      const rising = last.z - first.z >= 0.7;
      return {
        tone: "support",
        sentence: `Recent results (${recent}) are below 50%. ${OFFICE}${rising ? " Results are improving - keep going!" : ""}`,
      };
    }
  }
}
