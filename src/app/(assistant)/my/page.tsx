import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { scheduleLabel } from "@/lib/schedule";
import { formatCairo, cairoToday } from "@/lib/datetime";

export default async function MyClassesPage() {
  const user = await requireRole("assistant", "admin");

  if (!user.assistantId) {
    return (
      <div>
        <h1 className="text-lg font-semibold tracking-tight">My Classes</h1>
        <p className="mt-2 text-sm text-muted">
          This account has no assistant profile. (Admins manage classes from the admin area.)
        </p>
      </div>
    );
  }

  const today = cairoToday(); // @db.Date assignment window — compare by calendar date
  const assignments = await prisma.classAssignment.findMany({
    where: {
      assistantId: user.assistantId,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      // Only surface classes that are still active. This filters each assignment
      // by its own class, so deactivating one class drops only that class from
      // the list — the assistant's other classes are unaffected.
      class: { active: true },
    },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          schedule: true,
          school: { select: { name: true } },
          _count: { select: { students: true } },
        },
      },
    },
  });

  const classes = assignments
    .map((a) => ({ ...a.class, isCover: a.isSubstitute, coverUntil: a.endDate }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">My Classes</h1>
      {classes.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">No classes assigned to you yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/my/classes/${c.id}`}
                className="card flex items-center justify-between p-4 transition-colors hover:border-border-strong"
              >
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {c.name}
                    {c.isCover && (
                      <span className="badge-warn text-[0.65rem]">
                        Cover{c.coverUntil ? ` · until ${formatCairo(c.coverUntil, "d MMM")}` : ""}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {c.school.name} · {scheduleLabel(c.schedule as object)} · {c._count.students} students
                  </p>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-faint" aria-hidden>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
