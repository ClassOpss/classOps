import { prisma } from "@/lib/db";

// A school break, as needed by pay/incident/coverage logic. Dates are @db.Date
// (UTC-midnight) and inclusive on both ends.
export type VacationSpan = {
  schoolId: string;
  startDate: Date;
  endDate: Date;
};

// One "full pay" month is treated as 4 weeks = 28 vacation days, so each week off
// (7 days) removes a quarter of a class's base pay. Kept as a constant so the pay
// proration and any UI hint stay in step.
export const VACATION_FULL_MONTH_DAYS = 28;

// Fraction of a class's monthly base pay to WITHHOLD for `days` of school vacation
// that month. 7 -> 1/4, 14 -> 1/2, 21 -> 3/4, 28+ -> 1 (whole month, pay 0).
export function vacationFractionOff(days: number): number {
  if (days <= 0) return 0;
  return Math.min(1, days / VACATION_FULL_MONTH_DAYS);
}

const DAY_MS = 24 * 60 * 60 * 1000;

// UTC-midnight Date for the given day, matching @db.Date storage.
function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Distinct calendar days a given school is on vacation within [monthStart, monthEnd)
// (overlapping spans are de-duplicated so two breaks in one month can't exceed the
// month's length).
export function vacationDaysInMonth(
  schoolId: string,
  month: number,
  year: number,
  vacations: VacationSpan[],
): number {
  const monthStart = Date.UTC(year, month - 1, 1);
  const monthEnd = Date.UTC(year, month, 1); // exclusive
  const days = new Set<number>();
  for (const v of vacations) {
    if (v.schoolId !== schoolId) continue;
    let day = Math.max(utcDay(v.startDate), monthStart);
    const last = Math.min(utcDay(v.endDate), monthEnd - DAY_MS);
    for (; day <= last; day += DAY_MS) days.add(day);
  }
  return days.size;
}

// Is this school on vacation on `date` (a session's scheduled date)? Used to suppress
// late incidents and coverage flags — the school isn't running, so nothing is "missed".
export function isSchoolOnVacation(schoolId: string, date: Date, vacations: VacationSpan[]): boolean {
  const d = utcDay(date);
  for (const v of vacations) {
    if (v.schoolId === schoolId && d >= utcDay(v.startDate) && d <= utcDay(v.endDate)) return true;
  }
  return false;
}

// All vacation spans for an operation (single query; callers filter by school).
export async function loadVacations(operationId: string): Promise<VacationSpan[]> {
  return prisma.schoolVacation.findMany({
    where: { operationId },
    select: { schoolId: true, startDate: true, endDate: true },
  });
}

// Vacation spans for every operation, keyed by operationId (for the cron, which
// spans all operations in one run).
export async function loadAllVacations(): Promise<Map<string, VacationSpan[]>> {
  const rows = await prisma.schoolVacation.findMany({
    select: { operationId: true, schoolId: true, startDate: true, endDate: true },
  });
  const map = new Map<string, VacationSpan[]>();
  for (const r of rows) {
    const list = map.get(r.operationId) ?? [];
    list.push({ schoolId: r.schoolId, startDate: r.startDate, endDate: r.endDate });
    map.set(r.operationId, list);
  }
  return map;
}
