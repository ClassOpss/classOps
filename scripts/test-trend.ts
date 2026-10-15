import { gradeTrend, hwTrend } from "../src/lib/trend";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const g = (pct: number, classAvg: number) => ({ pct, classAvg });

// Grades
assert(gradeTrend([g(60, 60), g(70, 60), g(80, 60)]) === null, "3 assessments -> not enough data");
assert(gradeTrend([g(50, 60), g(55, 60), g(65, 60), g(72, 60)])?.label === "improving", "gap -10 -> +12 = improving");
assert(gradeTrend([g(80, 60), g(75, 62), g(62, 60), g(50, 58)])?.label === "slipping", "gap +20 -> -8 = slipping");
// Raw % falls 80 -> 60, but the quizzes got harder: gap rises -> NOT slipping.
assert(
  gradeTrend([g(80, 85), g(75, 75), g(70, 62), g(60, 45)])?.label === "improving",
  "raw % down but gap up (harder quizzes) = improving",
);
assert(gradeTrend([g(70, 60), g(72, 61), g(69, 60), g(71, 61)])?.label === "steady_above", "flat +10 = steady above");
assert(gradeTrend([g(50, 60), g(49, 61), g(51, 60), g(50, 61)])?.label === "steady_below", "flat -10 = stuck below");
assert(gradeTrend([g(60, 60), g(61, 60), g(59, 60), g(60, 60)])?.label === "steady_level", "flat 0 = at class level");
// One bad outlier in a steady run shouldn't flip it.
assert(
  gradeTrend([g(70, 60), g(71, 60), g(55, 60), g(70, 60), g(71, 60)])?.label === "steady_above",
  "single dip doesn't flip steady",
);
// Window is the latest 6: an old slump doesn't count.
assert(
  gradeTrend([g(20, 60), g(20, 60), g(70, 60), g(70, 60), g(70, 60), g(70, 60), g(70, 60), g(70, 60)])?.label ===
    "steady_above",
  "old slump outside window ignored",
);

// Homework
assert(hwTrend(["on_time", "on_time", "missing", "missing", "missing"]) === null, "5 HW -> not enough data");
assert(
  hwTrend(["on_time", "on_time", "on_time", "on_time", "missing", "late", "missing", "missing"])?.label === "slipping",
  "on time -> missing = slipping",
);
assert(
  hwTrend(["missing", "missing", "late", "on_time", "on_time", "on_time"])?.label === "improving",
  "missing -> on time = improving",
);
assert(
  hwTrend(["on_time", "late", "on_time", "on_time", "late", "on_time"])?.label === "steady",
  "mixed but flat = steady",
);

console.log("all trend tests passed");
