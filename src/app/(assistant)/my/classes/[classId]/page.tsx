import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { sessionStart } from "@/lib/datetime";
import { scheduleTime } from "@/lib/schedule";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

type SessionRow = {
  id: string;
  scheduledDate: Date;
  dayOff: boolean;
  responsibleAssistantId: string | null;
  coveredById: string | null;
  topic: { title: string } | null;
  _count: { attendance: number };
};

export default async function AssistantClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const user = await requireClassAccess(classId);

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

  const sessions = (await prisma.classSession.findMany({
    where: { classId },
    orderBy: { scheduledDate: "desc" },
    select: {
      id: true,
      scheduledDate: true,
      dayOff: true,
      responsibleAssistantId: true,
      coveredById: true,
      topic: { select: { title: true } },
      _count: { select: { attendance: true } },
    },
  })) as SessionRow[];

  const time = scheduleTime(klass.schedule as object);
  const now = new Date();
  const myId = user.assistantId;

  // Mine = sessions I own (or cover), plus any unowned ones so they're never hidden.
  // Others = owned by the other assistant — shown collapsed under "cover a session".
  const owner = (s: SessionRow) => s.coveredById ?? s.responsibleAssistantId;
  const mine = myId ? sessions.filter((s) => owner(s) === myId || owner(s) === null) : sessions;
  const others = myId ? sessions.filter((s) => owner(s) !== myId && owner(s) !== null) : [];

  function SessionItem({ s }: { s: SessionRow }) {
    const logged = s._count.attendance > 0;
    const upcoming = !s.dayOff && now < sessionStart(s.scheduledDate, time);
    const loggable = !s.dayOff && !upcoming;
    const status = s.dayOff ? "Day off" : upcoming ? "Upcoming" : logged ? "Logged" : "Log →";
    const statusCls =
      s.dayOff || upcoming ? "text-black/40" : logged ? "text-green-600" : "text-amber-600";
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
    return loggable ? (
      <Link
        href={`/my/classes/${classId}/attendance/${s.id}`}
        className="block rounded-lg border border-black/10 p-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
      >
        {row}
      </Link>
    ) : (
      <div className="rounded-lg border border-black/10 p-3 text-black/40 dark:border-white/10">{row}</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/my" className="text-sm text-blue-600 hover:underline">← My Classes</Link>
        <h1 className="mt-1 text-lg font-semibold">{klass.name}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{klass.school.name}</p>
      </div>

      <div className="flex gap-4">
        <Link href={`/my/classes/${classId}/homework`} className="text-sm text-blue-600 hover:underline">Homework →</Link>
        <Link href={`/my/classes/${classId}/assessments`} className="text-sm text-blue-600 hover:underline">Assessments →</Link>
        <Link href={`/my/classes/${classId}/office-hours`} className="text-sm text-blue-600 hover:underline">Office hours →</Link>
      </div>

      <h2 className="font-medium">Attendance — your sessions</h2>
      {mine.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">No sessions assigned to you.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((s) => <li key={s.id}><SessionItem s={s} /></li>)}
        </ul>
      )}

      {others.length > 0 && (
        <details className="rounded-lg border border-black/10 p-3 dark:border-white/10">
          <summary className="cursor-pointer text-sm text-black/60 dark:text-white/60">
            Cover a session for a colleague ({others.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {others.map((s) => <li key={s.id}><SessionItem s={s} /></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
