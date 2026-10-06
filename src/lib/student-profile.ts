import "server-only";
import { prisma } from "@/lib/db";
import { cairoToday } from "@/lib/datetime";
import { hwIsMissing, reportWindow } from "@/lib/report-month";
import { monthWindow } from "@/lib/pay";

// Everything an assistant needs to answer a parent's questions about one student:
// every absence (with day + topic), every homework and its outcome, every grade vs the
// class average, office hours. Optionally narrowed to one month, using the SAME windows
// as the monthly parent PDF (attendance = calendar month; HW by deadline + assessments by
// date = report window) so the page and the report the parent received agree.

export type HwOutcome = "on_time" | "late" | "missing" | "pending";

export type StudentProfile = {
  student: {
    id: string;
    name: string;
    code: string;
    phone: string | null;
    parentPrefix: string | null;
    parentName: string | null;
    parentPhone: string | null;
  };
  attendance: { date: Date; topic: string; status: "present" | "absent" | "excused"; reason: string | null }[];
  homework: {
    id: string;
    description: string;
    deadline: Date;
    outcome: HwOutcome;
    submittedOn: Date | null;
    weakPoints: string | null;
  }[];
  grades: {
    id: string;
    label: string;
    date: Date;
    isDiagnostic: boolean;
    absent: boolean;
    rawMark: number | null;
    maxMark: number | null;
    percentage: number | null;
    classAverage: number | null;
  }[];
  officeHours: { date: Date; topic: string | null; durationMin: number | null }[];
  // Months (newest first) that have any class session so far — for the month filter.
  months: { month: number; year: number }[];
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export async function studentProfile(
  classId: string,
  studentId: string,
  period: { month: number; year: number } | null,
): Promise<StudentProfile | null> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, classId },
    select: {
      id: true,
      name: true,
      code: true,
      phone: true,
      parentPrefix: true,
      parentName: true,
      parentPhone: true,
      createdAt: true,
    },
  });
  if (!student) return null;
  const joined = new Date(Date.UTC(student.createdAt.getUTCFullYear(), student.createdAt.getUTCMonth(), student.createdAt.getUTCDate()));

  const cal = period ? monthWindow(period.month, period.year) : null;
  const rw = period ? reportWindow(period.month, period.year) : null;
  const today = cairoToday();

  const [attendance, homeworks, assessments, officeHours, sessionDates] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        studentId,
        session: { classId, ...(cal && { scheduledDate: { gte: cal.start, lt: cal.end } }) },
      },
      select: {
        status: true,
        notes: true,
        session: { select: { scheduledDate: true, customTopic: true, topic: { select: { title: true } } } },
      },
    }),
    prisma.homeworkAssignment.findMany({
      where: { classId, noHomework: false, ...(rw && { deadline: { gte: rw.start, lt: rw.end } }) },
      orderBy: { deadline: "desc" },
      select: {
        id: true,
        description: true,
        deadline: true,
        submissions: {
          where: { studentId },
          select: { status: true, submissionDate: true, weakPoints: true },
        },
      },
    }),
    prisma.assessment.findMany({
      where: { classId, ...(rw && { date: { gte: rw.start, lt: rw.end } }) },
      orderBy: { date: "desc" },
      select: {
        id: true,
        label: true,
        date: true,
        maxMark: true,
        isDiagnostic: true,
        grades: {
          where: { OR: [{ percentage: { not: null } }, { studentId }] },
          select: { studentId: true, percentage: true, rawMark: true, absent: true },
        },
      },
    }),
    prisma.officeHourSession.findMany({
      where: { studentId, classId, ...(cal && { date: { gte: cal.start, lt: cal.end } }) },
      orderBy: { date: "desc" },
      select: { date: true, durationMin: true, topicNotes: true, topic: { select: { title: true } } },
    }),
    prisma.classSession.findMany({
      where: { classId, scheduledDate: { lte: today } },
      select: { scheduledDate: true },
    }),
  ]);

  const months = [
    ...new Set(sessionDates.map((s) => `${s.scheduledDate.getUTCFullYear()}-${s.scheduledDate.getUTCMonth() + 1}`)),
  ]
    .map((k) => {
      const [year, month] = k.split("-").map(Number);
      return { year, month };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);

  return {
    student: {
      id: student.id,
      name: student.name,
      code: student.code,
      phone: student.phone,
      parentPrefix: student.parentPrefix,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
    },
    attendance: attendance
      .map((a) => ({
        date: a.session.scheduledDate,
        topic: a.session.customTopic ?? a.session.topic?.title ?? "—",
        status: a.status,
        reason: a.notes,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime()),
    homework: homeworks
      // Homework due before the student joined (and never reviewed) isn't theirs to have missed.
      .filter((h) => h.submissions.length > 0 || h.deadline.getTime() >= joined.getTime())
      .map((h) => {
        const sub = h.submissions[0];
        const outcome: HwOutcome = sub
          ? sub.status
          : hwIsMissing(h.deadline, null, today)
            ? "missing"
            : "pending";
        return {
          id: h.id,
          description: h.description?.trim() || "Homework",
          deadline: h.deadline,
          outcome,
          submittedOn: sub?.submissionDate ?? null,
          weakPoints: sub?.weakPoints?.trim() || null,
        };
      }),
    grades: assessments.map((a) => {
      const mine = a.grades.find((g) => g.studentId === studentId);
      return {
        id: a.id,
        label: a.label,
        date: a.date,
        isDiagnostic: a.isDiagnostic,
        absent: mine?.absent ?? false,
        rawMark: mine?.rawMark == null ? null : Number(mine.rawMark),
        maxMark: a.maxMark,
        percentage: mine?.percentage == null ? null : Number(mine.percentage),
        classAverage: mean(a.grades.filter((g) => g.percentage != null).map((g) => Number(g.percentage))),
      };
    }),
    officeHours: officeHours.map((o) => ({
      date: o.date,
      topic: o.topicNotes?.trim() || o.topic?.title || null,
      durationMin: o.durationMin,
    })),
    months,
  };
}
