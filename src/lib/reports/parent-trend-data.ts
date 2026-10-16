import "server-only";
import { prisma } from "@/lib/db";
import { loadClassTrends } from "@/lib/class-trends";
import { reportWindow } from "@/lib/report-month";
import { parentTrendSentence, type ParentTrend } from "@/lib/parent-trend";

const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(d);

export type ReportProgress = ParentTrend & {
  // Student % vs class average per assessment, oldest first (absent / unmarked left out).
  points: { label: string; date: string; pct: number; classAvg: number }[];
};

// The "Progress this term" section of a monthly parent report: every assessment of the
// class (this school year = this class) up to the END of the report's window, so it also
// shows the trend before this month. null = not enough results, or the assistant switched
// it off for this month (ParentReportNote.hideTrend).
export async function parentTrendFor(
  studentId: string,
  month: number,
  year: number,
): Promise<{ progress: ReportProgress | null; available: ParentTrend | null; hidden: boolean }> {
  const [student, note] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } }),
    prisma.parentReportNote.findUnique({
      where: { studentId_year_month: { studentId, year, month } },
      select: { hideTrend: true },
    }),
  ]);
  const hidden = note?.hideTrend ?? false;
  if (!student) return { progress: null, available: null, hidden };

  // Ranks / standing are against the whole class; we only read this student's row.
  const data = await loadClassTrends(student.classId, { until: reportWindow(month, year).end });
  const row = data.rows.find((r) => r.id === studentId);
  const available = row ? parentTrendSentence(row.trend.group, row.points) : null;
  if (!row || !available || hidden) return { progress: null, available, hidden };

  const points = row.cells.flatMap((c, i) => {
    const col = data.columns[i];
    return c?.kind === "mark" && col.classAvg != null
      ? [{ label: col.label, date: shortDate(col.date), pct: c.pct, classAvg: col.classAvg }]
      : [];
  });
  return { progress: { ...available, points }, available, hidden };
}
