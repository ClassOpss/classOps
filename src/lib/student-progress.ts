import { prisma } from "@/lib/db";
import { riskReasons } from "@/lib/at-risk";

export type StudentProgress = {
  id: string;
  name: string;
  attended: number;
  attendanceTotal: number;
  hw: { onTime: number; late: number; missing: number };
  // Non-diagnostic graded average (absent / unmarked excluded). null = no grades yet.
  average: number | null;
  // Most recent graded assessment, relative to that assessment's class average.
  lastGrade: { label: string; percentage: number; classAverage: number } | null;
  weakPoints: string | null;
  reasons: string[];
};

export type AssessmentSummary = {
  id: string;
  label: string;
  date: Date;
  isDiagnostic: boolean;
  groupAverage: number | null;
  classAverage: number | null;
  graded: number;
};

export type ClassProgress = {
  students: StudentProgress[];
  group: { attendanceRate: number | null; hwOnTimeRate: number | null; average: number | null };
  klass: { attendanceRate: number | null; hwOnTimeRate: number | null; average: number | null };
  assessments: AssessmentSummary[];
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Progress of `studentIds` (the viewer's sub-group) within a class, with the
// whole class as the comparison baseline. Grade comparisons are relative to the
// class average, matching the grade colour rule.
export async function classProgress(classId: string, studentIds: string[]): Promise<ClassProgress> {
  const [students, assessments] = await Promise.all([
    prisma.student.findMany({
      where: { classId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        attendance: { where: { session: { classId } }, select: { status: true } },
        hwSubmissions: {
          where: { homework: { classId } },
          select: { status: true, weakPoints: true, loggedAt: true },
        },
      },
    }),
    prisma.assessment.findMany({
      where: { classId },
      orderBy: { date: "desc" },
      select: {
        id: true,
        label: true,
        date: true,
        isDiagnostic: true,
        grades: {
          where: { percentage: { not: null }, absent: false },
          select: { studentId: true, percentage: true },
        },
      },
    }),
  ]);

  const mine = new Set(studentIds);
  const assessmentAvg = new Map(
    assessments.map((a) => [a.id, mean(a.grades.map((g) => Number(g.percentage)))]),
  );

  const all: StudentProgress[] = students.map((s) => {
    const graded = assessments.flatMap((a) => {
      const g = a.grades.find((x) => x.studentId === s.id);
      return g ? [{ a, pct: Number(g.percentage) }] : [];
    });
    const counted = graded.filter((x) => !x.a.isDiagnostic).map((x) => x.pct);
    const last = graded[0]; // assessments are newest-first
    const weak = s.hwSubmissions
      .filter((h) => h.weakPoints?.trim())
      .sort((a, b) => b.loggedAt.getTime() - a.loggedAt.getTime())[0];

    const attended = s.attendance.filter((a) => a.status === "present").length;
    const hw = {
      onTime: s.hwSubmissions.filter((h) => h.status === "on_time").length,
      late: s.hwSubmissions.filter((h) => h.status === "late").length,
      missing: s.hwSubmissions.filter((h) => h.status === "missing").length,
    };
    const average = mean(counted);
    return {
      id: s.id,
      name: s.name,
      attended,
      attendanceTotal: s.attendance.length,
      hw,
      average,
      lastGrade: last
        ? { label: last.a.label, percentage: last.pct, classAverage: assessmentAvg.get(last.a.id) ?? last.pct }
        : null,
      weakPoints: weak?.weakPoints?.trim() ?? null,
      reasons: riskReasons({ attended, attendanceTotal: s.attendance.length, missingHw: hw.missing, average }),
    };
  });

  const summarize = (rows: StudentProgress[]) => {
    const attTotal = rows.reduce((n, r) => n + r.attendanceTotal, 0);
    const hwTotal = rows.reduce((n, r) => n + r.hw.onTime + r.hw.late + r.hw.missing, 0);
    return {
      attendanceRate: attTotal ? rows.reduce((n, r) => n + r.attended, 0) / attTotal : null,
      hwOnTimeRate: hwTotal ? rows.reduce((n, r) => n + r.hw.onTime, 0) / hwTotal : null,
      average: mean(rows.flatMap((r) => (r.average == null ? [] : [r.average]))),
    };
  };

  const group = all.filter((s) => mine.has(s.id));
  return {
    // Flagged students first (most flags on top), then weakest average.
    students: group.sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        (a.average ?? 101) - (b.average ?? 101) ||
        a.name.localeCompare(b.name),
    ),
    group: summarize(group),
    klass: summarize(all),
    assessments: assessments.map((a) => {
      const ours = a.grades.filter((g) => mine.has(g.studentId)).map((g) => Number(g.percentage));
      return {
        id: a.id,
        label: a.label,
        date: a.date,
        isDiagnostic: a.isDiagnostic,
        groupAverage: mean(ours),
        classAverage: assessmentAvg.get(a.id) ?? null,
        graded: ours.length,
      };
    }),
  };
}
