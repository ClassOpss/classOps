"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { ymdUtc } from "@/lib/datetime";
import { isQuizDate } from "@/lib/quiz";
import { ensureQuizAssessment as linkQuizAssessment } from "@/lib/quiz-assessment";

// Resolve a class + validate that `scheduledDateStr` is a genuine cadence date for it.
// Returns { user, classId, scheduledDate } or null when access/validation fails.
async function resolveCycle(classId: string, scheduledDateStr: string) {
  const user = await requireClassAccess(classId);
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { quizStartDate: true },
  });
  if (!klass?.quizStartDate) return null;
  const scheduledDate = ymdUtc(scheduledDateStr);
  if (Number.isNaN(scheduledDate.getTime()) || !isQuizDate(klass.quizStartDate, scheduledDate)) return null;
  return { user, scheduledDate, quizStartDate: klass.quizStartDate };
}

// Create/link the quiz's assessment, then refresh the assessment lists.
async function ensureQuizAssessment(classId: string, scheduledDate: Date, quizStartDate: Date) {
  if (await linkQuizAssessment(classId, scheduledDate, quizStartDate)) {
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

  if (quizCreated) await ensureQuizAssessment(classId, scheduledDate, cyc.quizStartDate);

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
  await ensureQuizAssessment(classId, scheduledDate, cyc.quizStartDate);

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

// Admin/teacher: move a single quiz to a different actual date. Only that cycle's
// deadlines shift; later quizzes stay on the biweekly cadence.
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

  await ensureRow(classId, scheduledDate);
  await prisma.quizPrep.update({
    where: { classId_scheduledDate: { classId, scheduledDate } },
    data: { quizDate },
  });
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
