import { prisma } from "@/lib/db";
import { subGroupStudentIds } from "@/lib/roster";

// Monthly parent-report task: once a month (due the 30th — see monthlyReportDeadline),
// each assistant sends every student in their SUB-GROUP their PDF report for that month.
// Only students with a parent phone count — there's no one to send it to otherwise.
// A send is recorded in ParentReportLog when "Report → parent" is used.

export type MonthlyReportProgress = { total: number; sent: number };

export async function monthlyReportProgress(
  classId: string,
  assistantId: string,
  year: number,
  month: number,
  now: Date = new Date(),
): Promise<MonthlyReportProgress> {
  const subIds = await subGroupStudentIds(classId, assistantId, now);
  if (subIds.length === 0) return { total: 0, sent: 0 };
  const students = await prisma.student.findMany({
    where: { id: { in: subIds }, parentPhone: { not: null } },
    select: { id: true, parentPhone: true, reportLogs: { where: { year, month }, select: { id: true } } },
  });
  const reachable = students.filter((s) => s.parentPhone?.trim());
  return { total: reachable.length, sent: reachable.filter((s) => s.reportLogs.length > 0).length };
}

export function monthlyReportDone(p: MonthlyReportProgress): boolean {
  return p.sent >= p.total;
}

// The (year, month) of a UTC-midnight Cairo calendar date.
export function yearMonthOf(day: Date): { year: number; month: number } {
  return { year: day.getUTCFullYear(), month: day.getUTCMonth() + 1 };
}

export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1];
}
