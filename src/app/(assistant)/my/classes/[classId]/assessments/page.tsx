import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { loadPaperOwners, papersOf } from "@/lib/paper-owners";
import { prisma } from "@/lib/db";
import { saturdayDeadline, formatCairo } from "@/lib/datetime";
import { resolveConfig } from "@/lib/operation";
import { assessmentHeldAt } from "@/lib/task-timing";
import { AssessmentForm } from "@/app/(admin)/classes/[classId]/assessments/assessment-form";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AssessmentsListPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const user = await requireClassAccess(classId);

  const [klass, assessments] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true, schedule: true } }),
    prisma.assessment.findMany({
      where: { classId },
      orderBy: { date: "desc" },
      select: { id: true, label: true, type: true, date: true, time: true, maxMark: true, isDiagnostic: true },
    }),
  ]);
  // Per assessment: the papers that are this assistant's (sub-group, or taken over) and how
  // many of those are graded. Admin/teacher (no assistantId) see the whole class.
  const papers = await loadPaperOwners(assessments.map((a) => a.id));
  const progress = (id: string) => {
    const p = papers.get(id);
    if (!p) return { graded: 0, total: 0 };
    const mine = user.assistantId ? papersOf(p.owners, user.assistantId) : [...p.owners.keys()];
    return { graded: mine.filter((s) => p.graded.has(s)).length, total: mine.length };
  };
  const cfg = await resolveConfig();
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass?.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Assessments</h1>
      </div>

      <details className="card p-4">
        <summary className="section-title cursor-pointer">New assessment</summary>
        <div className="mt-3">
          <AssessmentForm classId={classId} />
        </div>
      </details>

      {assessments.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">No assessments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assessments.map((a) => {
            const { graded, total } = progress(a.id);
            const complete = total > 0 && graded === total;
            // Not sat yet -> nothing to grade, so no to-do badge.
            const upcoming = now < assessmentHeldAt(a.date, a.time, klass?.schedule);
            return (
              <li key={a.id}>
                <Link
                  href={`/my/classes/${classId}/assessments/${a.id}`}
                  className="card block p-3.5 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      {a.label}
                      {a.isDiagnostic ? <span className="ml-1.5 badge-neutral">Diagnostic</span> : null}
                    </p>
                    {upcoming && !complete ? (
                      <span className="badge-neutral">Upcoming</span>
                    ) : a.maxMark == null ? (
                      <span className="badge-warn">Set max mark</span>
                    ) : total === 0 ? (
                      <span className="badge-neutral">Colleague correcting</span>
                    ) : (
                      <span className={complete ? "badge-success" : "badge-warn"}>
                        {complete ? "Complete" : `${graded}/${total} graded`}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {dateFmt.format(a.date)} · max {a.maxMark ?? "not set"} · enter by{" "}
                    {formatCairo(saturdayDeadline(a.date, cfg), "EEE d MMM, h:mm a")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
