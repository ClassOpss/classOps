import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { APP_LOCALE, OPERATION_DEFAULTS } from "@/lib/config";

// All timestamps are stored UTC; display + day-boundary math use the shared app
// timezone (the one config value that is NOT per-operation — see config.ts).
export const CAIRO_TZ = APP_LOCALE.timeZone;

const pad = (n: number) => String(n).padStart(2, "0");

export function formatCairo(date: Date, fmt = "d MMM yyyy, h:mm a"): string {
  return formatInTimeZone(date, CAIRO_TZ, fmt);
}

function zonedInstant(scheduledDate: Date, hms: string): Date {
  const y = scheduledDate.getUTCFullYear();
  const m = pad(scheduledDate.getUTCMonth() + 1);
  const d = pad(scheduledDate.getUTCDate());
  return fromZonedTime(`${y}-${m}-${d}T${hms}`, CAIRO_TZ);
}

// When the class actually starts (its scheduled time on the session day, Cairo).
// Attendance can't be logged before this — the class hasn't happened yet.
export function sessionStart(scheduledDate: Date, time?: string): Date {
  const hms = time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "00:00:00";
  return zonedInstant(scheduledDate, hms);
}

// The deadline-timing knobs are per-operation. Callers pass the resolved operation
// config (resolveConfig()); the defaults keep single-tenant / pre-resolution behavior.
type DailyDeadlineCfg = { dailyDeadlineHour: number };
type WeeklyDeadlineCfg = { weeklyDeadlineWeekday: number; weeklyDeadlineHour: number };

// Daily-task deadline on a session's scheduled calendar day (default 9pm, spec 5.10).
export function sessionDeadline(
  scheduledDate: Date,
  cfg: DailyDeadlineCfg = OPERATION_DEFAULTS,
): Date {
  return zonedInstant(scheduledDate, `${pad(cfg.dailyDeadlineHour)}:00:00`);
}

// Weekly-task deadline (HW correction / grade entry, spec 5.10): the configured weekday
// (default Saturday) + hour, in the week containing `date`. On that weekday it's the same day.
export function saturdayDeadline(
  date: Date,
  cfg: WeeklyDeadlineCfg = OPERATION_DEFAULTS,
): Date {
  const { weeklyDeadlineWeekday, weeklyDeadlineHour } = cfg;
  const base = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  base.setUTCDate(base.getUTCDate() + ((weeklyDeadlineWeekday - base.getUTCDay() + 7) % 7));
  return zonedInstant(base, `${pad(weeklyDeadlineHour)}:00:00`);
}

export function isLate(loggedAt: Date, deadline: Date): boolean {
  return loggedAt.getTime() > deadline.getTime();
}
