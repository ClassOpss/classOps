import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { getConfig } from "@/lib/config";

// All timestamps are stored UTC; the operation runs in its configured time zone.
export const CAIRO_TZ = getConfig().timeZone;

const pad = (n: number) => String(n).padStart(2, "0");

export function formatCairo(date: Date, fmt = "d MMM yyyy, h:mm a"): string {
  return formatInTimeZone(date, getConfig().timeZone, fmt);
}

function zonedInstant(scheduledDate: Date, hms: string): Date {
  const y = scheduledDate.getUTCFullYear();
  const m = pad(scheduledDate.getUTCMonth() + 1);
  const d = pad(scheduledDate.getUTCDate());
  return fromZonedTime(`${y}-${m}-${d}T${hms}`, getConfig().timeZone);
}

// When the class actually starts (its scheduled time on the session day, Cairo).
// Attendance can't be logged before this — the class hasn't happened yet.
export function sessionStart(scheduledDate: Date, time?: string): Date {
  const hms = time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "00:00:00";
  return zonedInstant(scheduledDate, hms);
}

// Daily-task deadline on a session's scheduled calendar day (default 9pm, spec 5.10).
export function sessionDeadline(scheduledDate: Date): Date {
  return zonedInstant(scheduledDate, `${pad(getConfig().dailyDeadlineHour)}:00:00`);
}

// Weekly-task deadline (HW correction / grade entry, spec 5.10): the configured weekday
// (default Saturday) + hour, in the week containing `date`. On that weekday it's the same day.
export function saturdayDeadline(date: Date): Date {
  const { weeklyDeadlineWeekday, weeklyDeadlineHour } = getConfig();
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  base.setUTCDate(base.getUTCDate() + ((weeklyDeadlineWeekday - base.getUTCDay() + 7) % 7));
  return zonedInstant(base, `${pad(weeklyDeadlineHour)}:00:00`);
}

export function isLate(loggedAt: Date, deadline: Date): boolean {
  return loggedAt.getTime() > deadline.getTime();
}
