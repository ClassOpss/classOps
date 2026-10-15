// Is a student getting better, worse, or holding steady? Pure helpers, unit-tested
// in scripts/test-trend.ts.
//
// GRADES are judged on the GAP to the class average for each assessment (student % −
// class avg %), not raw %: quizzes vary in difficulty, and the gap cancels that out
// (same idea as the green/red grade colour rule). Diagnostics are excluded by callers.
//
// HOMEWORK is judged on a per-HW score (on time 1, late 0.5, missing 0), comparing
// the recent half of the window with the earlier half. HW is set ~5-10x a month, so
// this trend is available weeks before the grade trend (~2 quizzes a month).

export type GradeTrendLabel = "improving" | "slipping" | "steady_above" | "steady_level" | "steady_below";
export type HwTrendLabel = "improving" | "slipping" | "steady";

export type GradeTrend = {
  label: GradeTrendLabel;
  change: number; // fitted change in the gap across the window, in % points
  level: number; // mean gap of the latest (up to) 3 assessments
  points: { gap: number; pct: number; classAvg: number }[]; // oldest -> newest, for sparklines
} | null; // null = not enough data yet

export type HwTrend = {
  label: HwTrendLabel;
  recent: number; // 0..1 score of the newer half
  earlier: number; // 0..1 score of the older half
} | null;

export const GRADE_WINDOW = 6; // latest N graded assessments
export const GRADE_MIN = 4; // need at least this many to call a trend
export const GRADE_CHANGE = 8; // |fitted change| >= 8 pts => improving / slipping
export const GRADE_LEVEL = 3; // steady: mean gap beyond ±3 pts => above / below class

export const HW_WINDOW = 8; // latest N reviewed homeworks
export const HW_MIN = 6;
export const HW_CHANGE = 0.25; // recent vs earlier score differs by >= 0.25

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Least-squares slope of ys over x = 0..n-1.
function slope(ys: number[]): number {
  const n = ys.length;
  const mx = (n - 1) / 2;
  const my = mean(ys);
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

// `graded` in chronological order (oldest first), non-diagnostic, scored only.
export function gradeTrend(graded: { pct: number; classAvg: number }[]): GradeTrend {
  const win = graded.slice(-GRADE_WINDOW);
  if (win.length < GRADE_MIN) return null;
  const points = win.map((g) => ({ gap: g.pct - g.classAvg, pct: g.pct, classAvg: g.classAvg }));
  const gaps = points.map((p) => p.gap);
  const change = slope(gaps) * (gaps.length - 1);
  const level = mean(gaps.slice(-3));
  const label: GradeTrendLabel =
    change >= GRADE_CHANGE
      ? "improving"
      : change <= -GRADE_CHANGE
        ? "slipping"
        : level >= GRADE_LEVEL
          ? "steady_above"
          : level <= -GRADE_LEVEL
            ? "steady_below"
            : "steady_level";
  return { label, change, level, points };
}

const HW_SCORE = { on_time: 1, late: 0.5, missing: 0 } as const;
export type HwOutcomeForTrend = keyof typeof HW_SCORE;

// `outcomes` in chronological order by deadline (oldest first), reviewed HW only.
export function hwTrend(outcomes: HwOutcomeForTrend[]): HwTrend {
  const win = outcomes.slice(-HW_WINDOW);
  if (win.length < HW_MIN) return null;
  const half = Math.floor(win.length / 2);
  const earlier = mean(win.slice(0, win.length - half).map((o) => HW_SCORE[o]));
  const recent = mean(win.slice(-half).map((o) => HW_SCORE[o]));
  const d = recent - earlier;
  const label: HwTrendLabel = d >= HW_CHANGE ? "improving" : d <= -HW_CHANGE ? "slipping" : "steady";
  return { label, recent, earlier };
}

// Staff-facing wording (badges on progress / profile).
export const GRADE_TREND_TEXT: Record<GradeTrendLabel, string> = {
  improving: "Grades improving",
  slipping: "Grades slipping",
  steady_above: "Steady · above class",
  steady_level: "Steady · at class level",
  steady_below: "Stuck below class",
};
export const HW_TREND_TEXT: Record<HwTrendLabel, string> = {
  improving: "HW improving",
  slipping: "HW slipping",
  steady: "HW steady",
};
