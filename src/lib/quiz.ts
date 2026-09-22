// Biweekly quiz cadence + per-cycle model. A class opts in by setting `quizStartDate`
// (the date of its FIRST quiz); cycles recur every 14 days. Each cycle is identified by its
// SCHEDULED date (quizStartDate + 14·n) — a stable key that never changes. The ACTUAL quiz
// date defaults to the scheduled date but admin/teacher can override it for a one-off move,
// which shifts only that cycle's deadlines (later cycles stay on the cadence).
//
// Each cycle carries three shared sub-tasks with their own deadlines before the actual date:
//   • announcement — send the WhatsApp announcement (quizAnnounceLeadDays before, default 7)
//   • prep         — create the quiz + send it to print (quizPrepLeadDays before, default 3)
//
// This module is dependency-light (only lib/constants) so server actions, datetime and
// components can all import it without a cycle. Deadline *times* live in lib/datetime.

import { DAYS } from "@/lib/constants";

export const QUIZ_CADENCE_DAYS = 14; // biweekly
// Fallbacks for UI copy when an operation config isn't in hand; real deadlines read config.
export const DEFAULT_QUIZ_PREP_LEAD_DAYS = 3;
export const DEFAULT_QUIZ_ANNOUNCE_LEAD_DAYS = 7;

const MS_PER_DAY = 86_400_000;

// Add n days to a UTC-midnight @db.Date value, returning a fresh UTC-midnight Date.
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

// Weekday name (Sunday…Saturday) for a UTC-midnight date — matches DAYS + schedule labels.
export function weekdayName(d: Date): string {
  return DAYS[d.getUTCDay()];
}

export function quizEnabled(c: { quizStartDate: Date | null }): boolean {
  return c.quizStartDate != null;
}

// Is `date` (UTC-midnight) one of this class's SCHEDULED (cadence) quiz dates?
export function isQuizDate(quizStartDate: Date, date: Date): boolean {
  const diff = dayDiff(quizStartDate, date);
  return diff >= 0 && diff % QUIZ_CADENCE_DAYS === 0;
}

// 1-based position of a cadence date in the class's quiz sequence ("Quiz 3").
export function quizNumber(quizStartDate: Date, scheduledDate: Date): number {
  return Math.floor(dayDiff(quizStartDate, scheduledDate) / QUIZ_CADENCE_DAYS) + 1;
}

// The next SCHEDULED quiz date on/after `from` (UTC-midnight).
export function nextQuizDate(quizStartDate: Date, from: Date): Date {
  if (from <= quizStartDate) return quizStartDate;
  const cycles = Math.ceil(dayDiff(quizStartDate, from) / QUIZ_CADENCE_DAYS);
  return addDays(quizStartDate, cycles * QUIZ_CADENCE_DAYS);
}

// All SCHEDULED quiz dates in [from, to] inclusive (UTC-midnight). Callers resolve each to
// its effective (possibly-overridden) date via the stored QuizPrep row.
export function scheduledQuizDatesBetween(quizStartDate: Date, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  if (to < quizStartDate) return out;
  let d = nextQuizDate(quizStartDate, from);
  while (d.getTime() <= to.getTime()) {
    out.push(new Date(d));
    d = addDays(d, QUIZ_CADENCE_DAYS);
  }
  return out;
}

// The actual quiz date for a cycle: the stored override if present, else the scheduled date.
export function effectiveQuizDate(
  scheduledDate: Date,
  row: { quizDate: Date } | null | undefined,
): Date {
  return row?.quizDate ?? scheduledDate;
}

// Prep is done only when BOTH steps are ticked.
export function quizPrepComplete(p: { quizCreated: boolean; sentToPrint: boolean } | null | undefined): boolean {
  return !!p && p.quizCreated && p.sentToPrint;
}

// The announcement is done once it's been marked sent.
export function quizAnnounced(p: { announcedAt: Date | null } | null | undefined): boolean {
  return !!p && p.announcedAt != null;
}
