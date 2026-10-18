"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { ymdUtc } from "@/lib/datetime";
import { isQuizDate, addDays, scheduledQuizDatesBetween, weekdayName } from "@/lib/quiz";
import { ensureQuizAssessment as linkQuizAssessment } from "@/lib/quiz-assessment";
import { clearStaleQuizIncidents } from "@/lib/quiz-incidents";

// Resolve a class + validate that `scheduledDateStr` is a genuine cycle for it: a cadence
// date, or the key of an ad-hoc cycle (a hand-added assessment's tasks).
// Returns { user, scheduledDate, quizStartDate, cadence } or null when access/validation fails.
async function resolveCycle(classId: string, scheduledDateStr: string) {
  const user = await requireClassAccess(classId);
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { quizStartDate: true, quizCadenceDays: true },
  });
  if (!klass) return null;
  const scheduledDate = ymdUtc(scheduledDateStr);
  if (Number.isNaN(scheduledDate.getTime())) return null;
  const onCadence = !!klass.quizStartDate && isQuizDate(klass.quizStartDate, scheduledDate, klass.quizCadenceDays);
  if (!onCadence) {
    const adHoc = await prisma.quizPrep.findFirst({
      where: { classId, scheduledDate, adHoc: true },
      select: { id: true },
    });
    if (!adHoc) return null;
  }
  return { user, scheduledDate, onCadence, quizStartDate: klass.quizStartDate, cadence: klass.quizCadenceDays };
}

// Create/link the quiz's assessment, then refresh the assessment lists.
async function ensureQuizAssessment(classId: string, scheduledDate: Date) {
  if (await linkQuizAssessment(classId, scheduledDate)) {
    revalidatePath(`/classes/${classId}/assessments`);
    revalidatePath(`/my/classes/${classId}/assessments`);
  }
}

// Ensure a row exists for the cycle (actual date defaults to the scheduled date on create).
async function ensureRow(classId: string, scheduledDate: Date) {
  return prisma.quizPrep.upsert({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    update: {},
    create: { classId, scheduledDate, quizDate: scheduledDate },
    select: { id: true },
  });
}

// Assistant/admin: save the two prep steps (create quiz / send to print). Shared task;
// completedAt is stamped once (first time both are ticked) and never moved — edit-stable.
export async function saveQuizPrep(
  classId: string,
  scheduledDateStr: string,
  formData: FormData,
): Promise<void> {
  const cyc = await resolveCycle(classId, scheduledDateStr);
  if (!cyc || !cyc.user.assistantId) return;
  const { scheduledDate } = cyc;

  const quizCreated = formData.get("quizCreated") === "on";
  const sentToPrint = formData.get("sentToPrint") === "on";

  const existing = await prisma.quizPrep.findUnique({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    select: { quizCreatedAt: true, sentToPrintAt: true, completedAt: true },
  });

  const now = new Date();
  const quizCreatedAt = quizCreated ? existing?.quizCreatedAt ?? now : existing?.quizCreatedAt ?? null;
  const sentToPrintAt = sentToPrint ? existing?.sentToPrintAt ?? now : existing?.sentToPrintAt ?? null;
  const completedAt =
    quizCreated && sentToPrint ? existing?.completedAt ?? now : existing?.completedAt ?? null;

  await prisma.quizPrep.upsert({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    update: { quizCreated, sentToPrint, quizCreatedAt, sentToPrintAt, completedAt, loggedById: cyc.user.assistantId },
    create: {
      classId,
      scheduledDate,
      quizDate: scheduledDate,
      quizCreated,
      sentToPrint,
      quizCreatedAt,
      sentToPrintAt,
      completedAt,
      loggedById: cyc.user.assistantId,
    },
  });

  if (quizCreated) await ensureQuizAssessment(classId, scheduledDate);

  await logActivity({
    actorId: cyc.user.id,
    actorRole: cyc.user.role,
    action: "saved_quiz_prep",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { scheduledDate: scheduledDateStr, quizCreated, sentToPrint },
  });

  revalidatePath(`/my/classes/${classId}/quiz-prep`);
  revalidatePath(`/my/classes/${classId}`);
  revalidatePath("/my/tasks");
}

// Assistant/admin: mark the announcement message as sent. announcedAt is stamped once.
export async function markQuizAnnounced(classId: string, scheduledDateStr: string): Promise<void> {
  const cyc = await resolveCycle(classId, scheduledDateStr);
  if (!cyc || !cyc.user.assistantId) return;
  const { scheduledDate } = cyc;

  const existing = await prisma.quizPrep.findUnique({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    select: { announcedAt: true },
  });
  const announcedAt = existing?.announcedAt ?? new Date();

  await prisma.quizPrep.upsert({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    update: { announcedAt, loggedById: cyc.user.assistantId },
    create: { classId, scheduledDate, quizDate: scheduledDate, announcedAt, loggedById: cyc.user.assistantId },
  });
  await ensureQuizAssessment(classId, scheduledDate);

  await logActivity({
    actorId: cyc.user.id,
    actorRole: cyc.user.role,
    action: "marked_quiz_announced",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { scheduledDate: scheduledDateStr },
  });

  revalidatePath(`/my/classes/${classId}/quiz-prep`);
  revalidatePath("/my/tasks");
}

