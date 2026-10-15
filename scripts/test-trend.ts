import { classGradeSeries, gradeTrend, hwTrend, looZ, pooledNoise, DEFAULT_NOISE } from "../src/lib/trend";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const pts = (zs: number[]) => zs.map((z) => ({ z, pct: 50 }));
const N = DEFAULT_NOISE; // 0.6

// ── Standardisation ──
assert(looZ(80, [60, 70]) === null, "fewer than 3 others -> can't standardise");
assert(Math.abs(looZ(70, [50, 60, 70])! - 1) < 1e-9, "70 vs others mean 60, SD 10 -> z = +1");
// Same +10 gap, but a tightly-bunched quiz means more than a spread-out one.
assert(looZ(70, [58, 60, 62])! > looZ(70, [40, 60, 80])!, "same gap, tighter class -> larger z");
// Leave-one-out: in a small class the student must not pull their own baseline.
{
  const s = classGradeSeries([
    { grades: [{ studentId: "a", pct: 100 }, { studentId: "b", pct: 50 }, { studentId: "c", pct: 50 }, { studentId: "d", pct: 50 }] },
  ]);
  assert(s.get("a")![0].z === 3, "top scorer vs others (not incl. self), capped at +3");
}

// ── Grade trend ──
assert(gradeTrend(pts([0, 0, 1, 1]), N) === null, "4 assessments -> not enough data (need 5)");
assert(gradeTrend(pts([-1, -1, 0.4, 0.5, 0.6]), N)?.label === "improving", "-1 SD -> +0.5 SD = improving");
assert(gradeTrend(pts([1, 0.8, -0.3, -0.4, -0.2]), N)?.label === "slipping", "+0.9 SD -> -0.3 SD = slipping");
// v1 bug: one bad quiz in a steady run flipped the label.
assert(gradeTrend(pts([0.8, 0.9, 0.8, 0.9, -0.5, 0.8]), N)?.label === "steady_above", "one dip doesn't flip steady");
assert(gradeTrend(pts([-0.9, -0.8, -1, -0.9, -0.8]), N)?.label === "steady_below", "flat -0.9 = stuck below");
assert(gradeTrend(pts([0.1, -0.1, 0, 0.1, -0.1]), N)?.label === "steady_level", "flat ~0 = at class level");
// Same change is NOT reliable for a student in a very noisy class.
assert(gradeTrend(pts([-0.5, -0.4, 0.3, 0.4, 0.4]), 0.4)?.label === "improving", "+0.8 change, low-noise class -> improving");
assert(gradeTrend(pts([-0.5, -0.4, 0.3, 0.4, 0.4]), 1.2)?.label !== "improving", "+0.8 change, very noisy class -> not called");
// Small but statistically clean change still needs a meaningful size (≥0.5 SD).
assert(gradeTrend(pts([0, 0, 0, 0, 0, 0.3, 0.3, 0.3]), 0.3)?.label === "steady_level", "+0.3 SD is too small to call");

// ── Noise ──
assert(pooledNoise([pts([0, 0])]) === DEFAULT_NOISE, "too little data -> default noise");
assert(Math.abs(pooledNoise([pts([1, -1, 1, -1, 1, -1])]) - Math.sqrt(6 / 5)) < 1e-9, "pooled SD of a bouncing student");

// ── Homework ──
const T = true, F = false;
assert(hwTrend([T, T, T, T, T, T, F]) === null, "7 HW -> not enough data (need 8)");
// v1 bug: a single miss after a clean run was "slipping".
assert(hwTrend([T, T, T, T, T, T, T, T, T, F])?.label === "steady", "one miss after 9 clean = steady");
assert(hwTrend([T, T, T, T, T, T, T, T, F, T, F])?.label === "slipping", "two of last four missed = slipping");
assert(hwTrend([F, F, T, F, F, F, T, T, T, T])?.label === "improving", "mostly missing -> all in = improving");
assert(hwTrend([T, F, T, T, F, T, T, F, T, T, F, T])?.label === "steady", "same ~70% rate throughout = steady");

console.log("all trend tests passed");
