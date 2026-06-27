import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { sessionStart } from "@/lib/datetime";
import { scheduleTimeForDate } from "@/lib/schedule";

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
        <h1 className="text-lg font-semibold tracking-tight">Class not found</h1>
        <Link href="/my" className="link text-sm">← My Classes</Link>
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

  const schedule = klass.schedule as object;
  const now = new Date();
  const myId = user.assistantId;

  // Mine = sessions I own (or cover), plus any unowned ones so they're never hidden.
  // Others = owned by the other assistant — shown collapsed under "cover a session".
  const owner = (s: SessionRow) => s.coveredById ?? s.responsibleAssistantId;
  const mine = myId ? sessions.filter((s) => owner(s) === myId || owner(s) === null) : sessions;
  const others = myId ? sessions.filter((s) => owner(s) !== myId && owner(s) !== null) : [];

  function SessionItem({ s }: { s: SessionRow }) {
    const logged = s._count.attendance > 0;
    const upcoming = !s.dayOff && now < sessionStart(s.scheduledDate, scheduleTimeForDate(schedule, s.scheduledDate));
    const loggable = !s.dayOff && !upcoming;
    const status = s.dayOff ? "Day off" : upcoming ? "Upcoming" : logged ? "Logged" : "Log →";
    const badgeCls =
      s.dayOff || upcoming ? "badge-neutral" : logged ? "badge-success" : "badge-warn";
    const row = (
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{dateFmt.format(s.scheduledDate)}</p>
          <p className="text-sm text-muted">
            {s.dayOff ? "Day off" : (s.topic?.title ?? "—")}
          </p>
        </div>
        <span className={badgeCls}>{status}</span>
      </div>
    );
    return loggable ? (
      <Link
        href={`/my/classes/${classId}/attendance/${s.id}`}
        className="card block p-3.5 transition-colors hover:border-border-strong"
      >
        {row}
      </Link>
    ) : (
      <div className="card p-3.5 opacity-70">{row}</div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/my" className="link text-sm">← My Classes</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">{klass.name}</h1>
        <p className="text-sm text-muted">{klass.school.name}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { href: `/my/classes/${classId}/homework`, label: "Homework" },
          { href: `/my/classes/${classId}/assessments`, label: "Assessments" },
          { href: `/my/classes/${classId}/office-hours`, label: "Office hours" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="card px-2 py-3 text-center text-sm font-medium text-fg transition-colors hover:border-border-strong">
            {l.label}
          </Link>
        ))}
      </div>

      <h2 className="mt-2 section-title">Attendance — your sessions</h2>
      {mine.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">No sessions assigned to you.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((s) => <li key={s.id}><SessionItem s={s} /></li>)}
        </ul>
      )}

      {others.length > 0 && (
        <details className="card p-3.5">
          <summary className="cursor-pointer text-sm font-medium text-muted">
            Cover a session for a colleague ({others.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {others.map((s) => <li key={s.id}><SessionItem s={s} /></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