// Admin/teacher: move a quiz to a different actual date. By default only that cycle's
// deadlines shift and later quizzes stay on the cadence; with "shiftLater" (cadence quizzes
// only) the new date becomes the schedule: every later cadence quiz follows it.
export async function setQuizDate(
  classId: string,
  scheduledDateStr: string,
  formData: FormData,
): Promise<void> {
  const cyc = await resolveCycle(classId, scheduledDateStr);
  if (!cyc) return;
  if (cyc.user.role !== "admin" && cyc.user.role !== "teacher") return;
  const { scheduledDate } = cyc;

  const raw = String(formData.get("quizDate") ?? "").trim();
  const quizDate = raw ? ymdUtc(raw) : scheduledDate; // blank resets to the scheduled date
  if (Number.isNaN(quizDate.getTime())) return;

  if (formData.get("shiftLater") === "on" && cyc.onCadence && cyc.quizStartDate) {
    await shiftCadenceFrom(classId, scheduledDate, quizDate, cyc.quizStartDate, cyc.cadence);
    await logActivity({
      actorId: cyc.user.id,
      actorRole: cyc.user.role,
      action: "shifted_quiz_schedule",
      entityType: "class",
      entityId: classId,
      classId,
      metadata: { scheduledDate: scheduledDateStr, quizDate: quizDate.toISOString().slice(0, 10) },
    });
    revalidateQuizPages(classId);
    return;
  }

  const { id: rowId } = await ensureRow(classId, scheduledDate);
  await prisma.quizPrep.update({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    data: { quizDate },
  });
  await clearStaleQuizIncidents([rowId]); // fines for the old date no longer stand
  // Keep the linked assessment on the same date.
  await prisma.assessment.updateMany({
    where: { quizPrep: { is: { classId, scheduledDate } } },
    data: { date: quizDate },
  });

  await logActivity({
    actorId: cyc.user.id,
    actorRole: cyc.user.role,
    action: "set_quiz_date",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { scheduledDate: scheduledDateStr, quizDate: quizDate.toISOString().slice(0, 10) },
  });

  revalidatePath(`/classes/${classId}/quizzes`);
  revalidatePath(`/my/classes/${classId}/quiz-prep`);
  revalidatePath("/my/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/pay", "layout");
}

function revalidateQuizPages(classId: string) {
  revalidatePath(`/classes/${classId}/quizzes`);
  revalidatePath(`/classes/${classId}/assessments`);
  revalidatePath(`/classes/${classId}`);
  revalidatePath(`/my/classes/${classId}/quiz-prep`);
  revalidatePath(`/my/classes/${classId}/assessments`);
  revalidatePath("/my/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/pay", "layout");
}

// Re-anchor the cadence so the quiz at `scheduledDate` lands on `newDate` and every later
// cadence quiz follows newDate + cadence·n. Cycles are keyed by their scheduled date, so:
//   • earlier cadence cycles become fixed (ad-hoc) rows — they're history and keep their dates
//     and tasks (rows are materialised for untouched ones so overdue tasks don't vanish);
//   • this + later cadence rows are re-keyed by the shift, carrying their own one-off moves,
//     cancellations and linked assessments along;
//   • the class's first-quiz date (and quiz day) move to the new anchor.
// Hand-added (ad-hoc) assessments keep their own dates.
async function shiftCadenceFrom(
  classId: string,
  scheduledDate: Date,
  newDate: Date,
  quizStartDate: Date,
  cadence: number,
) {
  // The new date becomes the schedule from here on: this quiz lands exactly on it and every
  // later cadence quiz follows newDate + cadence·n (keeping its own one-off moves).
  const delta = Math.round((newDate.getTime() - scheduledDate.getTime()) / 86_400_000);
  const newAnchor = newDate;
  // Keep the order: the pushed quiz can't jump back over the previous cadence quiz.
  if (newAnchor.getTime() <= addDays(scheduledDate, -cadence).getTime()) return;

  const past = scheduledQuizDatesBetween(quizStartDate, quizStartDate, addDays(scheduledDate, -1), cadence);
  const later = await prisma.quizPrep.findMany({
    where: { classId, adHoc: false, scheduledDate: { gte: scheduledDate } },
    select: { id: true, scheduledDate: true, quizDate: true, assessmentId: true },
  });
  // A re-keyed row can't land on an existing hand-added cycle's key.
  const clash = await prisma.quizPrep.findFirst({
    where: { classId, adHoc: true, scheduledDate: { in: later.map((r) => addDays(r.scheduledDate, delta)) } },
    select: { id: true },
  });
  if (clash) return;

  const PARK = 365 * 200; // move keys out of the way first so re-keying never hits the unique index
  await prisma.$transaction(async (tx) => {
    if (past.length > 0) {
      await tx.quizPrep.createMany({
        data: past.map((d) => ({ classId, scheduledDate: d, quizDate: d })),
        skipDuplicates: true,
      });
    }
    await tx.quizPrep.updateMany({
      where: { classId, adHoc: false, scheduledDate: { lt: scheduledDate } },
      data: { adHoc: true },
    });
    for (const r of later) {
      await tx.quizPrep.update({ where: { id: r.id }, data: { scheduledDate: addDays(r.scheduledDate, PARK) } });
    }
    for (const r of later) {
      const quizDate = r.scheduledDate.getTime() === scheduledDate.getTime() ? newDate : addDays(r.quizDate, delta);
      await tx.quizPrep.update({
        where: { id: r.id },
        data: { scheduledDate: addDays(r.scheduledDate, delta), quizDate },
      });
      if (r.assessmentId) await tx.assessment.update({ where: { id: r.assessmentId }, data: { date: quizDate } });
    }
    const klass = await tx.class.findUnique({ where: { id: classId }, select: { quizDay: true } });
    await tx.class.update({
      where: { id: classId },
      data: { quizStartDate: newAnchor, ...(klass?.quizDay ? { quizDay: weekdayName(newAnchor) } : {}) },
    });
  });
  await clearStaleQuizIncidents(later.map((r) => r.id));
}

