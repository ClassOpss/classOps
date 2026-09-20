import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";
import { cairoToday, quizPrepDeadline, formatCairo, isLate } from "@/lib/datetime";
import { quizDatesBetween, addDays, QUIZ_CADENCE_DAYS, QUIZ_PREP_LEAD_DAYS } from "@/lib/quiz";
import { saveQuizPrep } from "@/actions/quiz-prep";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export default async function QuizPrepPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, quizDay: true, quizStartDate: true, operationId: true },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Class not found</h1>
        <Link href="/my" className="link text-sm">← My Classes</Link>
      </div>
    );
  }

  const back = (
    <div>
      <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass.name}</Link>
      <h1 className="mt-1 text-lg font-semibold tracking-tight">Quiz prep</h1>
    </div>
  );

  if (!klass.quizStartDate) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p className="card px-4 py-6 text-center text-sm text-muted">
          This class has no biweekly quiz set up. An admin can add a quiz day in the class settings.
        </p>
      </div>
    );
  }

  const cfg = await resolveConfigFor(klass.operationId);
  const today = cairoToday();
  // Show the last cycle plus the next couple: [today − 14, today + 28].
  const dates = quizDatesBetween(klass.quizStartDate, addDays(today, -QUIZ_CADENCE_DAYS), addDays(today, 28));

  const preps = await prisma.quizPrep.findMany({
    where: { classId, quizDate: { in: dates } },
    select: { quizDate: true, quizCreated: true, sentToPrint: true, completedAt: true },
  });
  const byDate = new Map(preps.map((p) => [p.quizDate.getTime(), p]));

  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      {back}
      <p className="text-sm text-muted">
        Every {QUIZ_CADENCE_DAYS} days on {klass.quizDay}. {QUIZ_PREP_LEAD_DAYS} days before each quiz, create
        the quiz and send it for printing. Either assistant on this class can tick these off.
      </p>

      <ul className="flex flex-col gap-3">
        {dates.map((d) => {
          const prep = byDate.get(d.getTime());
          const deadline = quizPrepDeadline(d, cfg);
          const complete = !!prep && prep.quizCreated && prep.sentToPrint;
          const late = complete && prep!.completedAt != null && isLate(prep!.completedAt, deadline);
          const overdue = !complete && now.getTime() > deadline.getTime();

          const badge = complete
            ? late
              ? <span className="badge-warn">Done · Late</span>
              : <span className="badge-success">Done · On time</span>
            : overdue
              ? <span className="badge-danger">Overdue</span>
              : <span className="badge-neutral">Due {formatCairo(deadline, "d MMM, h:mm a")}</span>;

          const dstr = d.toISOString().slice(0, 10);
          return (
            <li key={dstr} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">Quiz — {dateFmt.format(d)}</p>
                  <p className="text-xs text-faint">Prep deadline {formatCairo(deadline, "EEE d MMM, h:mm a")}</p>
                </div>
                {badge}
              </div>
              <form action={saveQuizPrep.bind(null, classId, dstr)} className="mt-3 flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="quizCreated" defaultChecked={!!prep?.quizCreated} className="accent-brand" />
                  Quiz created
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="sentToPrint" defaultChecked={!!prep?.sentToPrint} className="accent-brand" />
                  Sent for printing
                </label>
                <button type="submit" className="btn-secondary btn-sm mt-1 self-start">Save</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
