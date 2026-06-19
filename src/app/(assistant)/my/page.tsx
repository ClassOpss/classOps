import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

type Schedule = { day?: string; time?: string };

export default async function MyClassesPage() {
  const user = await requireRole("assistant", "admin");

  if (!user.assistantId) {
    return (
      <div>
        <h1 className="text-lg font-semibold">My Classes</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          This account has no assistant profile. (Admins manage classes from the admin area.)
        </p>
      </div>
    );
  }

  const now = new Date();
  const assignments = await prisma.classAssignment.findMany({
    where: {
      assistantId: user.assistantId,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
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

  const classes = assignments.map((a) => a.class).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">My Classes</h1>
      {classes.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">No classes assigned to you yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {classes.map((c) => {
            const sched = (c.schedule ?? {}) as Schedule;
            return (
              <li key={c.id}>
                <Link
                  href={`/my/classes/${c.id}`}
                  className="block rounded-lg border border-black/10 p-4 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                >
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-black/50 dark:text-white/50">
                    {c.school.name} · {sched.day} {sched.time} · {c._count.students} students
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
