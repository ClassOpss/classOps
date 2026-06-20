import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { submitHomeworkSubmissions } from "@/actions/homework";
import { saturdayDeadline, isLate, formatCairo } from "@/lib/datetime";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const STATUS_STYLE: Record<string, string> = {
  on_time: "text-green-600",
  late: "text-amber-600",
  missing: "text-red-600",
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
        <Link href={`/my/classes/${classId}/homework`} className="text-sm text-blue-600 hover:underline">← Homework</Link>
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

  const correctionDeadline = saturdayDeadline(homework.deadline);
  // When the correction became complete = the last student first reviewed (max loggedAt).
  // loggedAt isn't bumped on edits, so later edits don't move this.
  const completionAt = complete
    ? submissions.map((s) => s.loggedAt).sort((a, b) => b.getTime() - a.getTime())[0]
    : null;
  const late = completionAt ? isLate(completionAt, correctionDeadline) : false;

  const deadlineValue = homework.deadline.toISOString().slice(0, 10);
  const inputCls =
    "rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}/homework`} className="text-sm text-blue-600 hover:underline">← Homework</Link>
        <h1 className="mt-1 text-lg font-semibold">{homework.description ?? "Homework"}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Due {dateFmt.format(homework.deadline)} · enter by {formatCairo(correctionDeadline, "EEE d MMM, h:mm a")}
        </p>
      </div>

      {complete ? (
        <div
          className={`rounded-md p-3 text-sm ${
            late
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30"
              : "bg-green-50 text-green-700 dark:bg-green-950/30"
          }`}
        >
          All {total} reviewed · completed {completionAt ? formatCairo(completionAt) : ""} —{" "}
          {late ? "Late (after 9pm Saturday)" : "On time"}
        </div>
      ) : (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30">
          Incomplete — {reviewed} of {total} students reviewed. Mark every student before this
          counts as done.
        </div>
      )}

      <form action={submitHomeworkSubmissions.bind(null, homeworkId)} className="flex flex-col gap-3">
        {students.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No students assigned to you in this class.</p>
        ) : (
          <ul className="flex flex-col gap-3">
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
                  className={`rounded-md border-l-2 pl-3 pb-3 ${
                    sub ? "border-transparent" : "border-amber-400"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    {sub?.status ? (
                      <span className={`text-xs ${STATUS_STYLE[sub.status]}`}>{STATUS_LABEL[sub.status]}</span>
                    ) : (
                      <span className="text-xs text-amber-600">needs review</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1 text-sm">
                      <input type="radio" name={`state_${s.id}`} value="submitted" defaultChecked={isSubmitted} />
                      Submitted
                    </label>
                    <input type="date" name={`date_${s.id}`} defaultValue={dateVal} className={inputCls} />
                    <label className="flex items-center gap-1 text-sm">
                      <input type="radio" name={`state_${s.id}`} value="not_submitted" defaultChecked={isNotSubmitted} />
                      Not submitted
                    </label>
                  </div>
                  <input
                    name={`weak_${s.id}`}
                    defaultValue={sub?.weakPoints ?? ""}
                    placeholder="weak points (optional)"
                    className={`${inputCls} mt-2 w-full`}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {students.length > 0 && (
          <button
            type="submit"
            className="mt-1 self-start rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Save homework data
          </button>
        )}
      </form>
    </div>
  );
}
