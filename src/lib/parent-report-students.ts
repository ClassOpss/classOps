import "server-only";
import { prisma } from "@/lib/db";
import { COUNTED_ATTENDANCE } from "@/lib/attendance";
import type { PRStudent } from "@/app/(admin)/classes/[classId]/parent-reports/parent-reports";

// Students for the parent-reports page (admin + assistant share it). Records carry their
// dates so the page can summarise whichever month is selected, by the same rules as the
// PDF: attendance by session date, grades by assessment date, homework by DEADLINE.
export async function loadParentReportStudents(classId: string): Promise<PRStudent[]> {
  const [students, homeworks] = await Promise.all([
    prisma.student.findMany({
      where: { classId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, code: true, phone: true, parentPrefix: true, parentName: true, parentPhone: true, parentNotes: true,
        attendance: { where: COUNTED_ATTENDANCE, select: { status: true, session: { select: { scheduledDate: true } } } },
        grades: {
          where: { assessment: { isDiagnostic: false }, percentage: { not: null } },
          select: { percentage: true, assessment: { select: { date: true } } },
        },
      },
    }),
    prisma.homeworkAssignment.findMany({
      where: { classId, noHomework: false },
      select: { deadline: true, submissions: { select: { studentId: true, status: true } } },
    }),
  ]);

  return students.map((s) => ({
    id: s.id, name: s.name, code: s.code, phone: s.phone, parentPrefix: s.parentPrefix, parentName: s.parentName,
    parentPhone: s.parentPhone, parentNotes: s.parentNotes,
    attendance: s.attendance.map((a) => ({ date: a.session.scheduledDate.toISOString(), present: a.status === "present" })),
    grades: s.grades.map((g) => ({ date: g.assessment.date.toISOString(), pct: Number(g.percentage) })),
    homework: homeworks.map((h) => ({
      deadline: h.deadline.toISOString(),
      status: h.submissions.find((x) => x.studentId === s.id)?.status ?? null,
    })),
  }));
}
