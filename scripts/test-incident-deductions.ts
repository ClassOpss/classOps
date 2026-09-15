import {
  effectiveDeductionTotal,
  perIncidentCharge,
  type DeductibleIncident,
} from "../src/lib/incident-deductions";
import type { IncidentType } from "@prisma/client";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}

const mk = (
  id: string,
  type: IncidentType,
  opts: Partial<DeductibleIncident> = {},
): DeductibleIncident & { id: string } => ({
  id,
  assistantId: opts.assistantId ?? "A",
  sessionId: opts.sessionId ?? "S1",
  type,
  deductionAmount: opts.deductionAmount ?? 200,
  waived: opts.waived ?? false,
});

// One missed daily task on a day -> 200.
assert(effectiveDeductionTotal([mk("1", "attendance")]) === 200, "one daily task = 200");

// All three daily tasks missed on the SAME session-day -> still 200 (the whole day).
const allThree = [
  mk("1", "attendance"),
  mk("2", "parent_update"),
  mk("3", "classroom_upload"),
];
assert(effectiveDeductionTotal(allThree) === 200, "all 3 daily tasks same day = 200");

// perIncidentCharge: exactly one daily row carries 200, the others carry 0, and the
// per-row charges sum to the day total.
const charge = perIncidentCharge(allThree);
const carried = allThree.filter((i) => (charge.get(i.id) ?? 0) > 0);
assert(carried.length === 1, "one daily row carries the charge");
assert(
  [...charge.values()].reduce((a, b) => a + b, 0) === 200,
  "per-row charges sum to the day cap",
);

// Two different session-days each get their own 200 -> 400.
const twoDays = [
  mk("1", "attendance", { sessionId: "S1" }),
  mk("2", "parent_update", { sessionId: "S1" }),
  mk("3", "attendance", { sessionId: "S2" }),
];
assert(effectiveDeductionTotal(twoDays) === 400, "two session-days = 400");

// Weekly tasks are NOT capped — they add per incident on top of the daily cap.
const mixed = [
  mk("1", "attendance"),
  mk("2", "parent_update"),
  mk("3", "hw_correction"),
  mk("4", "grade_entry"),
];
assert(
  effectiveDeductionTotal(mixed) === 200 + 200 + 200,
  "daily capped once (200) + two weekly (200 each) = 600",
);

// Waiving all of a day's daily rows drops the day to 0.
const waivedDay = [
  mk("1", "attendance", { waived: true }),
  mk("2", "parent_update", { waived: true }),
];
assert(effectiveDeductionTotal(waivedDay) === 0, "waiving all daily rows drops the day");

// Waiving one of a day's daily rows keeps the day at 200 (another row still charges).
const partial = [
  mk("1", "attendance", { waived: true }),
  mk("2", "parent_update", { waived: false }),
];
assert(effectiveDeductionTotal(partial) === 200, "waiving one daily row keeps the day at 200");

// Different assistants on the same session are billed independently.
const twoAssistants = [
  mk("1", "attendance", { assistantId: "A", sessionId: "S1" }),
  mk("2", "attendance", { assistantId: "B", sessionId: "S1" }),
];
assert(effectiveDeductionTotal(twoAssistants) === 400, "two assistants same session = 400");

console.log("\nAll incident-deduction tests passed.");
