// Teacher's-eye trend groups for a class table ("who needs remedial, who's improving,
// who's plateauing"). Pure, unit-tested in scripts/test-class-trends.ts.
//
// These are DESCRIPTIVE patterns over the assessments shown (they work from 2-3 results,
// like reading the mark sheet), not statistical predictions — the dashboard's "slipping"
// alert keeps the stricter reliable-change test in lib/trend.ts. Movement is judged on
// standing in the class (leave-one-out z per assessment), so a hard paper that pulled
// everyone down doesn't read as a decline. Remedial is an ABSOLUTE level (a weak class
// shouldn't hide a struggling student).

export type TrendGroup =
  | "remedial"
  | "declining"
  | "sudden_drop"
  | "watch"
  | "plateau"
  | "recovered"
  | "improving"
  | "top"
  | "not_enough";

// Action order: what needs doing first.
export const GROUP_ORDER: TrendGroup[] = [
  "remedial",
  "declining",
  "sudden_drop",
  "watch",
  "plateau",
  "recovered",
  "improving",
  "top",
  "not_enough",
];

export const GROUP_META: Record<TrendGroup, { label: string; tone: "red" | "orange" | "amber" | "green" | "grey" }> = {
  remedial: { label: "Needs remedial", tone: "red" },
  declining: { label: "Declining", tone: "red" },
  sudden_drop: { label: "Sudden drop", tone: "orange" },
  watch: { label: "Watch", tone: "amber" },
  plateau: { label: "Plateau", tone: "amber" },
  recovered: { label: "Recovered", tone: "amber" },
  improving: { label: "Improving", tone: "green" },
  top: { label: "Consistently top", tone: "green" },
  not_enough: { label: "Not enough results", tone: "grey" },
};

export const REMEDIAL_PCT = 50; // below this on each of the last REMEDIAL_LAST results
export const REMEDIAL_LAST = 2;
export const MOVE = 0.7; // class SDs: recent vs earlier standing => improving / declining
export const SUDDEN = 1.2; // class SDs: last result vs the student's usual
export const DIP = 0.8; // class SDs: a mid-series dip that later recovered
export const TOP_PCTL = 0.8; // top fifth of the class
export const WATCH_PCTL = 0.6; // a former top-fifth student now outside the top ~40%

// One marked result, oldest first. rank 1 = best; n = students marked on it.
export type TrendPoint = { label: string; pct: number; z: number; rank: number; n: number };
export type Classified = { group: TrendGroup; reason: string; change: number };

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pctl = (p: TrendPoint) => (p.n <= 1 ? 1 : 1 - (p.rank - 1) / (p.n - 1)); // 1 = top
const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
const r = (x: number) => `${Math.round(x)}%`;

export function classifyTrend(points: TrendPoint[]): Classified {
  const n = points.length;
  if (n < 2) return { group: "not_enough", reason: n ? `Only one result (${r(points[0].pct)})` : "No results yet", change: 0 };

  const last = points[n - 1];
  const prev = points[n - 2];
  const recentK = n >= 4 ? 2 : 1;
  const recent = points.slice(-recentK);
  const earlier = points.slice(0, -recentK);
  const change = mean(recent.map((p) => p.z)) - mean(earlier.map((p) => p.z));
  const first = points[0];

  // 1. Remedial — absolute level on the latest results.
  const lastFew = points.slice(-REMEDIAL_LAST);
  if (lastFew.length === REMEDIAL_LAST && lastFew.every((p) => p.pct < REMEDIAL_PCT)) {
    const trail = lastFew.map((p) => r(p.pct)).join(", ");
    const note = change >= MOVE ? " — improving, keep going" : change <= -MOVE ? " — and dropping" : "";
    return { group: "remedial", reason: `Below ${REMEDIAL_PCT}% on the last ${REMEDIAL_LAST} (${trail})${note}`, change };
  }

  // 2. Sudden drop — only the latest result fell, sharply, vs their usual standing.
  const before = points.slice(0, -1);
  const usual = mean(before.map((p) => p.z));
  const prevWasNormal = n < 3 || prev.z - mean(points.slice(0, -2).map((p) => p.z)) > -MOVE / 2;
  if (last.z - usual <= -SUDDEN && prevWasNormal && n >= 3) {
    return {
      group: "sudden_drop",
      reason: `Sudden drop to ${r(last.pct)} on ${last.label}. Check what happened before assuming they can't do it`,
      change,
    };
  }

  // 3. Declining — standing fell and is STILL falling. With 4+ results the recent pair is
  //    averaged, so a sustained lower level counts; with 3, the last step must be down too
  //    (a drop that then held is "watch" / "plateau", not a decline).
  if (change <= -MOVE && (n >= 4 ? last.z <= prev.z + 0.2 : last.z < prev.z - 0.1)) {
    return { group: "declining", reason: `Declining (${r(first.pct)} → ${r(last.pct)}, ${ord(first.rank)} → ${ord(last.rank)} in class)`, change };
  }

  // 4. Watch — was at the top, has slid out of it.
  const bestEarlier = before.reduce((b, p) => (pctl(p) > pctl(b) ? p : b), before[0]);
  if (pctl(bestEarlier) >= TOP_PCTL && pctl(last) <= WATCH_PCTL) {
    return { group: "watch", reason: `Was ${ord(bestEarlier.rank)} on ${bestEarlier.label}, now ${ord(last.rank)}`, change };
  }

  // 5. Recovered — a dip in the middle, back to their earlier level now.
  if (n >= 3) {
    const mid = points.slice(1, -1);
    const dip = mid.reduce((m, p) => (p.z < m.z ? p : m), mid[0]);
    const pre = mean(points.slice(0, points.indexOf(dip)).map((p) => p.z));
    if (dip.z <= pre - DIP && last.z >= pre - 0.3) {
      return { group: "recovered", reason: `Recovered from the ${dip.label} dip (${r(dip.pct)} → ${r(last.pct)})`, change };
    }
  }

  // 6. Improving (after Recovered: a bounce back from a dip also reads as a rise).
  if (change >= MOVE && last.z >= prev.z - 0.3) {
    return { group: "improving", reason: `Improving (${r(first.pct)} → ${r(last.pct)}, ${ord(first.rank)} → ${ord(last.rank)} in class)`, change };
  }

  // 7. Consistently top.
  if (points.every((p) => pctl(p) >= TOP_PCTL)) {
    const worst = Math.max(...points.map((p) => p.rank));
    return { group: "top", reason: worst <= 3 ? "Top 3 on every assessment" : "Top fifth of the class on every assessment", change };
  }

  // 8. Plateau — not moving; say where they sit.
  const avg = mean(points.map((p) => p.pct));
  const where = mean(points.map(pctl));
  const spot = where >= 0.67 ? "near the top" : where <= 0.33 ? "near the bottom" : "in the middle";
  return { group: "plateau", reason: `Steady ${spot} (around ${r(avg)})`, change };
}

// Flag the class's biggest improver (largest positive change among "improving").
export function markBiggestImprover<T extends { trend: Classified }>(rows: T[]): void {
  const best = rows
    .filter((x) => x.trend.group === "improving")
    .sort((a, b) => b.trend.change - a.trend.change)[0];
  if (best && rows.filter((x) => x.trend.group === "improving").length > 1) {
    best.trend = { ...best.trend, reason: `Biggest improver — ${best.trend.reason.replace(/^Improving /, "")}` };
  }
}
