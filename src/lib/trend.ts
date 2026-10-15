// Is a student getting better, worse, or holding steady? Pure helpers, unit-tested
// in scripts/test-trend.ts. Method (and why) — see the references at the bottom:
//
// 1. STANDARDISE each assessment against the rest of the class (leave-one-out z-score):
//      z = (student% − mean of the OTHER students) / SD of the other students.
//    Quizzes differ in difficulty AND spread; z puts them on one scale ("standing in the
//    class"). Leave-one-out matters in small classes, where a student drags the average.
// 2. Compare the student's RECENT level (MEDIAN z of the latest 3, so one off day doesn't
//    count) with their own BASELINE (mean z of the earlier ones) — not an OLS slope:
//    slopes need ~8-9+ points to be reliable, and median-of-recent rules do as well.
// 3. Call it a change only when it beats the noise (reliable-change style):
//      RC = change / SE,  SE = σ·√((π/2)/k_recent + 1/k_baseline)   (π/2: median's variance),
//    with σ = the class's pooled within-student SD of z (how much a typical student
//    bounces around quiz to quiz). |RC| ≥ 1.645 (90%) AND |change| ≥ 0.5 SD.
// 4. Homework uses the same recent-vs-baseline idea on the submission rate (submitted
//    = on time or late, same as the at-risk rule), with a two-proportion z-test — so one
//    missed homework after a clean run is NOT "slipping"; two of the last four is.

export type GradeTrendLabel = "improving" | "slipping" | "steady_above" | "steady_level" | "steady_below";
export type HwTrendLabel = "improving" | "slipping" | "steady";

export type GradePoint = { z: number; pct: number };
export type GradeTrend = {
  label: GradeTrendLabel;
  change: number; // recent − baseline, in class SDs
  rc: number; // reliable-change statistic
  level: number; // recent median z
  points: GradePoint[]; // oldest -> newest (window), for sparklines
} | null; // null = not enough data yet

export type HwTrend = {
  label: HwTrendLabel;
  recent: number; // submission rate, latest HW_RECENT
  baseline: number; // submission rate, the earlier ones
  z: number;
} | null;

// Grades
export const MIN_OTHERS = 3; // need ≥3 other marked students to standardise an assessment
export const SD_FLOOR = 5; // % points — stops z exploding when everyone scores the same
export const Z_CAP = 3;
export const GRADE_WINDOW = 8; // latest N standardised assessments
export const GRADE_RECENT = 3;
export const GRADE_MIN = 5; // 3 recent + ≥2 baseline (~2.5 months at 2 quizzes/month)
export const DEFAULT_NOISE = 0.6; // σ when the class has too little data to estimate it
export const NOISE_FLOOR = 0.3;
export const MIN_EFFECT = 0.5; // a "medium" change: half a class SD
export const LEVEL_BAND = 0.5; // steady: recent mean z beyond ±0.5 => above / below class

// Homework
export const HW_RECENT = 4;
export const HW_WINDOW = 12; // recent 4 + up to 8 baseline
export const HW_MIN_BASELINE = 4; // => ≥8 reviewed HW (~1 month at 5-10/month)

export const RC_CRIT = 1.645; // 90% two-sided — early warning, not a verdict

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

// Leave-one-out z of `pct` against the other students' marks. null = too few others.
export function looZ(pct: number, others: number[]): number | null {
  if (others.length < MIN_OTHERS) return null;
  const z = (pct - mean(others)) / Math.max(SD_FLOOR, sd(others));
  return Math.max(-Z_CAP, Math.min(Z_CAP, z));
}

// Per-student z series for one class. `assessments` chronological (oldest first),
// non-diagnostic, each with every marked grade (absent / unmarked left out).
export function classGradeSeries(
  assessments: { grades: { studentId: string; pct: number }[] }[],
): Map<string, GradePoint[]> {
  const series = new Map<string, GradePoint[]>();
  for (const a of assessments) {
    for (const g of a.grades) {
      const z = looZ(g.pct, a.grades.filter((o) => o.studentId !== g.studentId).map((o) => o.pct));
      if (z == null) continue;
      if (!series.has(g.studentId)) series.set(g.studentId, []);
      series.get(g.studentId)!.push({ z, pct: g.pct });
    }
  }
  return series;
}

// Pooled within-student SD of z across the class: the typical quiz-to-quiz bounce.
export function pooledNoise(series: Iterable<GradePoint[]>): number {
  let ss = 0;
  let df = 0;
  for (const s of series) {
    const zs = s.slice(-GRADE_WINDOW).map((p) => p.z);
    if (zs.length < 3) continue;
    const m = mean(zs);
    ss += zs.reduce((a, z) => a + (z - m) ** 2, 0);
    df += zs.length - 1;
  }
  return df >= 4 ? Math.max(NOISE_FLOOR, Math.sqrt(ss / df)) : DEFAULT_NOISE;
}

export function gradeTrend(points: GradePoint[], noise: number): GradeTrend {
  const win = points.slice(-GRADE_WINDOW);
  if (win.length < GRADE_MIN) return null;
  const recent = win.slice(-GRADE_RECENT).map((p) => p.z);
  const base = win.slice(0, -GRADE_RECENT).map((p) => p.z);
  const level = median(recent);
  const change = level - mean(base);
  const rc = change / (noise * Math.sqrt(Math.PI / 2 / recent.length + 1 / base.length));
  const reliable = Math.abs(rc) >= RC_CRIT && Math.abs(change) >= MIN_EFFECT;
  const label: GradeTrendLabel = reliable
    ? change > 0
      ? "improving"
      : "slipping"
    : level >= LEVEL_BAND
      ? "steady_above"
      : level <= -LEVEL_BAND
        ? "steady_below"
        : "steady_level";
  return { label, change, rc, level, points: win };
}

// `submitted` chronological by deadline (oldest first), reviewed HW only:
// true = on time or late, false = missing.
export function hwTrend(submitted: boolean[]): HwTrend {
  const win = submitted.slice(-HW_WINDOW);
  const recent = win.slice(-HW_RECENT);
  const base = win.slice(0, -HW_RECENT);
  if (recent.length < HW_RECENT || base.length < HW_MIN_BASELINE) return null;
  const rate = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;
  const r = rate(recent);
  const b = rate(base);
  const p = rate(win);
  const se = Math.sqrt(p * (1 - p) * (1 / recent.length + 1 / base.length));
  const z = se === 0 ? 0 : (r - b) / se;
  const label: HwTrendLabel = z >= RC_CRIT ? "improving" : z <= -RC_CRIT ? "slipping" : "steady";
  return { label, recent: r, baseline: b, z };
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

// References
// - Slope reliability needs ~8-9+ points / ≥4 weeks: McMaster et al. 2011; Christ et al. 2013
//   (via Frontiers in Education 2018, doi 10.3389/feduc.2018.00068); slope reliability ≈ .64
//   even with 16 points (Acadience/DIBELS PCRC 2015 handout).
// - Median of the 3 most recent / recent-points vs goal performs like the trend-line rule; the single data-point
//   rule performs poorly (School Psychology Review 2018 simulation; Ardoin et al. 2013).
// - Reliable Change Index: Jacobson & Truax 1991; Maassen 2004 (JINS 10, 888-893).
// - Early-warning cut points must be set locally: Balfanz (EdWeek 2012); Ed-Fi EWS defaults.
