import { prisma } from "@/lib/db";
import { COUNTED_ATTENDANCE } from "@/lib/attendance";
import { classGradeSeries, gradeTrend, hwTrend, pooledNoise, type GradePoint, type GradeTrendLabel, type HwTrendLabel } from "@/lib/trend";

// At-risk is decided by academic signals only: grades and homework.
const AVERAGE_FLOOR = 50; // non-diagnostic average grade < 50%
const MIN_HW = 3; // don't judge homework until 3 have been reviewed
const HW_SUBMIT_FLOOR = 0.5; // submitted (on time or late) < half of reviewed HW

// Attendance is shown as an informational flag only — it never makes a
// student "at risk" (absences are often explained: clashes, illness, travel).
const MIN_SESSIONS = 3;
const ATTENDANCE_FLOOR = 0.75;

export type RiskInput = {
  attended: number;
  attendanceTotal: number;
  hwSubmitted: number; // on_time + late
  hwTotal: number; // reviewed HW (on_time + late + missing)
  average: number | null;
  // Trend labels (lib/trend). "slipping" flags a student BEFORE their average or
  // submission rate crosses the floors above — the early warning.
  gradeTrend?: GradeTrendLabel | null;
  hwTrend?: HwTrendLabel | null;
};

// Why a student is at risk (empty = fine). Shared by the admin dashboard and
// the assistant progress view so both flag the same students.
export function riskReasons(m: RiskInput): string[] {
  const reasons: string[] = [];
  if (m.average != null && m.average < AVERAGE_FLOOR) reasons.push(`Avg ${Math.round(m.average)}%`);
  if (m.hwTotal >= MIN_HW && m.hwSubmitted / m.hwTotal < HW_SUBMIT_FLOOR) {
    reasons.push(`HW ${m.hwSubmitted}/${m.hwTotal} submitted`);
  }
  if (m.gradeTrend === "slipping") reasons.push("Grades slipping");
  if (m.hwTrend === "slipping") reasons.push("HW slipping");
  return reasons;
}

// Informational flags that don't count toward at-risk.
export function watchFlags(m: RiskInput): string[] {
  const attRate = m.attendanceTotal > 0 ? m.attended / m.attendanceTotal : 1;
  return m.attendanceTotal >= MIN_SESSIONS && attRate < ATTENDANCE_FLOOR
    ? [`Attendance ${Math.round(attRate * 100)}%`]
    : [];
}

export type AtRiskStudent = {
  id: string;
  name: string;
  classId: string;
  className: string;
  reasons: string[];
  flags: string[];
};

// Students across the operation's active classes who are at risk on grades/HW.
export async function detectAtRiskStudents(operationId: string): Promise<AtRiskStudent[]> {
  const students = await prisma.student.findMany({
    where: { active: true, class: { active: true, operationId } },
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true } },
      attendance: { where: COUNTED_ATTENDANCE, select: { status: true } },
      hwSubmissions: { select: { status: true, homework: { select: { deadline: true } } } },
      grades: {
        where: { assessment: { isDiagnostic: false }, percentage: { not: null } },
        select: { percentage: true },
      },
    },
  });

  // Grade trends: per class, each student's leave-one-out z per assessment (lib/trend).
  const assessments = await prisma.assessment.findMany({
    where: { isDiagnostic: false, class: { active: true, operationId } },
    orderBy: { date: "asc" },
    select: {
      classId: true,
      grades: { where: { percentage: { not: null } }, select: { studentId: true, percentage: true } },
    },
  });
  const byClass = new Map<string, { grades: { studentId: string; pct: number }[] }[]>();
  for (const a of assessments) {
    if (!byClass.has(a.classId)) byClass.set(a.classId, []);
    byClass.get(a.classId)!.push({ grades: a.grades.map((g) => ({ studentId: g.studentId, pct: Number(g.percentage) })) });
  }
  const series = new Map<string, GradePoint[]>();
  const noise = new Map<string, number>();
  for (const [classId, list] of byClass) {
    const s = classGradeSeries(list);
    noise.set(classId, pooledNoise(s.values()));
    for (const [studentId, pts] of s) series.set(studentId, pts);
  }

  const out: AtRiskStudent[] = [];
  for (const s of students) {
    const avg = s.grades.length
      ? s.grades.reduce((sum, g) => sum + Number(g.percentage), 0) / s.grades.length
      : null;
    const input: RiskInput = {
      attended: s.attendance.filter((a) => a.status === "present").length,
      attendanceTotal: s.attendance.length,
      hwSubmitted: s.hwSubmissions.filter((h) => h.status !== "missing").length,
      hwTotal: s.hwSubmissions.length,
      average: avg,
      gradeTrend: gradeTrend(series.get(s.id) ?? [], noise.get(s.class.id) ?? 0)?.label,
      hwTrend: hwTrend(
        [...s.hwSubmissions]
          .sort((a, b) => a.homework.deadline.getTime() - b.homework.deadline.getTime())
          .map((h) => h.status !== "missing"),
      )?.label,
    };
    const reasons = riskReasons(input);
    if (reasons.length) {
      out.push({
        id: s.id,
        name: s.name,
        classId: s.class.id,
        className: s.class.name,
        reasons,
        flags: watchFlags(input),
      });
    }
  }
  // Most flags first.
  return out.sort((a, b) => b.reasons.length - a.reasons.length);
}
