import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { markParentUpdateSent } from "@/actions/parent-update";
import { buildClassUpdateMessage } from "@/lib/whatsapp/class-update";
import { sessionStart, sessionDeadline, isLate, latenessApplies, formatCairo } from "@/lib/datetime";
import { scheduleTimeForDate } from "@/lib/schedule";
import { resolveConfig } from "@/lib/operation";
import { waLink } from "@/lib/invites";
import { previousHomework, homeworkLabel } from "@/lib/previous-homework";
import { CopyMessage } from "./copy-message";
import { SendToGroup } from "./send-to-group";

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
  const user = await requireClassAccess(classId);

  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      scheduledDate: true,
      createdAt: true,
      dayOff: true,
      messageNotes: true,
      responsibleAssistantId: true,
      responsibleAssistant: { select: { name: true, phone: true } },
      customTopic: true,
      topic: { select: { title: true } },
      homework: { select: { description: true, deadline: true, noHomework: true } },
      class: {
        select: {
          name: true,
          schedule: true,
          parentCommunityLink: true,
          school: { select: { name: true } },
        },
      },
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

  const startTime = scheduleTimeForDate(session.class.schedule as object, session.scheduledDate);
  const notStarted = !session.dayOff && new Date() < sessionStart(session.scheduledDate, startTime);

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

  // Previous homework = HW that came due since the last class. Who didn't submit comes
  // straight from the assistants' entries on the homework page (row with no submission
  // date). A HW nobody has reviewed yet is left out of the message; a partly-reviewed
  // one is included but flagged below so the assistant can finish it first.
  const [prevHw, activeCount] = await Promise.all([
    previousHomework(classId, session.scheduledDate),
    prisma.student.count({ where: { classId, active: true } }),
  ]);
  const prevSubs = prevHw.length
    ? await prisma.homeworkSubmission.findMany({
        where: { homeworkId: { in: prevHw.map((h) => h.id) }, student: { active: true } },
        select: { homeworkId: true, submissionDate: true, student: { select: { name: true } } },
      })
    : [];
  const prevHwStatus = prevHw.map((hw) => {
    const rows = prevSubs.filter((s) => s.homeworkId === hw.id);
    return {
      id: hw.id,
      label: homeworkLabel(hw),
      reviewed: rows.length,
      missingNames: rows.filter((s) => !s.submissionDate).map((s) => s.student.name).sort(),
    };
  });
  const previousHw = prevHwStatus
    .filter((p) => p.reviewed > 0)
    .map(({ label, missingNames }) => ({ label, missingNames }));
  const unreviewedHw = prevHwStatus.filter((p) => p.reviewed < activeCount);

  const cfg = await resolveConfig();
  const hw = session.homework;
  const message = buildClassUpdateMessage(
    {
      dateLabel: longDate.format(session.scheduledDate),
      className: session.class.name,
      schoolName: session.class.school.name,
      topic: session.customTopic ?? session.topic?.title,
      attendanceLogged: attendance.length > 0,
      absentNames,
      previousHomework: previousHw,
      newHomework: hw && !hw.noHomework ? hw.description : null,
      homeworkDueLabel: hw && !hw.noHomework && hw.deadline ? longDate.format(hw.deadline) : null,
      notes: session.messageNotes,
    },
    cfg.brandSignature,
  );

  const sentAt = session.parentUpdate?.sentAt ?? null;
  const puDeadline = sessionDeadline(session.scheduledDate, cfg);
  // A retroactively-added makeup session (created after its deadline) is never "late".
  const late = sentAt && latenessApplies(session.createdAt, puDeadline) ? isLate(sentAt, puDeadline) : false;

  // Messaging rule: if this is YOUR session, "Send" opens the recipient picker so you
  // post to the parents' community group. If you're COVERING (you're not the responsible
  // assistant), it opens a chat to the responsible assistant instead, so they post it
  // to their parents community. Falls back to the picker if their number is missing.
  const isCover =
    !!session.responsibleAssistantId && user.assistantId !== session.responsibleAssistantId;
  const coverLink = isCover ? waLink(session.responsibleAssistant?.phone, message) : null;
  const groupLink = session.class.parentCommunityLink; // owner posts here directly when set
  const groupHref = `https://wa.me/?text=${encodeURIComponent(message)}`;
  const responsibleName = session.responsibleAssistant?.name ?? "the responsible assistant";

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

      {unreviewedHw.map((p) => (
        <p key={p.id} className="rounded-lg bg-warn-soft px-3 py-2.5 text-sm text-warn">
          Previous homework ({p.label}) is checked for {p.reviewed} of {activeCount} students
          {p.reviewed === 0 ? " — it's left out of the message until it's checked." : " — only those are in the message."}{" "}
          <Link href={`/my/classes/${classId}/homework/${p.id}`} className="font-medium underline">
            Check homework →
          </Link>
        </p>
      ))}

      <pre className="card whitespace-pre-wrap bg-card-muted p-4 text-sm">
        {message}
      </pre>

      <div className="flex flex-wrap items-center gap-3">
        {coverLink ? (
          <a href={coverLink} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Send to {responsibleName}
          </a>
        ) : groupLink ? (
          <SendToGroup message={message} groupLink={groupLink} />
        ) : (
          <a href={groupHref} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Send on WhatsApp
          </a>
        )}
        <CopyMessage text={message} />
        <form action={markParentUpdateSent.bind(null, sessionId)}>
          <button type="submit" className="btn-secondary">
            {sentAt ? "Mark as sent again" : "Mark as sent →"}
          </button>
        </form>
      </div>
      <p className="text-xs text-faint">
        {coverLink
          ? `You’re covering this session — “Send” opens a chat to ${responsibleName}, who posts it to the parents community.`
          : groupLink
            ? "“Copy & open group” copies the message and opens the parents community group — just paste and send."
            : "“Send on WhatsApp” opens WhatsApp with the message ready — pick the parents community and send."}
      </p>

      {sentAt && (
        <div className={`rounded-lg px-3 py-2.5 text-sm ${late ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
          Sent at {formatCairo(sentAt)} — {late ? "Late (after the 9pm deadline)" : "On time"}
        </div>
      )}
    </div>
  );
}
