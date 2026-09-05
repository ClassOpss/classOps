import {
  vacationDaysInMonth,
  vacationFractionOff,
  isSchoolOnVacation,
  type VacationSpan,
} from "../src/lib/vacations";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const D = (s: string) => new Date(s + "T00:00:00.000Z");
const span = (schoolId: string, start: string, end: string): VacationSpan => ({
  schoolId,
  startDate: D(start),
  endDate: D(end),
});

// ── fraction off: the user's spec ──
assert(vacationFractionOff(0) === 0, "0 days -> no deduction");
assert(vacationFractionOff(7) === 0.25, "1 week (7d) -> 1/4 off");
assert(vacationFractionOff(14) === 0.5, "2 weeks (14d) -> 1/2 off");
assert(vacationFractionOff(21) === 0.75, "3 weeks (21d) -> 3/4 off");
assert(vacationFractionOff(28) === 1, "4 weeks (28d) -> full base off");
assert(vacationFractionOff(31) === 1, "whole calendar month -> capped at full base off");

// ── days-in-month counting (inclusive spans) ──
// Easter: 7 inclusive days in April.
const easter = [span("S1", "2026-04-06", "2026-04-12")];
assert(vacationDaysInMonth("S1", 4, 2026, easter) === 7, "7-day break counts as 7 days in its month");
assert(vacationDaysInMonth("S1", 5, 2026, easter) === 0, "no vacation days in an unaffected month");
assert(vacationDaysInMonth("S2", 4, 2026, easter) === 0, "other school unaffected");

// Straddling a month boundary: only the in-month days count.
const straddle = [span("S1", "2026-04-28", "2026-05-04")]; // Apr 28-30 = 3 days, May 1-4 = 4 days
assert(vacationDaysInMonth("S1", 4, 2026, straddle) === 3, "straddle: only April days counted");
assert(vacationDaysInMonth("S1", 5, 2026, straddle) === 4, "straddle: only May days counted");

// Overlapping breaks in one month de-duplicate (can't exceed real days).
const overlap = [span("S1", "2026-04-06", "2026-04-12"), span("S1", "2026-04-10", "2026-04-16")];
assert(vacationDaysInMonth("S1", 4, 2026, overlap) === 11, "overlapping breaks de-duplicate (6..16 = 11 days)");

// ── isSchoolOnVacation (session-date suppression) ──
assert(isSchoolOnVacation("S1", D("2026-04-06"), easter), "start day is on vacation");
assert(isSchoolOnVacation("S1", D("2026-04-12"), easter), "end day is on vacation (inclusive)");
assert(!isSchoolOnVacation("S1", D("2026-04-13"), easter), "day after break is not on vacation");
assert(!isSchoolOnVacation("S2", D("2026-04-08"), easter), "different school not on vacation");

console.log("\nALL VACATION TESTS PASSED");
