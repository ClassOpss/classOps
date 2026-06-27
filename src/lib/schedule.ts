// A class meets on one or more weekdays, each with its own start time, stored as
// JSON { slots: [{ day, time }] }. Older rows use { days: string[], time } or
// { day, time } (one shared time) — all three are read here.
export type ScheduleSlot = { day: string; time: string };
export type ClassSchedule = {
  slots?: ScheduleSlot[];
  days?: string[];
  day?: string;
  time?: string;
};

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

// Normalize any stored shape to an ordered list of { day, time } slots.
export function scheduleSlots(s: ClassSchedule | null | undefined): ScheduleSlot[] {
  if (!s) return [];
  if (Array.isArray(s.slots)) {
    return s.slots.filter((x) => x && x.day).map((x) => ({ day: x.day, time: x.time ?? "" }));
  }
  const days = Array.isArray(s.days) ? s.days : s.day ? [s.day] : [];
  return days.filter(Boolean).map((d) => ({ day: d, time: s.time ?? "" }));
}

export function scheduleDays(s: ClassSchedule | null | undefined): string[] {
  return scheduleSlots(s).map((x) => x.day);
}

// The start time for the weekday a given (UTC-midnight) session date falls on.
export function scheduleTimeForDate(
  s: ClassSchedule | null | undefined,
  date: Date,
): string | undefined {
  const dayName = DAY_NAMES[date.getUTCDay()];
  const slot = scheduleSlots(s).find((x) => x.day === dayName);
  return slot?.time || undefined;
}

// "16:00" -> "4:00 PM"
function friendly(hhmm: string): string {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function scheduleLabel(s: ClassSchedule | null | undefined): string {
  const slots = scheduleSlots(s);
  if (slots.length === 0) return "—";
  // If every day shares the same time, show it once: "Sun, Tue · 4:00 PM".
  const times = new Set(slots.map((x) => x.time).filter(Boolean));
  if (times.size === 1) {
    const t = [...times][0];
    return `${slots.map((x) => x.day.slice(0, 3)).join(", ")}${t ? ` · ${friendly(t)}` : ""}`;
  }
  return slots.map((x) => `${x.day.slice(0, 3)} ${friendly(x.time)}`).join(", ");
}
