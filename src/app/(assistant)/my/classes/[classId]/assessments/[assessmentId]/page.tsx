import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { saturdayDeadline, isLate, formatCairo } from "@/lib/datetime";
import { resolveConfig } from "@/lib/operation";
import { GradeEntryForm, type GradeRow } from "./grade-entry-form";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function GradeEntryPage({
  params,
}: {
  params: Promise<{ classId: string; assessmentId: string }>;
}) {
  const { classId, assessmentId } = await params;
  const user = await requireClassAccess(classId);

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, classId: true, label: true, date: true, maxMark: true, isDiagnostic: true },
  });
  if (!assessment || assessment.classId !== classId) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Assessment not found</h1>
        <Link href={`/my/classes/${classId}/assessments`} className="text-sm text-blue-600 hover:underline">← Assessments</Link>
      </div>
    );
  }

  const visibleIds = await getVisibleStudentIds(classId, user);
  const [students, grades, avg] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: visibleIds }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.assessmentGrade.findMany({
      where: { assessmentId, studentId: { in: visibleIds } },
      select: { studentId: true, rawMark: true, absent: true, loggedAt: true },
    }),
    // Class average across ALL students (both sub-groups), for the colour coding.
    prisma.assessmentGrade.aggregate({ where: { assessmentId }, _avg: { percentage: true } }),
  ]);
  const byStudent = new Map(grades.map((g) => [g.studentId, g]));
  const classAverage = avg._avg.percentage !== null ? Number(avg._avg.percentage) : null;

  const rows: GradeRow[] = students.map((s) => {
    const g = byStudent.get(s.id);
    return {
      id: s.id,
      name: s.name,
      mark: g && g.rawMark != null ? String(Number(g.rawMark)) : "",
      absent: g?.absent ?? false,
    };
  });

  const total = students.length;
  const reviewed = grades.length;
  const complete = total > 0 && reviewed === total;

  const correctionDeadline = saturdayDeadline(assessment.date, await resolveConfig());
  const completionAt = complete
    ? grades.map((g) => g.loggedAt).sort((a, b) => b.getTime() - a.getTime())[0]
    : null;
  const late = completionAt ? isLate(completionAt, correctionDeadline) : false;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}/assessments`} className="link text-sm">← Assessments</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">
          {assessment.label}
          {assessment.isDiagnostic ? <span className="ml-1.5 badge-neutral">Diagnostic</span> : null}
        </h1>
        <p className="text-sm text-muted">
          {dateFmt.format(assessment.date)} · max {assessment.maxMark} · enter by{" "}
          {formatCairo(correctionDeadline, "EEE d MMM, h:mm a")}
        </p>
      </div>

      {complete ? (
        <div className={`rounded-lg px-3 py-2.5 text-sm ${late ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
          All {total} graded · completed {completionAt ? formatCairo(completionAt) : ""} —{" "}
          {late ? "Late (after 9pm Saturday)" : "On time"}
        </div>
      ) : (
        <div className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          Incomplete — {reviewed} of {total} students graded.
        </div>
      )}

      <GradeEntryForm
        assessmentId={assessmentId}
        maxMark={assessment.maxMark}
        classAverage={classAverage}
        students={rows}
      />
    </div>
  );
}
