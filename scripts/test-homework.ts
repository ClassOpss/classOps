import { saturdayDeadline, formatCairo } from "../src/lib/datetime";
import { hwStatus } from "../src/lib/homework";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const d = (s: string) => new Date(s);

// Saturday-of-the-week (Sun..Sat) at 9pm Cairo.
// 2026-06-16 is a Tuesday; that week's Saturday is 2026-06-20.
assert(
  formatCairo(saturdayDeadline(d("2026-06-16")), "yyyy-MM-dd HH:mm") === "2026-06-20 21:00",
  "Tue 16 Jun -> Sat 20 Jun 21:00 Cairo",
);
// On the Saturday itself it stays the same day.
assert(
  formatCairo(saturdayDeadline(d("2026-06-20")), "yyyy-MM-dd HH:mm") === "2026-06-20 21:00",
  "Sat 20 Jun -> same Sat 21:00",
);
// Sunday is the start of the next week -> its own week's Saturday (26 Jun... 21 Jun is Sun).
assert(
  formatCairo(saturdayDeadline(d("2026-06-21")), "yyyy-MM-dd HH:mm") === "2026-06-27 21:00",
  "Sun 21 Jun -> Sat 27 Jun 21:00",
);

// HW status
assert(hwStatus(d("2026-06-20"), d("2026-06-20"), d("2026-06-25")) === "on_time", "submitted on deadline = on_time");
assert(hwStatus(d("2026-06-21"), d("2026-06-20"), d("2026-06-25")) === "late", "submitted after deadline = late");
assert(hwStatus(null, d("2026-06-20"), d("2026-06-22T10:00:00Z")) === "missing", "not submitted, past deadline = missing");
assert(hwStatus(null, d("2026-06-20"), d("2026-06-20T10:00:00Z")) === null, "not submitted, on deadline day = pending(null)");
assert(hwStatus(null, d("2026-06-20"), d("2026-06-19T10:00:00Z")) === null, "not submitted, before deadline = pending(null)");

console.log("\nALL HOMEWORK TESTS PASSED");
