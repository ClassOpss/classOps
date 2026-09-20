import {
  isQuizDate,
  nextQuizDate,
  scheduledQuizDatesBetween,
  effectiveQuizDate,
  weekdayName,
  quizPrepComplete,
  quizAnnounced,
  addDays,
} from "../src/lib/quiz";
import { effectiveDeductionTotal, perIncidentCharge } from "../src/lib/incident-deductions";
import { quizPrepDeadline, quizAnnounceDeadline } from "../src/lib/datetime";

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
assert(isQuizDate(start, d("2026-10-08")), "+14 is a scheduled quiz date");
assert(!isQuizDate(start, d("2026-10-01")), "+7 is NOT a scheduled quiz date (biweekly)");
assert(!isQuizDate(start, d("2026-09-10")), "before the anchor is not a quiz date");

// nextQuizDate + enumeration.
assert(iso(nextQuizDate(start, d("2026-09-25"))) === "2026-10-08", "day after -> next cycle");
assert(
  scheduledQuizDatesBetween(start, d("2026-09-24"), d("2026-10-22")).map(iso).join(",") ===
    "2026-09-24,2026-10-08,2026-10-22",
  "scheduled between: 24 Sep, 8 Oct, 22 Oct",
);

// effectiveQuizDate: override wins, else scheduled.
assert(iso(effectiveQuizDate(d("2026-09-24"), null)) === "2026-09-24", "no row -> scheduled date");
assert(iso(effectiveQuizDate(d("2026-09-24"), { quizDate: d("2026-09-26") })) === "2026-09-26", "override wins");

// Deadlines use config leads (default prep 3 / announce 7), at the daily hour (9pm Cairo).
// 24 Sep quiz -> announce deadline 17 Sep, prep deadline 21 Sep.
assert(iso(quizAnnounceDeadline(d("2026-09-24"))).slice(0, 10) === "2026-09-17", "announce deadline = quiz − 7 (17 Sep)");
assert(iso(quizPrepDeadline(d("2026-09-24"))).slice(0, 10) === "2026-09-21", "prep deadline = quiz − 3 (21 Sep)");
// Moving the quiz shifts both deadlines: quiz -> 26 Sep => announce 19, prep 23.
assert(iso(quizAnnounceDeadline(d("2026-09-26"))).slice(0, 10) === "2026-09-19", "moved quiz shifts announce to 19 Sep");
assert(iso(quizPrepDeadline(d("2026-09-26"))).slice(0, 10) === "2026-09-23", "moved quiz shifts prep to 23 Sep");

// Completeness helpers.
assert(quizPrepComplete({ quizCreated: true, sentToPrint: true }), "both steps -> prep complete");
assert(!quizPrepComplete({ quizCreated: true, sentToPrint: false }), "one step -> incomplete");
assert(quizAnnounced({ announcedAt: new Date() }), "announcedAt set -> announced");
assert(!quizAnnounced({ announcedAt: null }), "no announcedAt -> not announced");

// addDays purity.
const base = d("2026-09-24");
addDays(base, 5);
assert(iso(base) === "2026-09-24", "addDays is pure");

// Deduction cap: both quiz sub-tasks for ONE cycle (same quizPrepId) = a SINGLE charge.
const quizIncidents = [
  { id: "a", assistantId: "A", sessionId: null, quizPrepId: "Q1", type: "quiz_announcement" as const, deductionAmount: 200, waived: false },
  { id: "b", assistantId: "A", sessionId: null, quizPrepId: "Q1", type: "quiz_prep" as const, deductionAmount: 200, waived: false },
];
assert(effectiveDeductionTotal(quizIncidents) === 200, "prep + announce for one quiz = one 200 charge");
const charge = perIncidentCharge(quizIncidents);
assert((charge.get("a") ?? 0) + (charge.get("b") ?? 0) === 200, "per-incident charges sum to the cap");

// A different quiz (different quizPrepId) is a separate charge.
const twoQuizzes = [
  ...quizIncidents,
  { id: "c", assistantId: "A", sessionId: null, quizPrepId: "Q2", type: "quiz_prep" as const, deductionAmount: 200, waived: false },
];
assert(effectiveDeductionTotal(twoQuizzes) === 400, "two separate quizzes = two charges");

console.log("\nALL QUIZ TESTS PASSED");
