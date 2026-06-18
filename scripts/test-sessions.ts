import { generateSessionDates } from "../src/lib/sessions";
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

console.log("\nALL SESSION TESTS PASSED");
