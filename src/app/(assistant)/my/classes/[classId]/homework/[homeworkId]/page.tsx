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
    select: {
      id: true,
      classId: true,
      description: true,
      deadline: true,
      noHomework: true,
    },
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
      select: { id: true, name: true, code: true },
    }),
    prisma.homeworkSubmission.findMany({
      where: { homeworkId, studentId: { in: visibleIds } },
      select: { studentId: true, submissionDate: true, status: true, weakPoints: true, loggedAt: true },
    }),
  ]);
  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

  const correctionDeadline = saturdayDeadline(homework.deadline);
  const loggedAt = submissions.map((s) => s.loggedAt).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const late = loggedAt ? isLate(loggedAt, correctionDeadline) : false;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}/homework`} className="text-sm text-blue-600 hover:underline">← Homework</Link>
        <h1 className="mt-1 text-lg font-semibold">{homework.description ?? "Homework"}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Due {dateFmt.format(homework.deadline)} · enter by {formatCairo(correctionDeadline, "EEE d MMM, h:mm a")}
        </p>
      </div>

      {loggedAt && (
        <div
          className={`rounded-md p-3 text-sm ${
            late
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30"
              : "bg-green-50 text-green-700 dark:bg-green-950/30"
          }`}
        >
          Last saved {formatCairo(loggedAt)} — {late ? "Late (after 9pm Saturday)" : "On time"}
        </div>
      )}

      <form action={submitHomeworkSubmissions.bind(null, homeworkId)} className="flex flex-col gap-3">
        <p className="text-xs text-black/50 dark:text-white/50">
          Enter each student&apos;s submission date (leave blank if not submitted) and any weak points.
        </p>
        {students.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No students assigned to you in this class.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {students.map((s) => {
              const sub = byStudent.get(s.id);
              const dateVal = sub?.submissionDate ? sub.submissionDate.toISOString().slice(0, 10) : "";
              return (
                <li key={s.id} className="border-b border-black/5 pb-3 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    {sub?.status ? (
                      <span className={`text-xs ${STATUS_STYLE[sub.status]}`}>{STATUS_LABEL[sub.status]}</span>
                    ) : (
                      <span className="text-xs text-black/40">not entered</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <input
                      type="date"
                      name={`date_${s.id}`}
                      defaultValue={dateVal}
                      className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent"
                    />
                    <input
                      name={`weak_${s.id}`}
                      defaultValue={sub?.weakPoints ?? ""}
                      placeholder="weak points (optional)"
                      className="flex-1 rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent"
                    />
                  </div>
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
