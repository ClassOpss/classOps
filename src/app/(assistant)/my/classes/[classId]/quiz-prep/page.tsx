import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";
import { cairoToday, quizPrepDeadline, quizAnnounceDeadline, formatCairo, isLate } from "@/lib/datetime";
import {
  scheduledQuizDatesBetween,
  effectiveQuizDate,
  quizPrepComplete,
  quizAnnounced,
  addDays,
  QUIZ_CADENCE_DAYS,
} from "@/lib/quiz";
import { buildBiweeklyQuizAnnouncement } from "@/lib/whatsapp/quiz-announcement";
import { saveQuizPrep, markQuizAnnounced, setQuizCoverage } from "@/actions/quiz-prep";
import { CopyMessage } from "@/components/copy-message";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function QuizPrepPage({ params }: { params: Promise<{ classId: string }> }) {
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
      <h1 className="mt-1 text-lg font-semibold tracking-tight">Quiz tasks</h1>
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
  const scheduled = scheduledQuizDatesBetween(klass.quizStartDate, addDays(today, -QUIZ_CADENCE_DAYS), addDays(today, 28));

  const rows = await prisma.quizPrep.findMany({
    where: { classId, scheduledDate: { in: scheduled } },
    select: {
      scheduledDate: true,
      quizDate: true,
      coverage: true,
      quizCreated: true,
      sentToPrint: true,
      completedAt: true,
      announcedAt: true,
    },
  });
  const bySched = new Map(rows.map((r) => [r.scheduledDate.getTime(), r]));
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      {back}
      <p className="text-sm text-muted">
        Every {QUIZ_CADENCE_DAYS} days on {klass.quizDay}. For each quiz: send the announcement
        (~{cfg.quizAnnounceLeadDays}d before), then create the quiz and send it to print (~{cfg.quizPrepLeadDays}d before).
        Either assistant on this class can complete these.
      </p>

      <ul className="flex flex-col gap-3">
        {scheduled.map((sched) => {
          const row = bySched.get(sched.getTime());
          const actual = effectiveQuizDate(sched, row);
          const moved = actual.getTime() !== sched.getTime();

          // Announcement status
          const annDl = quizAnnounceDeadline(actual, cfg);
          const announced = quizAnnounced(row);
          const annLate = announced && isLate(row!.announcedAt!, annDl);
          const annOverdue = !announced && now.getTime() > annDl.getTime();
          const annBadge = announced
            ? annLate
              ? <span className="badge-warn">Sent · Late</span>
              : <span className="badge-success">Sent · On time</span>
            : annOverdue
              ? <span className="badge-danger">Overdue</span>
              : <span className="badge-neutral">Send by {formatCairo(annDl, "d MMM")}</span>;

          // Prep status
          const prepDl = quizPrepDeadline(actual, cfg);
          const prepDone = quizPrepComplete(row);
          const prepLate = prepDone && row!.completedAt != null && isLate(row!.completedAt, prepDl);
          const prepOverdue = !prepDone && now.getTime() > prepDl.getTime();
          const prepBadge = prepDone
            ? prepLate
              ? <span className="badge-warn">Done · Late</span>
              : <span className="badge-success">Done · On time</span>
            : prepOverdue
              ? <span className="badge-danger">Overdue</span>
              : <span className="badge-neutral">Due {formatCairo(prepDl, "d MMM")}</span>;

          const message = buildBiweeklyQuizAnnouncement({ date: actual, coverage: row?.coverage, signature: cfg.brandSignature });
          const s = iso(sched);

          return (
            <li key={s} className="card flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">
                  Quiz — {dateFmt.format(actual)}
                  {moved && <span className="ml-2 badge-neutral">moved</span>}
                </p>
              </div>

              {/* Announcement */}
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">1 · Announcement</p>
                  {annBadge}
                </div>
                <form action={setQuizCoverage.bind(null, classId, s)} className="mt-2 flex items-end gap-2">
                  <label className="block flex-1">
                    <span className="label">Topics covered</span>
                    <input
                      name="coverage"
                      defaultValue={row?.coverage ?? ""}
                      placeholder="e.g. Right angled triangle"
                      className="input"
                    />
                  </label>
                  <button type="submit" className="btn-secondary btn-sm">Save</button>
                </form>
                <p className="mt-2 text-xs text-faint">Message preview (updates after you save the topics):</p>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-card-muted p-3 text-xs">{message}</pre>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyMessage message={message} />
                  {!announced && (
                    <form action={markQuizAnnounced.bind(null, classId, s)}>
                      <button type="submit" className="btn-secondary btn-sm">Mark as sent →</button>
                    </form>
                  )}
                  {announced && (
                    <span className="text-xs text-faint">Sent {formatCairo(row!.announcedAt!, "d MMM, h:mm a")}</span>
                  )}
                </div>
              </div>

              {/* Prep */}
              <form action={saveQuizPrep.bind(null, classId, s)} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">2 · Prepare quiz</p>
                  {prepBadge}
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="quizCreated" defaultChecked={!!row?.quizCreated} className="accent-brand" />
                    Quiz created
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="sentToPrint" defaultChecked={!!row?.sentToPrint} className="accent-brand" />
                    Sent for printing
                  </label>
                  <button type="submit" className="btn-secondary btn-sm mt-1 self-start">Save</button>
                </div>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
