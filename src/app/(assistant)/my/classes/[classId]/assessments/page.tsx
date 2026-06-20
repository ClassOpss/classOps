import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { saturdayDeadline, formatCairo } from "@/lib/datetime";

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← {klass?.name}</Link>
        <h1 className="mt-1 text-lg font-semibold">Assessments</h1>
      </div>

      {assessments.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">No assessments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {assessments.map((a) => {
            const graded = gradedBy.get(a.id) ?? 0;
            const complete = total > 0 && graded === total;
            return (
              <li key={a.id}>
                <Link
                  href={`/my/classes/${classId}/assessments/${a.id}`}
                  className="block rounded-lg border border-black/10 p-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {a.label}
                      {a.isDiagnostic ? <span className="ml-1 text-xs text-black/40">· Diagnostic</span> : null}
                    </p>
                    <span className={`text-sm ${complete ? "text-green-600" : "text-amber-600"}`}>
                      {complete ? "Complete" : `${graded}/${total} graded →`}
                    </span>
                  </div>
                  <p className="text-sm text-black/50 dark:text-white/50">
                    {dateFmt.format(a.date)} · max {a.maxMark} · enter by{" "}
                    {formatCairo(saturdayDeadline(a.date), "EEE d MMM, h:mm a")}
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
