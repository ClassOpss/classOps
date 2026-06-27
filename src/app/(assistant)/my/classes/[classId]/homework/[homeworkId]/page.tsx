import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { submitHomeworkSubmissions } from "@/actions/homework";
import { saturdayDeadline, isLate, formatCairo } from "@/lib/datetime";
import { resolveConfig } from "@/lib/operation";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_STYLE: Record<string, string> = {
  on_time: "badge-success",
  late: "badge-warn",
  missing: "badge-danger",
};
const STATUS_LABEL: Record<string, string> = {
  on_time: "On time",
  late: "Late",
  missing: "Missing",
};

export default async function HomeworkEntryPage({
  params,
}: {
  params: Promise<{ classId: string; homeworkId: string }>;
}) {
  const { classId, homeworkId } = await params;
  const user = await requireClassAccess(classId);

  const homework = await prisma.homeworkAssignment.findUnique({
    where: { id: homeworkId },
    select: { id: true, classId: true, description: true, deadline: true, noHomework: true },
  });
  if (!homework || homework.classId !== classId || homework.noHomework) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Homework not found</h1>
        <Link href={`/my/classes/${classId}/homework`} className="link text-sm">← Homework</Link>
      </div>
    );
  }

  const visibleIds = await getVisibleStudentIds(classId, user);
  const [students, submissions] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: visibleIds }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.homeworkSubmission.findMany({
      where: { homeworkId, studentId: { in: visibleIds } },
      select: { studentId: true, submissionDate: true, status: true, weakPoints: true, loggedAt: true },
    }),
  ]);
  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

  const total = students.length;
  const reviewed = submissions.length;
  const complete = total > 0 && reviewed === total;

  const correctionDeadline = saturdayDeadline(homework.deadline, await resolveConfig());
  // When the correction became complete = the last student first reviewed (max loggedAt).
  // loggedAt isn't bumped on edits, so later edits don't move this.
  const completionAt = complete
    ? submissions.map((s) => s.loggedAt).sort((a, b) => b.getTime() - a.getTime())[0]
    : null;
  const late = completionAt ? isLate(completionAt, correctionDeadline) : false;

  const deadlineValue = homework.deadline.toISOString().slice(0, 10);
  const inputCls = "input";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}/homework`} className="link text-sm">← Homework</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">{homework.description ?? "Homework"}</h1>
        <p className="text-sm text-muted">
          Due {dateFmt.format(homework.deadline)} · enter by {formatCairo(correctionDeadline, "EEE d MMM, h:mm a")}
        </p>
      </div>

      {complete ? (
        <div className={`rounded-lg px-3 py-2.5 text-sm ${late ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
          All {total} reviewed · completed {completionAt ? formatCairo(completionAt) : ""} —{" "}
          {late ? "Late (after 9pm Saturday)" : "On time"}
        </div>
      ) : (
        <div className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          Incomplete — {reviewed} of {total} students reviewed. Mark every student before this
          counts as done.
        </div>
      )}

      <form action={submitHomeworkSubmissions.bind(null, homeworkId)} className="flex flex-col gap-3">
        {students.length === 0 ? (
          <p className="card px-4 py-5 text-sm text-muted">No students assigned to you in this class.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {students.map((s) => {
              const sub = byStudent.get(s.id);
              const isSubmitted = !!sub && sub.submissionDate !== null;
              const isNotSubmitted = !!sub && sub.submissionDate === null;
              const dateVal = sub?.submissionDate
                ? sub.submissionDate.toISOString().slice(0, 10)
                : deadlineValue;
              return (
                <li
                  key={s.id}
                  className={`card p-3.5 ${sub ? "" : "border-l-2 border-l-warn"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{s.name}</span>
                    {sub?.status ? (
                      <span className={STATUS_STYLE[sub.status]}>{STATUS_LABEL[sub.status]}</span>
                    ) : (
                      <span className="badge-warn">needs review</span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="radio" name={`state_${s.id}`} value="submitted" defaultChecked={isSubmitted} className="accent-brand" />
                      Submitted
                    </label>
                    <input type="date" name={`date_${s.id}`} defaultValue={dateVal} className="input w-auto !py-1.5" />
                    <label className="flex items-center gap-1.5 text-sm">
                      <input type="radio" name={`state_${s.id}`} value="not_submitted" defaultChecked={isNotSubmitted} className="accent-brand" />
                      Not submitted
                    </label>
                  </div>
                  <input
                    name={`weak_${s.id}`}
                    defaultValue={sub?.weakPoints ?? ""}
                    placeholder="weak points (optional)"
                    className={`${inputCls} mt-2`}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {students.length > 0 && (
          <button type="submit" className="btn-primary self-start">
            Save homework data
          </button>
        )}
      </form>
    </div>
  );
}
