import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

// All timestamps are stored UTC; the operation runs in Cairo time.
export const CAIRO_TZ = "Africa/Cairo";

export function formatCairo(date: Date, fmt = "d MMM yyyy, h:mm a"): string {
  return formatInTimeZone(date, CAIRO_TZ, fmt);
}

// The 9pm-Cairo deadline on a session's scheduled calendar day, as a UTC instant
// (spec 5.10). scheduledDate is date-only (UTC midnight), so read its calendar parts in UTC.
export function sessionDeadline(scheduledDate: Date): Date {
  const y = scheduledDate.getUTCFullYear();
  const m = String(scheduledDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(scheduledDate.getUTCDate()).padStart(2, "0");
  return fromZonedTime(`${y}-${m}-${d}T21:00:00`, CAIRO_TZ);
}

export function isLate(loggedAt: Date, deadline: Date): boolean {
  return loggedAt.getTime() > deadline.getTime();
}
