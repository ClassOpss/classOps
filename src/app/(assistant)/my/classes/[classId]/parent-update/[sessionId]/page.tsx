import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { markParentUpdateSent } from "@/actions/parent-update";
import { buildClassUpdateMessage } from "@/lib/whatsapp/class-update";
import { sessionStart, sessionDeadline, isLate, formatCairo } from "@/lib/datetime";
import { resolveConfig } from "@/lib/operation";
import { CopyMessage } from "./copy-message";

const longDate = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function ParentUpdatePage({
  params,
}: {
  params: Promise<{ classId: string; sessionId: string }>;
}) {
  const { classId, sessionId } = await params;
  await requireClassAccess(classId);

  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      scheduledDate: true,
      dayOff: true,
      messageNotes: true,
      topic: { select: { title: true } },
      homework: { select: { description: true, deadline: true, noHomework: true } },
      class: { select: { name: true, schedule: true, school: { select: { name: true } } } },
      parentUpdate: { select: { sentAt: true } },
    },
  });
  if (!session || session.classId !== classId) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Session not found</h1>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← Back</Link>
      </div>
    );
  }

  const sched = (session.class.schedule ?? {}) as { time?: string };
  const notStarted = !session.dayOff && new Date() < sessionStart(session.scheduledDate, sched.time);

  if (session.dayOff || notStarted) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={`/my/classes/${classId}`} className="link text-sm">← Back</Link>
        <h1 className="text-lg font-semibold">Parent update</h1>
        <p className="text-sm text-muted">
          {session.dayOff
            ? "This is a day off — no parent update to send."
            : "Send the parent update after the class has taken place."}
        </p>
      </div>
    );
  }

  const attendance = await prisma.attendance.findMany({
    where: { sessionId },
    select: { status: true, student: { select: { name: true } } },
  });
  const absentNames = attendance
    .filter((a) => a.status === "absent")
    .map((a) => a.student.name)
    .sort();

  const cfg = await resolveConfig();
  const hw = session.homework;
  const message = buildClassUpdateMessage(
    {
      dateLabel: longDate.format(session.scheduledDate),
      className: session.class.name,
      schoolName: session.class.school.name,
      topic: session.topic?.title,
      attendanceLogged: attendance.length > 0,
      absentNames,
      newHomework: hw && !hw.noHomework ? hw.description : null,
      homeworkDueLabel: hw && !hw.noHomework && hw.deadline ? longDate.format(hw.deadline) : null,
      notes: session.messageNotes,
    },
    cfg.brandSignature,
  );

  const sentAt = session.parentUpdate?.sentAt ?? null;
  const late = sentAt ? isLate(sentAt, sessionDeadline(session.scheduledDate, cfg)) : false;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← Back</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Parent update</h1>
        <p className="text-sm text-muted">
          {longDate.format(session.scheduledDate)} · {session.class.name}
        </p>
      </div>

      {attendance.length === 0 && (
        <p className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          Log attendance first so absentees appear in the message.
        </p>
      )}

      <pre className="card whitespace-pre-wrap bg-card-muted p-4 text-sm">
        {message}
      </pre>

      <div className="flex flex-wrap items-center gap-3">
        <CopyMessage text={message} />
        <form action={markParentUpdateSent.bind(null, sessionId)}>
          <button type="submit" className="btn-secondary">
            {sentAt ? "Mark as sent again" : "Mark as sent →"}
          </button>
        </form>
      </div>

      {sentAt && (
        <div className={`rounded-lg px-3 py-2.5 text-sm ${late ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
          Sent at {formatCairo(sentAt)} — {late ? "Late (after the 9pm deadline)" : "On time"}
        </div>
      )}
    </div>
  );
}
