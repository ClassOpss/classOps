import { generateSessionDates, weeklySlotDates } from "../src/lib/sessions";
import { displayedLessonNumbers } from "../src/lib/lesson-number";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);

// planStartDate 2026-09-13 is a Sunday; class meets Sunday -> first session is that day.
const sun = generateSessionDates(new Date("2026-09-13"), "Sunday", 3);
assert(iso(sun[0]) === "2026-09-13", "first Sunday on/after start = start");
assert(iso(sun[1]) === "2026-09-20" && iso(sun[2]) === "2026-09-27", "weekly +7");

// Start mid-week, class on Tuesday -> snap forward to first Tuesday.
const tue = generateSessionDates(new Date("2026-09-13"), "Tuesday", 2); // 13th = Sun
assert(iso(tue[0]) === "2026-09-15", "snaps forward to first Tuesday (15th)");
assert(iso(tue[1]) === "2026-09-22", "then weekly");

// Day-off cascade: middle session off -> later numbers shift down; off shows null.
const nums = displayedLessonNumbers([
  { dayOff: false },
  { dayOff: false },
  { dayOff: true },
  { dayOff: false },
]);
assert(JSON.stringify(nums) === JSON.stringify([1, 2, null, 3]), "cascade [1,2,null,3]");

// Multi-slot: class meets Sunday + Wednesday, starting Sun 2026-09-13.
const ms = weeklySlotDates(new Date("2026-09-13"), ["Sunday", "Wednesday"], 5);
assert(
  ms.map(iso).join(",") === "2026-09-13,2026-09-16,2026-09-20,2026-09-23,2026-09-27",
  "Sun+Wed slots: 13,16,20,23,27 Sep",
);
// Start mid-week (Mon 14th) with Sun+Wed -> first emitted is Wed 16th.
const ms2 = weeklySlotDates(new Date("2026-09-14"), ["Wednesday", "Sunday"], 3);
assert(ms2.map(iso).join(",") === "2026-09-16,2026-09-20,2026-09-23", "order independent of input order");

console.log("\nALL SESSION TESTS PASSED");
