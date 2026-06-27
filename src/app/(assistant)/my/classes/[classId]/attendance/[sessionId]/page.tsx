import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { submitAttendance } from "@/actions/attendance";
import { markClassroomUploaded } from "@/actions/classroom-upload";
import { sessionStart, sessionDeadline, isLate, formatCairo } from "@/lib/datetime";
import { resolveConfig } from "@/lib/operation";
import { LessonDetailsForm } from "./lesson-details-form";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AttendancePage({
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
      topicId: true,
      messageNotes: true,
      topic: { select: { title: true } },
      homework: { select: { description: true, deadline: true, noHomework: true } },
      classroomUpload: { select: { uploadedAt: true, notes: true } },
      class: { select: { schedule: true, yearGroup: true } },
    },
  });
  if (!session || session.classId !== classId) {
    return (
      <div>
        <h1 className="text-lg font-semibold">Session not found</h1>
        <Link href={`/my/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← Back</Link>
      </div>
    );
  }

  const [students, existing, topics] = await Promise.all([
    prisma.student.findMany({
      where: { classId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.attendance.findMany({
      where: { sessionId },
      select: { studentId: true, status: true, loggedAt: true },
    }),
    prisma.topic.findMany({
      where: { yearGroup: session.class.yearGroup },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const lessonDetails = {
    topicId: session.topicId ?? "",
    homework: session.homework?.description ?? "",
    deadline: session.homework?.deadline ? session.homework.deadline.toISOString().slice(0, 10) : "",
    noHomework: session.homework?.noHomework ?? false,
    notes: session.messageNotes ?? "",
  };

  const statusByStudent = new Map(existing.map((a) => [a.studentId, a.status]));
  const loggedAt = existing[0]?.loggedAt ?? null;
  const deadline = sessionDeadline(session.scheduledDate, await resolveConfig());
  const late = loggedAt ? isLate(loggedAt, deadline) : false;
  const uploadedAt = session.classroomUpload?.uploadedAt ?? null;
  const uploadLate = uploadedAt ? isLate(uploadedAt, deadline) : false;
  const sched = (session.class.schedule ?? {}) as { time?: string };
  const start = sessionStart(session.scheduledDate, sched.time);
  const notStarted = !session.dayOff && new Date() < start;

  // Can't log a day off, or a class that hasn't started yet.
  if (session.dayOff || notStarted) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Link href={`/my/classes/${classId}`} className="link text-sm">← Back</Link>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted">
            {dateFmt.format(session.scheduledDate)} · {session.topic?.title ?? "—"}
          </p>
        </div>
        <p className="card px-4 py-5 text-sm text-muted">
          {session.dayOff
            ? "This is a day off — there's no attendance to log."
            : `This class hasn't started yet. You can log attendance from ${formatCairo(start)}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/my/classes/${classId}`} className="link text-sm">← Back</Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted">
          {dateFmt.format(session.scheduledDate)} · {session.topic?.title ?? "—"}
        </p>
        <p className="text-xs text-faint">
          Deadline: {formatCairo(deadline, "d MMM, h:mm a")}
        </p>
      </div>

      {loggedAt && (
        <div className={`rounded-lg px-3 py-2.5 text-sm ${late ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
          Logged at {formatCairo(loggedAt)} — {late ? "Late (after the 9pm deadline)" : "On time"}
        </div>
      )}

      {loggedAt && (
        <Link href={`/my/classes/${classId}/parent-update/${sessionId}`} className="btn-secondary w-full">
          Send parent update →
        </Link>
      )}

      <form action={submitAttendance.bind(null, sessionId)} className="card overflow-hidden">
        <p className="border-b border-border px-4 py-3 text-xs text-muted">
          Checked = present. Uncheck absent students, then submit.
        </p>
        {students.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">No students in this class yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {students.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    name="present"
                    value={s.id}
                    defaultChecked={statusByStudent.get(s.id) !== "absent"}
                    className="h-5 w-5 accent-brand"
                  />
                  <span className="flex-1 font-medium">{s.name}</span>
                  <span className="text-xs text-faint">{s.code}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {students.length > 0 && (
          <div className="border-t border-border p-3">
            <button type="submit" className="btn-primary w-full">
              {loggedAt ? "Update attendance" : "Submit attendance"}
            </button>
          </div>
        )}
      </form>

      <section className="card p-4">
        <h2 className="section-title">Lesson details</h2>
        <p className="mb-3 mt-0.5 text-xs text-muted">
          Topic, homework, and any quiz/announcement — these fill the parent update and are
          left out of the message when blank.
        </p>
        <LessonDetailsForm sessionId={sessionId} topics={topics} current={lessonDetails} />
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-2">Google Classroom</h2>
        {uploadedAt && (
          <div className={`mb-2 rounded-lg px-3 py-2.5 text-sm ${uploadLate ? "bg-warn-soft text-warn" : "bg-success-soft text-success"}`}>
            Marked uploaded at {formatCairo(uploadedAt)} — {uploadLate ? "Late (after the 9pm deadline)" : "On time"}
            {session.classroomUpload?.notes ? ` · ${session.classroomUpload.notes}` : ""}
          </div>
        )}
        <form action={markClassroomUploaded.bind(null, sessionId)} className="flex flex-wrap items-end gap-2">
          <input name="notes" placeholder="what you uploaded (optional)" className="input flex-1" />
          <button type="submit" className="btn-secondary">
            {uploadedAt ? "Update" : "Mark uploaded ✓"}
          </button>
        </form>
      </section>
    </div>
  );
}
