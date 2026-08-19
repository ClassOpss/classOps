import { weeklySlotDates } from "./sessions";

// A session is "delivered" (locked) once it's on/before today, or carries any logged
// record. Locked sessions are the past — edits only ever rewrite the undelivered future,
// so no attendance/grades are ever at risk. `today` is a UTC-midnight Cairo date.
export function isLocked(s: { scheduledDate: Date; hasData: boolean }, today: Date): boolean {
  return s.scheduledDate.getTime() <= today.getTime() || s.hasData;
}

// Lays out calendar dates for the *future* (undelivered) portion of a class's schedule.
// Given an ordered list of sessions to place, each session either:
//   • carries a `pinnedDate` (day-offs are real holiday dates) — it keeps that exact date
//     and consumes that slot; or
//   • floats — it takes the next free class-meeting date, in list order.
// This is the shared primitive behind inserting a class-specific lesson (push the rest
// back a slot) and re-syncing the future from the plan. Delivered sessions are never
// passed in here — the caller keeps those fixed. All dates are UTC-midnight (date-only).
export function layoutFutureDates(
  specs: { pinnedDate?: Date | null }[],
  firstSlot: Date,
  days: string[],
): Date[] {
  const total = specs.length;
  if (total === 0) return [];

  // A generous pool of class-meeting dates starting at the first free future slot.
  const slots = weeklySlotDates(firstSlot, days, total + 14);
  const pinned = new Set(
    specs
      .map((s) => s.pinnedDate)
      .filter((d): d is Date => !!d)
      .map((d) => d.getTime()),
  );
  const free = slots.filter((d) => !pinned.has(d.getTime()));

  const out: Date[] = [];
  let fi = 0;
  for (const s of specs) {
    out.push(s.pinnedDate ?? free[fi++]);
  }
  return out;
}

// The next class-meeting date strictly after `after` (used to append a lesson at the end).
export function nextSlotAfter(after: Date, days: string[]): Date | undefined {
  const day = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate() + 1),
  );
  return weeklySlotDates(day, days, 1)[0];
}
