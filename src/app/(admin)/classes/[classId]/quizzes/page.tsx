import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId, resolveConfigFor } from "@/lib/operation";
import { cairoToday, quizPrepDeadline, quizAnnounceDeadline, formatCairo } from "@/lib/datetime";
import {
  quizCyclesBetween,
  quizPrepComplete,
  quizAnnounced,
  addDays,
  QUIZ_CADENCE_DAYS,
} from "@/lib/quiz";
import { setQuizDate, setQuizCoverage } from "@/actions/quiz-prep";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function ClassQuizzesPage({ params }: { params: Promise<{ classId: string }> }) {
  await requireRole("admin", "teacher");
  const { classId } = await params;
  const operationId = await currentOperationId();

  const klass = await prisma.class.findFirst({
    where: { id: classId, operationId },
    select: { id: true, name: true, quizDay: true, quizStartDate: true },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="page-title">Class not found</h1>
        <Link href="/classes" className="link text-sm">← Classes</Link>
      </div>
    );
  }

  const back = (
    <div>
      <Link href={`/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
      <h1 className="mt-1 page-title">Quizzes &amp; dates</h1>
    </div>
  );

  const cfg = await resolveConfigFor(operationId);
  const today = cairoToday();

  const rows = await prisma.quizPrep.findMany({
    where: { classId },
    select: { scheduledDate: true, adHoc: true, quizDate: true, coverage: true, quizCreated: true, sentToPrint: true, completedAt: true, announcedAt: true, assessment: { select: { label: true, maxMark: true, type: true } } },
  });
  // Show the last cycle + roughly the next 3 months.
  const cycles = quizCyclesBetween(klass.quizStartDate, rows, addDays(today, -QUIZ_CADENCE_DAYS), addDays(today, 90));

  if (cycles.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="card px-4 py-6 text-center text-sm text-muted">
          No upcoming quizzes. Set a quiz day + first-quiz date in the class settings for the biweekly
          quiz; every assessment added to the class also appears here with its own tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {back}
      <p className="page-subtitle">
        {klass.quizStartDate
          ? `Every ${QUIZ_CADENCE_DAYS} days on ${klass.quizDay}, plus every assessment added to the class. `
          : "Every assessment added to this class. "}
        Move a single quiz here if something changes —
        its announcement ({cfg.quizAnnounceLeadDays}d before) and prep ({cfg.quizPrepLeadDays}d before) deadlines
        shift with it. Later quizzes stay on the schedule. Set what each quiz covers for the announcement message.
      </p>

      <ul className="flex flex-col gap-3">
        {cycles.map(({ scheduledDate: sched, quizDate: actual, row }) => {
          const moved = actual.getTime() !== sched.getTime();
          const s = iso(sched);

          return (
            <li key={s} className="card flex flex-col gap-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {row?.assessment && row.assessment.type !== "quiz" ? row.assessment.label : "Quiz"} — {dateFmt.format(actual)}
                  {moved && <span className="ml-2 badge-neutral">moved from {dateFmt.format(sched)}</span>}
                </p>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {quizAnnounced(row) ? <span className="badge-success">Announced</span> : <span className="badge-neutral">Announce by {formatCairo(quizAnnounceDeadline(actual, cfg), "d MMM")}</span>}
                  {quizPrepComplete(row) ? <span className="badge-success">Prepared</span> : <span className="badge-neutral">Prep by {formatCairo(quizPrepDeadline(actual, cfg), "d MMM")}</span>}
                  {row?.assessment && (
                    <Link href={`/classes/${classId}/assessments`} className={row.assessment.maxMark == null ? "badge-warn" : "badge-neutral"}>
                      {row.assessment.label}{row.assessment.maxMark == null ? " · set max mark" : ` · /${row.assessment.maxMark}`}
                    </Link>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <form action={setQuizDate.bind(null, classId, s)} className="flex items-end gap-2">
                  <label className="block flex-1">
                    <span className="label">Quiz date</span>
                    <input name="quizDate" type="date" defaultValue={iso(actual)} className="input" />
                  </label>
                  <button type="submit" className="btn-secondary btn-sm">Save</button>
                </form>

                <form action={setQuizCoverage.bind(null, classId, s)} className="flex items-end gap-2">
                  <label className="block flex-1">
                    <span className="label">Covers (for the announcement)</span>
                    <input name="coverage" defaultValue={row?.coverage ?? ""} placeholder="e.g. Right angled triangle" className="input" />
                  </label>
                  <button type="submit" className="btn-secondary btn-sm">Save</button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
