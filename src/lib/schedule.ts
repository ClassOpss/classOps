// A class meets on one or more weekdays at a single time, stored as JSON
// { days: string[], time: string }. Older rows may use { day, time } — read both.
export type ClassSchedule = { days?: string[]; day?: string; time?: string };

export function scheduleDays(s: ClassSchedule | null | undefined): string[] {
  if (!s) return [];
  if (Array.isArray(s.days)) return s.days.filter(Boolean);
  return s.day ? [s.day] : [];
}

export function scheduleTime(s: ClassSchedule | null | undefined): string | undefined {
  return s?.time ?? undefined;
}

export function scheduleLabel(s: ClassSchedule | null | undefined): string {
  const days = scheduleDays(s);
  if (days.length === 0) return "—";
  return `${days.join(", ")}${s?.time ? ` ${s.time}` : ""}`;
}
