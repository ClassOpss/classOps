import { DAYS } from "./constants";

// Dates for a class that meets on several weekdays a week (e.g. Sun + Wed). Walks the
// calendar from `start`, emitting each date whose weekday is one of `dayNames`, until
// `count` dates are produced. Natural weekly ordering (Sun, then Wed, then next week…).
export function weeklySlotDates(start: Date, dayNames: string[], count: number): Date[] {
  const dows = new Set(
    dayNames.map((d) => DAYS.indexOf(d as (typeof DAYS)[number])).filter((x) => x >= 0),
  );
  if (dows.size === 0) return [];

  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const out: Date[] = [];
  let guard = 0;
  while (out.length < count && guard < count * 7 + 7) {
    if (dows.has(d.getUTCDay())) out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
    guard++;
  }
  return out;
}

// Weekly session dates for a class: the first occurrence of `dayName` on/after
// `start`, then +7 days each, `count` times. All math in UTC (dates are date-only).
export function generateSessionDates(start: Date, dayName: string, count: number): Date[] {
  const targetDow = DAYS.indexOf(dayName as (typeof DAYS)[number]);
  if (targetDow === -1) return [];

  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  while (d.getUTCDay() !== targetDow) d.setUTCDate(d.getUTCDate() + 1);

  const out: Date[] = [];
  for (let i = 0; i < count; i++) {
    out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return out;
}
