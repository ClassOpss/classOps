import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { sessionStart } from "@/lib/datetime";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export default async function AssistantClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, schedule: true, school: { select: { name: true } } },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Class not found</h1>
        <Link href="/my" className="text-sm text-blue-600 hover:underline">← My Classes</Link>
      </div>
    );
  }

  const sessions = await prisma.classSession.findMany({
    where: { classId },
    orderBy: { scheduledDate: "desc" },
    include: {
      topic: { select: { title: true } },
      _count: { select: { attendance: true } },
    },
  });

  const sched = (klass.schedule ?? {}) as { time?: string };
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/my" className="text-sm text-blue-600 hover:underline">← My Classes</Link>
        <h1 className="mt-1 text-lg font-semibold">{klass.name}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{klass.school.name}</p>
      </div>

      <Link
        href={`/my/classes/${classId}/homework`}
        className="text-sm text-blue-600 hover:underline"
      >
        Homework →
      </Link>

      <h2 className="font-medium">Attendance</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">No sessions scheduled yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const logged = s._count.attendance > 0;
            const upcoming = !s.dayOff && now < sessionStart(s.scheduledDate, sched.time);
            const loggable = !s.dayOff && !upcoming;
            const status = s.dayOff
              ? "Day off"
              : upcoming
                ? "Upcoming"
                : logged
                  ? "Logged"
                  : "Log →";
            const statusCls =
              s.dayOff || upcoming
                ? "text-black/40"
                : logged
                  ? "text-green-600"
                  : "text-amber-600";
            const row = (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{dateFmt.format(s.scheduledDate)}</p>
                  <p className="text-sm text-black/50 dark:text-white/50">
                    {s.dayOff ? "Day off" : (s.topic?.title ?? "—")}
                  </p>
                </div>
                <span className={`text-sm ${statusCls}`}>{status}</span>
              </div>
            );
            return (
              <li key={s.id}>
                {loggable ? (
                  <Link
                    href={`/my/classes/${classId}/attendance/${s.id}`}
                    className="block rounded-lg border border-black/10 p-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="rounded-lg border border-black/10 p-3 text-black/40 dark:border-white/10">
                    {row}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
