import { prisma } from "@/lib/db";

// Numerical thresholds for flagging a student as needing attention.
const MIN_SESSIONS = 3; // don't flag attendance until there's enough signal
const ATTENDANCE_FLOOR = 0.75; // < 75% attendance
const MISSING_HW_FLOOR = 2; // >= 2 missing homeworks
const AVERAGE_FLOOR = 50; // average grade < 50%

export type AtRiskStudent = {
  id: string;
  name: string;
  classId: string;
  className: string;
  reasons: string[];
};

// Students across the operation's active classes who breach any threshold.
export async function detectAtRiskStudents(operationId: string): Promise<AtRiskStudent[]> {
  const students = await prisma.student.findMany({
    where: { active: true, class: { active: true, operationId } },
    select: {
      id: true,
      name: true,
      class: { select: { id: true, name: true } },
      attendance: { select: { status: true } },
      hwSubmissions: { where: { status: "missing" }, select: { id: true } },
      grades: {
        where: { assessment: { isDiagnostic: false }, percentage: { not: null } },
        select: { percentage: true },
      },
    },
  });

  const out: AtRiskStudent[] = [];
  for (const s of students) {
    const total = s.attendance.length;
    const present = s.attendance.filter((a) => a.status === "present").length;
    const attRate = total > 0 ? present / total : 1;
    const missing = s.hwSubmissions.length;
    const avg = s.grades.length
      ? s.grades.reduce((sum, g) => sum + Number(g.percentage), 0) / s.grades.length
      : null;

    const reasons: string[] = [];
    if (total >= MIN_SESSIONS && attRate < ATTENDANCE_FLOOR) {
      reasons.push(`Attendance ${Math.round(attRate * 100)}%`);
    }
    if (missing >= MISSING_HW_FLOOR) reasons.push(`${missing} missing HW`);
    if (avg != null && avg < AVERAGE_FLOOR) reasons.push(`Avg ${Math.round(avg)}%`);

    if (reasons.length) {
      out.push({ id: s.id, name: s.name, classId: s.class.id, className: s.class.name, reasons });
    }
  }
  // Most flags first.
  return out.sort((a, b) => b.reasons.length - a.reasons.length);
}
