import { classifyTrend, markBiggestImprover, type TrendPoint } from "../src/lib/class-trend-classify";
import { letterFor, validateBoundaries } from "../src/lib/grade-boundaries";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
// [pct, z, rank] in a class of 12
const P = (rows: [number, number, number][]): TrendPoint[] =>
  rows.map(([pct, z, rank], i) => ({ label: ["Q1", "Q2", "Mock", "Q3", "Q4"][i], pct, z, rank, n: 12 }));
const g = (rows: [number, number, number][]) => classifyTrend(P(rows));

// Cases modelled on the teacher's sheet
assert(g([[95, 1.8, 1], [93, 1.7, 1], [96, 1.9, 1]]).group === "top", "A*/A*/A* = consistently top");
assert(g([[62, 0, 6], [55, -0.4, 9], [82, 1.2, 3]]).group === "improving", "B -> C -> A = improving");
assert(g([[61, 0.2, 5], [48, -0.6, 9], [37, -1.3, 11]]).group === "remedial", "61 -> 48 -> 37 = remedial (below 50 twice)");
assert(g([[72, 0.8, 3], [62, 0, 7], [50, -0.7, 10]]).group === "declining", "72 -> 62 -> 50, still above 50 on Q2 = declining");
assert(g([[70, 0.5, 4], [72, 0.6, 4], [18, -2.2, 12]]).group === "sudden_drop", "normal, normal, 18% = sudden drop");
assert(g([[96, 1.9, 1], [70, 0.1, 6], [74, 0.1, 6]]).group === "watch", "was #1, now 6th = watch");
assert(g([[85, 1, 2], [55, -0.5, 9], [86, 1.1, 2]]).group === "recovered", "dip on Q2 then back = recovered");
assert(g([[63, 0, 6], [60, -0.1, 7], [64, 0.1, 6]]).group === "plateau", "flat middle = plateau");
assert(g([[63, 0, 6], [60, -0.1, 7], [64, 0.1, 6]]).reason.includes("in the middle"), "plateau says where they sit");
assert(g([[90, 1, 2]]).group === "not_enough", "one result = not enough");
// Harder paper: everyone dropped, so raw % fell but standing held -> not declining.
assert(g([[80, 0.3, 5], [65, 0.35, 5], [50, 0.3, 5]]).group !== "declining", "raw % down on harder papers, standing held = not declining");
// Remedial + improving note.
assert(g([[20, -2, 12], [35, -1, 11], [45, -0.3, 8], [48, -0.2, 8]]).reason.includes("improving"), "remedial but improving gets a note");

const rows = [{ trend: g([[50, -1, 10], [70, 0.5, 4], [80, 1, 2]]) }, { trend: g([[60, 0, 6], [64, 0.2, 5], [75, 0.8, 3]]) }];
markBiggestImprover(rows);
assert(rows[0].trend.reason.startsWith("Biggest improver"), "largest improver is called out");

// Boundaries
const b = [{ grade: "A*", min: 80 }, { grade: "A", min: 70 }, { grade: "B", min: 60 }];
assert(letterFor(85, b) === "A*" && letterFor(70, b) === "A" && letterFor(10, b) === "U", "letters from raw-mark boundaries");
assert("error" in validateBoundaries([{ grade: "A*", min: "70" }, { grade: "A", min: "75" }], 100), "boundaries must fall");
assert("error" in validateBoundaries([{ grade: "A*", min: "120" }], 100), "boundary above max mark refused");
const ok = validateBoundaries([{ grade: "A*", min: "80" }, { grade: "A", min: "" }, { grade: "B", min: "60" }], 100);
assert("boundaries" in ok && ok.boundaries.length === 2, "blank grades skipped");

console.log("all class-trend tests passed");
