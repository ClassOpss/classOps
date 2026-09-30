// Month rules shared by every monthly view (PDF reports + the parent-reports page).
// Client-safe (no imports).
//
// Homework belongs to a report by its DEADLINE and a quiz/assessment by its DATE — never
// the day it was set. So HW set on 30 Sep and due 4 Oct is an October item.
//
// The window is cut at the report's due day (the 30th, 28th in Feb), not the calendar
// month end: reports go out ON that day, before HW due that day has been checked or a
// quiz that day marked. So a month's report covers [previous report day, this report day)
// and anything due ON the report day rolls into next month's report, e.g.
//   September report = 30 Aug – 29 Sep;  HW due 30 Sep -> October report.
// Attendance stays on calendar months (it's logged the same day).
// All dates are date-only (UTC midnight), like the @db.Date columns.

// Monthly parent-report due day: the 30th (28th in February). `month` is 1-12.
export function monthlyReportDueDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, month === 2 ? 28 : 30));
}

// [start, end) of HW deadlines / assessment dates that belong to a month's report.
export function reportWindow(month: number, year: number): { start: Date; end: Date } {
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  return { start: monthlyReportDueDate(prev.y, prev.m), end: monthlyReportDueDate(year, month) };
}

export function inReportWindow(d: Date, month: number, year: number): boolean {
  const { start, end } = reportWindow(month, year);
  return d.getTime() >= start.getTime() && d.getTime() < end.getTime();
}

// Calendar month (attendance).
export function inCalendarMonth(d: Date, month: number, year: number): boolean {
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
}

// Missing = explicitly marked missing, or no submission row once the deadline day has
// passed (same rule as lib/homework.hwStatus). Not yet due => not missing.
export function hwIsMissing(
  deadline: Date,
  status: string | null | undefined,
  today: Date,
): boolean {
  if (status) return status === "missing";
  return today.getTime() > deadline.getTime();
}
