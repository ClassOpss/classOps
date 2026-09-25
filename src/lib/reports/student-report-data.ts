import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { COUNTED_ATTENDANCE } from "@/lib/attendance";
import { monthWindow } from "@/lib/pay";
import { resolveConfigFor } from "@/lib/operation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const ukDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);

export type Standing = "above" | "average" | "below";

export type StudentReportData = {
  logoDataUri: string | null;
  brandName: string;
  generatedAt: string;
  studentName: string;
  code: string;
  className: string;
  schoolName: string;
  monthLabel: string;
  parentNotes: string | null;
  summary: { attendanceRate: string; average: string; missedHw: number; absences: number };
  // Change in percentage points vs the previous month (null = no prior data).
  trend: { averageDelta: number | null; attendanceDelta: number | null };
  absences: { date: string; topic: string }[];
  // Excused sessions (not counted in attendance) + an auto-built note for parents.
  excused: { date: string; topic: string; reason: string | null }[];
  excusedNote: string | null;
  missedHomework: { description: string; due: string }[];
  grades: { label: string; date: string; score: string; classAvg: string; standing: Standing | null }[];
};

async function loadLogo(operationId: string, logoPath: string): Promise<string | null> {
  const op = await prisma.operation.findUnique({
    where: { id: operationId },
    select: { logoData: true, logoMime: true },
  });
  if (op?.logoData) return `data:${op.logoMime ?? "image/png"};base64,${Buffer.from(op.logoData).toString("base64")}`;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", logoPath.replace(/^\//, "")));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// e.g. "Excused from 4 Thursday sessions: Schedule clash with another subject."
// One sentence per distinct reason, naming the weekday(s) the excused sessions fell on.
export function excusedNote(rows: { date: Date; reason: string | null }[]): string | null {
  if (rows.length === 0) return null;
  const byReason = new Map<string, Date[]>();
  for (const r of rows) {
    const key = r.reason?.trim() || "";
    byReason.set(key, [...(byReason.get(key) ?? []), r.date]);
  }
  return [...byReason.entries()]
    .map(([reason, dates]) => {
      const days = [...new Set(dates.map((d) => d.getUTCDay()))].sort().map((d) => WEEKDAYS[d]);
      const n = dates.length;
      const what = `${n} ${days.join("/")} session${n === 1 ? "" : "s"}`;
      return reason ? `Excused from ${what}: ${reason.replace(/\.$/, "")}.` : `Excused from ${what}.`;
    })
    .join(" ");
}

export async function buildStudentReportData(
  studentId: string,
  month: number,
  year: number,
  operationId: string,
): Promise<StudentReportData | null> {
  const { start, end } = monthWindow(month, year);

  const student = await prisma.student.findFirst({
    where: { id: studentId, class: { operationId } },
    select: {
      name: true,
      code: true,
      parentNotes: true,
      class: { select: { name: true, school: { select: { name: true } } } },
    },
  });
  if (!student) return null;
  const cfg = await resolveConfigFor(operationId);

  // Attendance in the month.
  const attendance = await prisma.attendance.findMany({
    where: { studentId, session: { scheduledDate: { gte: start, lt: end } } },
    select: { status: true, notes: true, session: { select: { scheduledDate: true, customTopic: true, topic: { select: { title: true } } } } },
  });
  const present = attendance.filter((a) => a.status === "present").length;
  const absences = attendance
    .filter((a) => a.status === "absent")
    .sort((a, b) => a.session.scheduledDate.getTime() - b.session.scheduledDate.getTime())
    .map((a) => ({ date: ukDate(a.session.scheduledDate), topic: a.session.customTopic ?? a.session.topic?.title ?? "—" }));
  const excusedRows = attendance
    .filter((a) => a.status === "excused")
    .sort((a, b) => a.session.scheduledDate.getTime() - b.session.scheduledDate.getTime());
  const excused = excusedRows.map((a) => ({
    date: ukDate(a.session.scheduledDate),
    topic: a.session.customTopic ?? a.session.topic?.title ?? "—",
    reason: a.notes,
  }));

  // Missed homework in the month (deadline in month, status missing OR no submission row).
  const homeworks = await prisma.homeworkAssignment.findMany({
    where: { noHomework: false, deadline: { gte: start, lt: end }, class: { students: { some: { id: studentId } } } },
    select: {
      description: true,
      deadline: true,
      submissions: { where: { studentId }, select: { status: true } },
    },
  });
  const missedHomework = homeworks
    .filter((h) => {
      const sub = h.submissions[0];
      return !sub || sub.status === "missing";
    })
    .map((h) => ({ description: h.description ?? "Homework", due: ukDate(h.deadline) }));

  // Grades in the month (non-diagnostic) with class average + standing.
  const gradeRows = await prisma.assessmentGrade.findMany({
    where: {
      studentId,
      assessment: { isDiagnostic: false, date: { gte: start, lt: end } },
    },
    select: {
      percentage: true,
      absent: true,
      assessment: {
        select: {
          label: true,
          date: true,
          grades: { where: { percentage: { not: null } }, select: { percentage: true } },
        },
      },
    },
  });
  const grades = gradeRows
    .sort((a, b) => a.assessment.date.getTime() - b.assessment.date.getTime())
    .map((g) => {
      const all = g.assessment.grades.map((x) => Number(x.percentage));
      const classAvg = all.length ? all.reduce((s, x) => s + x, 0) / all.length : null;
      const pct = g.absent || g.percentage == null ? null : Number(g.percentage);
      let standing: Standing | null = null;
      if (pct != null && classAvg != null) {
        standing = pct > classAvg + 1 ? "above" : pct < classAvg - 1 ? "below" : "average";
      }
      return {
        label: g.assessment.label,
        date: ukDate(g.assessment.date),
        score: g.absent ? "Absent" : pct == null ? "—" : `${Math.round(pct)}%`,
        classAvg: classAvg == null ? "—" : `${Math.round(classAvg)}%`,
        standing,
      };
    });

  const gradedPcts = grades
    .map((g) => (g.score.endsWith("%") ? parseInt(g.score) : null))
    .filter((x): x is number => x != null);
  const curAvg = gradedPcts.length ? gradedPcts.reduce((s, x) => s + x, 0) / gradedPcts.length : null;
  const average = curAvg == null ? "—" : `${Math.round(curAvg)}%`;
  const counted = attendance.filter((a) => a.status !== "excused").length;
  const curAttRate = counted ? (present / counted) * 100 : null;

  // Previous month, for trend deltas.
  const pm = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
  const pw = monthWindow(pm.m, pm.y);
  const [prevAtt, prevGrades] = await Promise.all([
    prisma.attendance.findMany({
      where: { studentId, ...COUNTED_ATTENDANCE, session: { scheduledDate: { gte: pw.start, lt: pw.end } } },
      select: { status: true },
    }),
    prisma.assessmentGrade.findMany({
      where: { studentId, absent: false, percentage: { not: null }, assessment: { isDiagnostic: false, date: { gte: pw.start, lt: pw.end } } },
      select: { percentage: true },
    }),
  ]);
  const prevAttRate = prevAtt.length ? (prevAtt.filter((a) => a.status === "present").length / prevAtt.length) * 100 : null;
  const prevAvg = prevGrades.length ? prevGrades.reduce((s, g) => s + Number(g.percentage), 0) / prevGrades.length : null;
  const trend = {
    averageDelta: curAvg != null && prevAvg != null ? Math.round(curAvg - prevAvg) : null,
    attendanceDelta: curAttRate != null && prevAttRate != null ? Math.round(curAttRate - prevAttRate) : null,
  };

  return {
    logoDataUri: await loadLogo(operationId, cfg.logoPath),
    brandName: cfg.brandName,
    generatedAt: ukDate(new Date()),
    studentName: student.name,
    code: student.code,
    className: student.class.name,
    schoolName: student.class.school.name,
    monthLabel: `${MONTHS[month - 1]} ${year}`,
    parentNotes: student.parentNotes,
    summary: {
      attendanceRate: curAttRate == null ? "—" : `${Math.round(curAttRate)}%`,
      average,
      missedHw: missedHomework.length,
      absences: absences.length,
    },
    trend,
    absences,
    excused,
    excusedNote: excusedNote(excusedRows.map((a) => ({ date: a.session.scheduledDate, reason: a.notes }))),
    missedHomework,
    grades,
  };
}
