import { layoutFutureDates, nextSlotAfter } from "../src/lib/session-timeline";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (s: string) => new Date(s + "T00:00:00.000Z");

// Class meets Sunday only, future starts Sun 2026-09-13. Three floating lessons ->
// three consecutive Sundays.
const a = layoutFutureDates([{}, {}, {}], D("2026-09-13"), ["Sunday"]);
assert(a.map(iso).join(",") === "2026-09-13,2026-09-20,2026-09-27", "3 floats on consecutive Sundays");

// Insert pushes back: 4 floats (one inserted) -> four consecutive Sundays.
const b = layoutFutureDates([{}, {}, {}, {}], D("2026-09-13"), ["Sunday"]);
assert(b.map(iso).join(",") === "2026-09-13,2026-09-20,2026-09-27,2026-10-04", "insert pushes tail back a week");

// Day-off pinned in the middle keeps its date; floats flow around it and skip that slot.
// Slots: 13, 20, 27. Middle (20th) is a pinned day-off; two floats take 13 and 27.
const c = layoutFutureDates(
  [{}, { pinnedDate: D("2026-09-20") }, {}],
  D("2026-09-13"),
  ["Sunday"],
);
assert(c.map(iso).join(",") === "2026-09-13,2026-09-20,2026-09-27", "pinned day-off keeps date; floats skip its slot");

// Multi-weekday: Sun + Wed, four floats -> Sun 13, Wed 16, Sun 20, Wed 23.
const d = layoutFutureDates([{}, {}, {}, {}], D("2026-09-13"), ["Sunday", "Wednesday"]);
assert(d.map(iso).join(",") === "2026-09-13,2026-09-16,2026-09-20,2026-09-23", "multi-weekday consecutive slots");

// nextSlotAfter: after Sun 13th, next Sunday is the 20th.
assert(iso(nextSlotAfter(D("2026-09-13"), ["Sunday"])!) === "2026-09-20", "nextSlotAfter -> following Sunday");
// After a non-meeting day (Mon 14th), next Sun is still the 20th.
assert(iso(nextSlotAfter(D("2026-09-14"), ["Sunday"])!) === "2026-09-20", "nextSlotAfter from mid-week");

console.log("\nALL TIMELINE TESTS PASSED");
