import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

// All timestamps are stored UTC; the operation runs in Cairo time.
export const CAIRO_TZ = "Africa/Cairo";

export function formatCairo(date: Date, fmt = "d MMM yyyy, h:mm a"): string {
  return formatInTimeZone(date, CAIRO_TZ, fmt);
}

function cairoInstant(scheduledDate: Date, hms: string): Date {
  const y = scheduledDate.getUTCFullYear();
  const m = String(scheduledDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(scheduledDate.getUTCDate()).padStart(2, "0");
  return fromZonedTime(`${y}-${m}-${d}T${hms}`, CAIRO_TZ);
}

// When the class actually starts (its scheduled time on the session day, Cairo).
// Attendance can't be logged before this — the class hasn't happened yet.
export function sessionStart(scheduledDate: Date, time?: string): Date {
  const hms = time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "00:00:00";
  return cairoInstant(scheduledDate, hms);
}

// The 9pm-Cairo deadline on a session's scheduled calendar day, as a UTC instant (spec 5.10).
export function sessionDeadline(scheduledDate: Date): Date {
  return cairoInstant(scheduledDate, "21:00:00");
}

export function isLate(loggedAt: Date, deadline: Date): boolean {
  return loggedAt.getTime() > deadline.getTime();
}
