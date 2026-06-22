import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { monthWindow } from "@/lib/pay";
import { displayedLessonNumbers } from "@/lib/lesson-number";
import { resolveConfigFor } from "@/lib/operation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ukDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);

export type ClassReportData = {
  logoDataUri: string | null;
  className: string;
  schoolName: string;
  yearGroup: string;
  assistants: string[];
  monthLabel: string;
  sessions: { lesson: string; date: string; topic: string; attendanceRate: string }[];
  assessments: { label: string; date: string; max: number; classAvg: string }[];
  // Student rows are identified by CODE (privacy — see student-code-privacy), ordered by code.
  students: { code: string; average: string; absences: number }[];
  homeworks: { description: string; due: string; submissionRate: string }[];
};

async function loadLogo(logoPath: string): Promise<string | null> {
  try {
    const file = path.join(process.cwd(), "public", logoPath.replace(/^\//, ""));
    const buf = await fs.readFile(file);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildClassReportData(
  classId: string,
  month: number,
  year: number,
): Promise<ClassReportData | null> {
  const { start, end } = monthWindow(month, year);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      name: true,
      operationId: true,
      yearGroup: true,
      school: { select: { name: true } },
      assignments: {
        where: { startDate: { lt: end }, OR: [{ endDate: null }, { endDate: { gte: start } }] },
        select: { assistant: { select: { name: true } } },
      },
    },
  });
  if (!klass) return null;

  const cfg = await resolveConfigFor(klass.operationId);

  const [allSessions, monthAssessments, students, monthHomeworks, logoDataUri] = await Promise.all([
    prisma.classSession.findMany({
      where: { classId },
      orderBy: { scheduledDate: "asc" },
      select: {
        scheduledDate: true,
        dayOff: true,
        topic: { select: { title: true } },
        attendance: { select: { status: true } },
      },
    }),
    prisma.assessment.findMany({
      where: { classId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      select: { label: true, date: true, maxMark: true, grades: { select: { percentage: true } } },
    }),
    prisma.student.findMany({
      where: { classId, active: true },
      select: {
        code: true,
        grades: {
          where: { assessment: { isDiagnostic: false } },
          select: { percentage: true },
        },
        attendance: { where: { status: "absent" }, select: { id: true } },
      },
    }),
    prisma.homeworkAssignment.findMany({
      where: { classId, noHomework: false, deadline: { gte: start, lt: end } },
      orderBy: { deadline: "asc" },
      select: {
        description: true,
        deadline: true,
        submissions: { where: { status: { in: ["on_time", "late"] } }, select: { id: true } },
      },
    }),
    loadLogo(cfg.logoPath),
  ]);

  const activeStudentCount = students.length;
  const displayNums = displayedLessonNumbers(allSessions);

  const sessions = allSessions
    .map((s, i) => ({ s, lessonNo: displayNums[i] }))
    .filter(({ s }) => s.scheduledDate >= start && s.scheduledDate < end)
    .map(({ s, lessonNo }) => {
      const total = s.attendance.length;
      const present = s.attendance.filter((a) => a.status === "present").length;
      return {
        lesson: s.dayOff ? "—" : String(lessonNo ?? "—"),
        date: ukDate(s.scheduledDate),
        topic: s.dayOff ? "Day off" : (s.topic?.title ?? "—"),
        attendanceRate: total > 0 ? `${Math.round((present / total) * 100)}%` : "—",
      };
    });

  const assessments = monthAssessments.map((a) => {
    const graded = a.grades.filter((g) => g.percentage != null);
    const avg = graded.length
      ? graded.reduce((sum, g) => sum + Number(g.percentage), 0) / graded.length
      : null;
    return {
      label: a.label,
      date: ukDate(a.date),
      max: a.maxMark,
      classAvg: avg === null ? "—" : `${avg.toFixed(0)}%`,
    };
  });

  const studentRows = students
    .map((s) => {
      const graded = s.grades.filter((g) => g.percentage != null);
      const avg = graded.length
        ? graded.reduce((sum, g) => sum + Number(g.percentage), 0) / graded.length
        : null;
      return {
        code: s.code,
        average: avg === null ? "—" : `${avg.toFixed(0)}%`,
        absences: s.attendance.length,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const homeworks = monthHomeworks.map((h) => ({
    description: h.description ?? "Homework",
    due: ukDate(h.deadline),
    submissionRate: activeStudentCount > 0 ? `${Math.round((h.submissions.length / activeStudentCount) * 100)}%` : "—",
  }));

  return {
    logoDataUri,
    className: klass.name,
    schoolName: klass.school.name,
    yearGroup: klass.yearGroup,
    assistants: klass.assignments.map((a) => a.assistant.name),
    monthLabel: `${MONTHS[month - 1]} ${year}`,
    sessions,
    assessments,
    students: studentRows,
    homeworks,
  };
}
