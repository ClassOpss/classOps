// Biweekly quiz-prep task cadence. A class opts in by setting `quizStartDate` (the date
// of its FIRST quiz); every subsequent quiz recurs +14 days. `quizDay` on the class is the
// weekday label (kept in sync with quizStartDate's weekday) — informational for display.
//
// For each quiz date the responsible assistant(s) must, 3 days before, (1) create the quiz
// and (2) send it for printing. That prep DEADLINE = quizDate − 3 days at the operation's
// daily deadline hour (see lib/datetime.quizPrepDeadline). Completion is tracked in QuizPrep.
//
// This module is dependency-light on purpose (only lib/constants) so both server actions
// and lib/datetime can import it without a cycle.

import { DAYS } from "@/lib/constants";

export const QUIZ_CADENCE_DAYS = 14; // biweekly
export const QUIZ_PREP_LEAD_DAYS = 3; // prep due this many days before the quiz

const MS_PER_DAY = 86_400_000;

// Add n days to a UTC-midnight @db.Date value, returning a fresh UTC-midnight Date.
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

// Whole-day difference between two UTC-midnight dates (b − a).
function dayDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

// Weekday name (Sunday…Saturday) for a UTC-midnight date — matches DAYS + schedule labels.
export function weekdayName(d: Date): string {
  return DAYS[d.getUTCDay()];
}

// Is a class opted into the biweekly quiz task?
export function quizEnabled(c: { quizStartDate: Date | null }): boolean {
  return c.quizStartDate != null;
}

// Is `date` (UTC-midnight) one of this class's biweekly quiz dates?
export function isQuizDate(quizStartDate: Date, date: Date): boolean {
  const diff = dayDiff(quizStartDate, date);
  return diff >= 0 && diff % QUIZ_CADENCE_DAYS === 0;
}

// The prep-deadline calendar day (UTC-midnight) for a given quiz date.
export function prepDeadlineDate(quizDate: Date): Date {
  return addDays(quizDate, -QUIZ_PREP_LEAD_DAYS);
}

// If `today` is the prep-deadline day for one of this class's quiz cycles, return that
// quiz date; else null. today == quizDate − lead  ⇒  quizDate == today + lead.
export function quizForPrepDeadlineDay(quizStartDate: Date, today: Date): Date | null {
  const quizDate = addDays(today, QUIZ_PREP_LEAD_DAYS);
  return isQuizDate(quizStartDate, quizDate) ? quizDate : null;
}

// The next quiz date on/after `from` (UTC-midnight).
export function nextQuizDate(quizStartDate: Date, from: Date): Date {
  if (from <= quizStartDate) return quizStartDate;
  const cycles = Math.ceil(dayDiff(quizStartDate, from) / QUIZ_CADENCE_DAYS);
  return addDays(quizStartDate, cycles * QUIZ_CADENCE_DAYS);
}

// All quiz dates falling in [from, to] inclusive (UTC-midnight). Used to list prep tasks.
export function quizDatesBetween(quizStartDate: Date, from: Date, to: Date): Date[] {
  const out: Date[] = [];
  if (to < quizStartDate) return out;
  let d = nextQuizDate(quizStartDate, from);
  while (d.getTime() <= to.getTime()) {
    out.push(new Date(d));
    d = addDays(d, QUIZ_CADENCE_DAYS);
  }
  return out;
}

// A QuizPrep record (or its absence) is "complete" only when BOTH steps are ticked.
export function quizPrepComplete(p: { quizCreated: boolean; sentToPrint: boolean } | null | undefined): boolean {
  return !!p && p.quizCreated && p.sentToPrint;
}
