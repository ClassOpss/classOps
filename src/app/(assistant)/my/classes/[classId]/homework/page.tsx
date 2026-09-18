import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { saturdayDeadline, formatCairo } from "@/lib/datetime";
import { resolveConfig } from "@/lib/operation";
import { addHomework, deleteHomework } from "@/actions/homework";

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
      select: { id: true, description: true, deadline: true, sessionId: true },
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

      <details className="card p-3.5">
        <summary className="cursor-pointer text-sm font-semibold">Add extra homework</summary>
        <p className="mt-1 text-sm text-muted">
          For homework not tied to a lesson. Homework from a lesson is added on its attendance page.
        </p>
        <form action={addHomework.bind(null, classId)} className="mt-3 flex flex-col gap-3">
          <label className="block">
            <span className="label">Description</span>
            <input name="description" required placeholder="e.g. Exercise 4B, Q1–10" className="input" />
          </label>
          <label className="block">
            <span className="label">Due date</span>
            <input type="date" name="deadline" required className="input w-auto" />
          </label>
          <button type="submit" className="btn-primary self-start">Add homework</button>
        </form>
      </details>

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
              <li key={hw.id} className="card p-3.5">
                <Link
                  href={`/my/classes/${classId}/homework/${hw.id}`}
                  className="block transition-colors hover:opacity-80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">
                      {hw.description ?? "Homework"}
                      {!hw.sessionId && <span className="badge-neutral ml-2 align-middle">Extra</span>}
                    </p>
                    <span className={complete ? "badge-success" : "badge-warn"}>
                      {complete ? "Complete" : `${reviewed}/${total} reviewed`}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    Due {dateFmt.format(hw.deadline)} · enter by {formatCairo(saturdayDeadline(hw.deadline, cfg), "EEE d MMM, h:mm a")}
                  </p>
                </Link>
                {!hw.sessionId && (
                  <form action={deleteHomework.bind(null, hw.id)} className="mt-2">
                    <button type="submit" className="link text-xs text-danger">Remove</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
