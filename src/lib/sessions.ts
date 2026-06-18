import { DAYS } from "./constants";

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
