import type { HwStatus } from "@prisma/client";

// Student HW submission status (spec 4.10). All dates are date-only (UTC midnight).
// Returns null = "pending" (not submitted, deadline not yet passed) — no row is stored.
export function hwStatus(
  submissionDate: Date | null,
  deadline: Date,
  now: Date,
): HwStatus | null {
  if (submissionDate) {
    return submissionDate.getTime() <= deadline.getTime() ? "on_time" : "late";
  }
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return todayUTC > deadline.getTime() ? "missing" : null;
}
