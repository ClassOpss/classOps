// Grade boundaries per assessment, in RAW marks. AUTOMATIC by default, set the way
// Edexcel sets IGCSE (legacy A*–G) boundaries, then floored at D:
//
//   1. Two KEY boundaries — A and C — are fixed by judgement + the cohort's marks. Here the
//      "judgement" is Edexcel's typical Higher-tier position (A ≈ 65%, C ≈ 38% of the max),
//      and the cohort evidence is this class's marks: the mark the top 40% reach (A) and the
//      top 80% reach (C). The two are blended, trusting the class more as it gets bigger
//      (50/50 from 20 marked students; reference only below 5).
//   2. The rest are ARITHMETIC, as in Edexcel's rules: B halfway between A and C,
//      A* one A–B interval above A, D one interval below C.
//   3. No grade below D (user decision): anything under C is a D — never E/F/G/U.
//
// A manually saved set (Assessment.gradeBoundaries) overrides the automatic one.
// Pure — safe for client and server.

export const GRADES = ["A*", "A", "B", "C", "D"] as const;
export const LOWEST_GRADE = "D";
export type Boundary = { grade: string; min: number };

// Edexcel IGCSE Mathematics A Higher, typical key boundaries as a share of the max mark.
const REF_A = 0.65;
const REF_C = 0.38;
// Share of the class expected to reach each key grade (the cohort's evidence).
const TOP_SHARE_A = 0.4;
const TOP_SHARE_C = 0.8;
// Class weight in the blend: 0 below MIN_CLASS marks, rising to MAX_CLASS_WEIGHT at FULL_CLASS.
const MIN_CLASS = 5;
const FULL_CLASS = 20;
const MAX_CLASS_WEIGHT = 0.5;
// Keep key boundaries within sane bounds whatever the class did.
const A_RANGE = [0.5, 0.85] as const;
const C_RANGE = [0.25, 0.6] as const;

// Read the stored JSON defensively; best grade first.
export function parseBoundaries(raw: unknown): Boundary[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter((b): b is Boundary => !!b && typeof b.grade === "string" && typeof b.min === "number")
    .sort((a, b) => b.min - a.min);
  return out.length ? out : null;
}

// Best grade whose minimum the mark reaches; never below D (older saved sets may still list
// E/F/G — they read as D too).
export function letterFor(rawMark: number, boundaries: Boundary[]): string {
  const g = boundaries.find((b) => rawMark >= b.min)?.grade;
  return g && (GRADES as readonly string[]).includes(g) ? g : LOWEST_GRADE;
}

// Mark at the q-quantile (0..1) of the class, linear between neighbours.
function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Automatic boundaries from the class's raw marks (absent students excluded by the caller).
// Null when the max mark is too small to fit A*..C apart.
export function autoBoundaries(marks: number[], maxMark: number): Boundary[] | null {
  if (!(maxMark >= 4)) return null;
  const sorted = marks.filter((m) => Number.isFinite(m)).sort((a, b) => a - b);
  const n = sorted.length;
  const w = n < MIN_CLASS ? 0 : MAX_CLASS_WEIGHT * Math.min(1, n / FULL_CLASS);

  const classA = n ? quantile(sorted, 1 - TOP_SHARE_A) : 0;
  const classC = n ? quantile(sorted, 1 - TOP_SHARE_C) : 0;
  const keyA = clamp((1 - w) * REF_A * maxMark + w * classA, A_RANGE[0] * maxMark, A_RANGE[1] * maxMark);
  const keyC = clamp((1 - w) * REF_C * maxMark + w * classC, C_RANGE[0] * maxMark, C_RANGE[1] * maxMark);

  // Arithmetic grades (Edexcel): equal intervals around the key grades.
  const step = (keyA - keyC) / 2;
  let c = Math.max(1, Math.round(keyC));
  let b = Math.max(c + 1, Math.round(keyC + step));
  let a = Math.max(b + 1, Math.round(keyA));
  let star = Math.max(a + 1, Math.round(keyA + step));
  // Small papers: squeeze down from the top so every grade stays reachable and distinct.
  if (star > maxMark) {
    star = maxMark;
    a = Math.min(a, star - 1);
    b = Math.min(b, a - 1);
    c = Math.min(c, b - 1);
    if (c < 1) return null;
  }
  return [
    { grade: "A*", min: star },
    { grade: "A", min: a },
    { grade: "B", min: b },
    { grade: "C", min: c },
    { grade: "D", min: 0 }, // floor: everything below C
  ];
}

// The set in force: a saved manual override, else the automatic one from the class marks.
export function effectiveBoundaries(
  stored: unknown,
  marks: number[],
  maxMark: number | null,
): { boundaries: Boundary[]; auto: boolean } | null {
  const manual = parseBoundaries(stored);
  if (manual) return { boundaries: manual, auto: false };
  if (maxMark == null) return null;
  const auto = autoBoundaries(marks, maxMark);
  return auto ? { boundaries: auto, auto: true } : null;
}

// Validate an entered override: blanks are skipped; marks must be within the max and
// strictly fall as the grade falls. D is the floor, so its minimum is always 0.
export function validateBoundaries(
  entries: { grade: string; min: string }[],
  maxMark: number,
): { boundaries: Boundary[] } | { error: string } {
  const boundaries: Boundary[] = [];
  for (const e of entries) {
    if (e.grade === LOWEST_GRADE) continue;
    const v = e.min.trim();
    if (!v) continue;
    const min = Number(v);
    if (!Number.isFinite(min) || min < 0) return { error: `${e.grade}: enter a mark of 0 or more.` };
    if (min > maxMark) return { error: `${e.grade}: ${min} is above the max mark (${maxMark}).` };
    const prev = boundaries[boundaries.length - 1];
    if (prev && min >= prev.min) return { error: `${e.grade} (${min}) must be below ${prev.grade} (${prev.min}).` };
    boundaries.push({ grade: e.grade, min });
  }
  if (boundaries.length) boundaries.push({ grade: LOWEST_GRADE, min: 0 });
  return { boundaries };
}
