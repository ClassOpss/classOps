import { assignResponsibilities } from "../src/lib/responsibility";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const S = (iso: string, dayOff = false) => ({ scheduledDate: new Date(iso), dayOff });

// 2 assistants, Tue + Thu -> A owns Tuesdays, B owns Thursdays.
// 2026-09-15 Tue, 17 Thu, 22 Tue, 24 Thu
const tueThu = [S("2026-09-15"), S("2026-09-17"), S("2026-09-22"), S("2026-09-24")];
assert(
  JSON.stringify(assignResponsibilities(tueThu, ["A", "B"])) === JSON.stringify(["A", "B", "A", "B"]),
  "Tue+Thu -> A=Tue, B=Thu (every week)",
);

// Single weekday (Sundays) -> alternate weekly.
const sundays = [S("2026-09-13"), S("2026-09-20"), S("2026-09-27"), S("2026-10-04")];
assert(
  JSON.stringify(assignResponsibilities(sundays, ["A", "B"])) === JSON.stringify(["A", "B", "A", "B"]),
  "single weekday -> alternate weekly",
);

// Day-off in a single-weekday class doesn't flip the alternation; the off day is null.
const withOff = [S("2026-09-13"), S("2026-09-20", true), S("2026-09-27"), S("2026-10-04")];
assert(
  JSON.stringify(assignResponsibilities(withOff, ["A", "B"])) === JSON.stringify(["A", null, "B", "A"]),
  "day-off is null and doesn't advance the alternation",
);

// One assistant -> owns all (day-off null).
assert(
  JSON.stringify(assignResponsibilities(sundays, ["A"])) === JSON.stringify(["A", "A", "A", "A"]),
  "single assistant owns all",
);

console.log("\nALL RESPONSIBILITY TESTS PASSED");
