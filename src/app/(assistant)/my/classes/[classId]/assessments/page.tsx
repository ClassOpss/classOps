import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { saturdayDeadline, formatCairo } from "@/lib/datetime";
import { resolveConfig } from "@/lib/operation";

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

  const [klass, visibleIds, assessments] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    getVisibleStudentIds(classId, user),
    prisma.assessment.findMany({
      where: { classId },
      orderBy: { date: "desc" },
      select: { id: true, label: true, type: true, date: true, maxMark: true, isDiagnostic: true },
    }),
  ]);
  const total = visibleIds.length;

  const counts = await prisma.assessmentGrade.groupBy({
    by: ["assessmentId"],
    where: { assessmentId: { in: assessments.map((a) => a.id) }, studentId: { in: visibleIds } },
    _count: { _all: true },
  });
  const gradedBy = new Map(counts.map((c) => [c.assessmentId, c._count._all]));
  const cfg = await resolveConfig();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass?.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Assessments</h1>
      </div>

      {assessments.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">No assessments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assessments.map((a) => {
            const graded = gradedBy.get(a.id) ?? 0;
            const complete = total > 0 && graded === total;
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
                    <span className={complete ? "badge-success" : "badge-warn"}>
                      {complete ? "Complete" : `${graded}/${total} graded`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {dateFmt.format(a.date)} · max {a.maxMark} · enter by{" "}
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
