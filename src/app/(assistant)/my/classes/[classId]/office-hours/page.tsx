import Link from "next/link";
import { requireClassAccess, getVisibleStudentIds } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { deleteOfficeHour } from "@/actions/office-hours";
import { OfficeHourForm } from "./office-hour-form";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function OfficeHoursPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const user = await requireClassAccess(classId);

  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { name: true, yearGroup: true },
  });
  if (!klass) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Class not found</h1>
        <Link href="/my" className="text-sm text-blue-600 hover:underline">← My Classes</Link>
      </div>
    );
  }

  const visibleIds = await getVisibleStudentIds(classId, user);
  const [students, topics, sessions] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: visibleIds }, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.topic.findMany({
      where: { yearGroup: klass.yearGroup },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
    prisma.officeHourSession.findMany({
      where: {
        classId,
        ...(user.assistantId ? { assistantId: user.assistantId } : {}),
      },
      orderBy: { date: "desc" },
      include: { student: { select: { name: true } }, topic: { select: { title: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/my/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← {klass.name}</Link>
        <h1 className="mt-1 text-lg font-semibold">Office hours</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{sessions.length} logged · +100 EGP each</p>
      </div>

      <section>
        <h2 className="mb-3 font-medium">Log a session</h2>
        <OfficeHourForm classId={classId} students={students} topics={topics} />
      </section>

      <section>
        <h2 className="mb-3 font-medium">Logged sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">None yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-black/5 py-2 dark:border-white/5">
                <span className="flex-1">
                  <span className="font-medium">{s.student.name}</span>
                  {s.topic?.title || s.topicNotes ? (
                    <span className="text-black/50 dark:text-white/50"> · {s.topic?.title ?? s.topicNotes}</span>
                  ) : null}
                  {s.durationMin ? <span className="text-black/40"> · {s.durationMin}m</span> : null}
                </span>
                <span className="text-black/40">{dateFmt.format(s.date)}</span>
                <form action={deleteOfficeHour.bind(null, s.id)}>
                  <button type="submit" className="text-red-600 hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
