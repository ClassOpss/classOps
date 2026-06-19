import Link from "next/link";
import { requireClassAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { submitAttendance } from "@/actions/attendance";
import { markClassroomUploaded } from "@/actions/classroom-upload";
import { sessionStart, sessionDeadline, isLate, formatCairo } from "@/lib/datetime";
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
  const deadline = sessionDeadline(session.scheduledDate);
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
          <Link href={`/my/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← Back</Link>
          <h1 className="mt-1 text-lg font-semibold">Attendance</h1>
          <p className="text-sm text-black/50 dark:text-white/50">
            {dateFmt.format(session.scheduledDate)} · {session.topic?.title ?? "—"}
          </p>
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
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
        <Link href={`/my/classes/${classId}`} className="text-sm text-blue-600 hover:underline">← Back</Link>
        <h1 className="mt-1 text-lg font-semibold">Attendance</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {dateFmt.format(session.scheduledDate)} · {session.topic?.title ?? "—"}
        </p>
        <p className="text-xs text-black/40 dark:text-white/40">
          Deadline: {formatCairo(deadline, "d MMM, h:mm a")}
        </p>
      </div>

      {loggedAt && (
        <div
          className={`rounded-md p-3 text-sm ${
            late
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30"
              : "bg-green-50 text-green-700 dark:bg-green-950/30"
          }`}
        >
          Logged at {formatCairo(loggedAt)} — {late ? "Late (after the 9pm deadline)" : "On time"}
        </div>
      )}

      {loggedAt && (
        <Link
          href={`/my/classes/${classId}/parent-update/${sessionId}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Send parent update →
        </Link>
      )}

      <form action={submitAttendance.bind(null, sessionId)} className="flex flex-col gap-2">
        <p className="text-xs text-black/50 dark:text-white/50">
          Checked = present. Uncheck absent students, then submit.
        </p>
        {students.length === 0 ? (
          <p className="text-sm text-black/60 dark:text-white/60">No students in this class yet.</p>
        ) : (
          <ul className="flex flex-col">
            {students.map((s) => (
              <li key={s.id} className="border-b border-black/5 dark:border-white/5">
                <label className="flex items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    name="present"
                    value={s.id}
                    defaultChecked={statusByStudent.get(s.id) !== "absent"}
                    className="h-5 w-5"
                  />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-black/40">{s.code}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {students.length > 0 && (
          <button
            type="submit"
            className="mt-2 rounded-md bg-foreground px-4 py-3 text-sm font-medium text-background hover:opacity-90"
          >
            {loggedAt ? "Update attendance" : "Submit attendance"}
          </button>
        )}
      </form>

      <section className="border-t border-black/10 pt-4 dark:border-white/10">
        <h2 className="mb-1 font-medium">Lesson details</h2>
        <p className="mb-3 text-xs text-black/50 dark:text-white/50">
          Topic, homework, and any quiz/announcement — these fill the parent update and are
          left out of the message when blank.
        </p>
        <LessonDetailsForm sessionId={sessionId} topics={topics} current={lessonDetails} />
      </section>

      <section className="border-t border-black/10 pt-4 dark:border-white/10">
        <h2 className="mb-1 font-medium">Google Classroom</h2>
        {uploadedAt && (
          <div
            className={`mb-2 rounded-md p-3 text-sm ${
              uploadLate
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30"
                : "bg-green-50 text-green-700 dark:bg-green-950/30"
            }`}
          >
            Marked uploaded at {formatCairo(uploadedAt)} — {uploadLate ? "Late (after the 9pm deadline)" : "On time"}
            {session.classroomUpload?.notes ? ` · ${session.classroomUpload.notes}` : ""}
          </div>
        )}
        <form
          action={markClassroomUploaded.bind(null, sessionId)}
          className="flex flex-wrap items-end gap-2"
        >
          <input
            name="notes"
            placeholder="what you uploaded (optional)"
            className="flex-1 rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md border border-black/15 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            {uploadedAt ? "Update" : "Mark uploaded ✓"}
          </button>
        </form>
      </section>
    </div>
  );
}
