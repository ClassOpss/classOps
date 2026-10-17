// npx tsx scripts/test-grade-boundaries.ts — automatic Edexcel-style boundaries, D floor.
import { autoBoundaries, letterFor, validateBoundaries } from "../src/lib/grade-boundaries";
import { isQuizDate, quizNumber, scheduledQuizDatesBetween } from "../src/lib/quiz";

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.error("FAIL", m); } else console.log("ok  ", m); };
const mins = (b: ReturnType<typeof autoBoundaries>) => b!.map((x) => x.min);

// Few marks -> reference only: 100-mark paper => A 65, C 38, B 52 (rounded), A* 78, D floor.
const ref = autoBoundaries([90, 40], 100)!;
ok(JSON.stringify(mins(ref)) === JSON.stringify([79, 65, 52, 38, 0]), `reference only ${mins(ref)}`);
ok(ref.map((b) => b.grade).join() === "A*,A,B,C,D", "grades A*..D");

// A strong class pulls boundaries up, a weak one pulls them down.
const strong = autoBoundaries(Array.from({ length: 20 }, (_, i) => 60 + i * 2), 100)!;
const weak = autoBoundaries(Array.from({ length: 20 }, (_, i) => 10 + i * 2), 100)!;
ok(strong[1].min > 65 && weak[1].min < 65, `A moves with the class (strong ${strong[1].min}, weak ${weak[1].min})`);
ok(mins(strong).every((m, i, a) => i === 0 || m < a[i - 1]), "strictly falling");

// Small quiz out of 10 still fits A*..C distinct and within the max.
const small = autoBoundaries([3, 5, 6, 7, 8, 9], 10)!;
ok(small[0].min <= 10 && mins(small).every((m, i, a) => i === 0 || m < a[i - 1]), `small paper ${mins(small)}`);
ok(autoBoundaries([1], 3) === null, "max < 4 => none");

// Floor: nothing below D.
ok(letterFor(0, ref) === "D" && letterFor(37, ref) === "D" && letterFor(38, ref) === "C", "below C is D");
ok(letterFor(5, [{ grade: "C", min: 30 }, { grade: "F", min: 0 }]) === "D", "legacy F reads as D");
ok(letterFor(5, [{ grade: "C", min: 30 }]) === "D", "no U");
const v = validateBoundaries([{ grade: "A", min: "60" }, { grade: "C", min: "30" }, { grade: "D", min: "10" }], 100);
ok("boundaries" in v && v.boundaries.at(-1)!.grade === "D" && v.boundaries.at(-1)!.min === 0, "override gets D floor");

// Cadence: weekly vs biweekly.
const start = new Date(Date.UTC(2026, 8, 6));
const d = (n: number) => new Date(Date.UTC(2026, 8, 6 + n));
ok(isQuizDate(start, d(7), 7) && !isQuizDate(start, d(7), 14) && isQuizDate(start, d(14)), "weekly vs biweekly dates");
ok(quizNumber(start, d(21), 7) === 4 && quizNumber(start, d(28)) === 3, "quiz numbering per cadence");
ok(scheduledQuizDatesBetween(start, start, d(28), 7).length === 5, "5 weekly dates in 4 weeks");

if (fail) { console.error(`${fail} failed`); process.exit(1); }
console.log("all passed");
