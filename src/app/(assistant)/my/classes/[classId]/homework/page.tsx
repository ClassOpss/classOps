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

export default async function HomeworkListPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const user = await requireClassAccess(classId);

  const [klass, visibleIds, homeworks] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { name: true } }),
    getVisibleStudentIds(classId, user),
    prisma.homeworkAssignment.findMany({
      where: { classId, noHomework: false },
      orderBy: { deadline: "desc" },
      select: { id: true, description: true, deadline: true },
    }),
  ]);
  const total = visibleIds.length;

  const counts = await prisma.homeworkSubmission.groupBy({
    by: ["homeworkId"],
    where: { homeworkId: { in: homeworks.map((h) => h.id) }, studentId: { in: visibleIds } },
    _count: { _all: true },
  });
  const reviewedBy = new Map(counts.map((c) => [c.homeworkId, c._count._all]));
  const cfg = await resolveConfig();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← {klass?.name}</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Homework</h1>
      </div>

      {homeworks.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">
          No homework assigned yet. Homework is added from a session&apos;s lesson details.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {homeworks.map((hw) => {
            const reviewed = reviewedBy.get(hw.id) ?? 0;
            const complete = total > 0 && reviewed === total;
            return (
              <li key={hw.id}>
                <Link
                  href={`/my/classes/${classId}/homework/${hw.id}`}
                  className="card block p-3.5 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{hw.description ?? "Homework"}</p>
                    <span className={complete ? "badge-success" : "badge-warn"}>
                      {complete ? "Complete" : `${reviewed}/${total} reviewed`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    Due {dateFmt.format(hw.deadline)} · enter by {formatCairo(saturdayDeadline(hw.deadline, cfg), "EEE d MMM, h:mm a")}
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