// Admin/teacher: call off one quiz (holiday, exam week…) — no tasks, no fines. It keeps its
// slot as a cancelled row (restorable); its auto-made assessment is removed. Refused once
// grades exist. A hand-added assessment's cycle goes away by deleting the assessment instead.
export async function cancelQuiz(classId: string, scheduledDateStr: string): Promise<void> {
  const cyc = await resolveCycle(classId, scheduledDateStr);
  if (!cyc) return;
  if (cyc.user.role !== "admin" && cyc.user.role !== "teacher") return;
  const { scheduledDate } = cyc;

  const { id } = await ensureRow(classId, scheduledDate);
  const row = await prisma.quizPrep.findUnique({
    where: { id },
    select: { adHoc: true, assessmentId: true, assessment: { select: { _count: { select: { grades: true } } } } },
  });
  if (!row || (row.adHoc && row.assessmentId)) return;
  if (row.assessment && row.assessment._count.grades > 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.quizPrep.update({ where: { id }, data: { cancelled: true, assessmentId: null } });
    if (row.assessmentId) await tx.assessment.delete({ where: { id: row.assessmentId } });
  });
  await clearStaleQuizIncidents([id]);

  await logActivity({
    actorId: cyc.user.id,
    actorRole: cyc.user.role,
    action: "cancelled_quiz",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { scheduledDate: scheduledDateStr },
  });
  revalidateQuizPages(classId);
}

// Admin/teacher: undo a cancellation.
export async function restoreQuiz(classId: string, scheduledDateStr: string): Promise<void> {
  const cyc = await resolveCycle(classId, scheduledDateStr);
  if (!cyc) return;
  if (cyc.user.role !== "admin" && cyc.user.role !== "teacher") return;

  await prisma.quizPrep.updateMany({
    where: { classId, scheduledDate: cyc.scheduledDate },
    data: { cancelled: false },
  });
  await logActivity({
    actorId: cyc.user.id,
    actorRole: cyc.user.role,
    action: "restored_quiz",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { scheduledDate: scheduledDateStr },
  });
  revalidateQuizPages(classId);
}

// Set what the quiz covers (feeds the announcement message). Any assigned assistant can
// fill this in — they send the announcement — as well as admin/teacher.
export async function setQuizCoverage(
  classId: string,
  scheduledDateStr: string,
  formData: FormData,
): Promise<void> {
  const cyc = await resolveCycle(classId, scheduledDateStr);
  if (!cyc) return;
  const { scheduledDate } = cyc;

  const coverage = String(formData.get("coverage") ?? "").trim() || null;

  await ensureRow(classId, scheduledDate);
  await prisma.quizPrep.update({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    data: { coverage },
  });
  await prisma.assessment.updateMany({
    where: { quizPrep: { is: { classId, scheduledDate } } },
    data: { topicNotes: coverage },
  });

  await logActivity({
    actorId: cyc.user.id,
    actorRole: cyc.user.role,
    action: "set_quiz_coverage",
    entityType: "class",
    entityId: classId,
    classId,
  });

  revalidatePath(`/classes/${classId}/quizzes`);
  revalidatePath(`/my/classes/${classId}/quiz-prep`);
}
