import "server-only";
import { prisma } from "@/lib/db";
import { reportWindow } from "@/lib/report-month";

export type HwFeedback = {
  text: string; // what the report prints ("" = section hidden)
  draft: string; // auto-built from the month's HW weak points
  edited: boolean; // a saved override exists
};

// One line per homework due in the month that has weak points recorded, e.g.
// "- Quadratics worksheet: factorising, sign errors". Same month rule as the
// report's missed-homework list (by homework deadline, report window).
export async function draftHwFeedback(studentId: string, month: number, year: number): Promise<string> {
  const { start, end } = reportWindow(month, year);
  const subs = await prisma.homeworkSubmission.findMany({
    where: { studentId, weakPoints: { not: null }, homework: { deadline: { gte: start, lt: end } } },
    select: { weakPoints: true, homework: { select: { description: true, deadline: true } } },
  });
  return subs
    .filter((s) => s.weakPoints?.trim())
    .sort((a, b) => a.homework.deadline.getTime() - b.homework.deadline.getTime())
    .map((s) => `- ${s.homework.description?.trim() || "Homework"}: ${s.weakPoints!.trim()}`)
    .join("\n");
}

export async function hwFeedbackFor(studentId: string, month: number, year: number): Promise<HwFeedback> {
  const [draft, note] = await Promise.all([
    draftHwFeedback(studentId, month, year),
    prisma.parentReportNote.findUnique({
      where: { studentId_year_month: { studentId, year, month } },
      select: { hwFeedback: true },
    }),
  ]);
  return { text: note ? note.hwFeedback : draft, draft, edited: !!note };
}
