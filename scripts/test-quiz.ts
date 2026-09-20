import {
  isQuizDate,
  prepDeadlineDate,
  quizForPrepDeadlineDay,
  nextQuizDate,
  quizDatesBetween,
  weekdayName,
  quizPrepComplete,
  addDays,
} from "../src/lib/quiz";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const d = (s: string) => new Date(s + "T00:00:00.000Z");
const iso = (x: Date) => x.toISOString().slice(0, 10);

// First quiz 2026-09-24 (a Thursday). Cadence = every 14 days.
const start = d("2026-09-24");
assert(weekdayName(start) === "Thursday", "2026-09-24 is a Thursday");

// isQuizDate: the anchor and every +14; nothing in between; nothing before.
assert(isQuizDate(start, d("2026-09-24")), "anchor is a quiz date");
assert(isQuizDate(start, d("2026-10-08")), "+14 is a quiz date");
assert(isQuizDate(start, d("2026-10-22")), "+28 is a quiz date");
assert(!isQuizDate(start, d("2026-10-01")), "+7 is NOT a quiz date (biweekly)");
assert(!isQuizDate(start, d("2026-09-10")), "before the anchor is not a quiz date");

// Prep deadline day = quiz − 3 days.
assert(iso(prepDeadlineDate(d("2026-09-24"))) === "2026-09-21", "prep day = quiz − 3 (Sep 21)");
assert(iso(prepDeadlineDate(d("2026-10-08"))) === "2026-10-05", "next prep day (Oct 5)");

// quizForPrepDeadlineDay: only the exact prep-deadline day maps to its quiz date.
assert(iso(quizForPrepDeadlineDay(start, d("2026-09-21"))!) === "2026-09-24", "Sep 21 -> quiz Sep 24");
assert(quizForPrepDeadlineDay(start, d("2026-09-22")) === null, "Sep 22 is not a prep-deadline day");
assert(iso(quizForPrepDeadlineDay(start, d("2026-10-05"))!) === "2026-10-08", "Oct 5 -> quiz Oct 8");

// nextQuizDate.
assert(iso(nextQuizDate(start, d("2026-09-01"))) === "2026-09-24", "before anchor -> anchor");
assert(iso(nextQuizDate(start, d("2026-09-24"))) === "2026-09-24", "on a quiz date -> itself");
assert(iso(nextQuizDate(start, d("2026-09-25"))) === "2026-10-08", "day after -> next cycle");

// quizDatesBetween is inclusive and steps by 14.
assert(
  quizDatesBetween(start, d("2026-09-24"), d("2026-10-22")).map(iso).join(",") ===
    "2026-09-24,2026-10-08,2026-10-22",
  "between: 24 Sep, 8 Oct, 22 Oct",
);
assert(quizDatesBetween(start, d("2026-09-01"), d("2026-09-20")).length === 0, "no cycles before the anchor window");

// addDays doesn't mutate its input.
const base = d("2026-09-24");
addDays(base, 5);
assert(iso(base) === "2026-09-24", "addDays is pure");

// Completeness needs BOTH steps.
assert(quizPrepComplete({ quizCreated: true, sentToPrint: true }), "both -> complete");
assert(!quizPrepComplete({ quizCreated: true, sentToPrint: false }), "one -> incomplete");
assert(!quizPrepComplete(null), "missing -> incomplete");

console.log("\nALL QUIZ TESTS PASSED");
