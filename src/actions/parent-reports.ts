"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { hwFeedbackFor, type HwFeedback } from "@/lib/reports/hw-feedback";

// Record that a student's monthly PDF report went to the parent (called by the
// "Report → parent" button once the share / chat hand-off happens). sentAt is set on the
// FIRST send only, so re-sending later never makes an on-time task look late.
export async function logParentReportSent(
  studentId: string,
  year: number,
  month: number,
): Promise<{ ok: true; sentAt: string } | { ok: false; error: string }> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12)
    return { ok: false, error: "Invalid month." };
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!student) return { ok: false, error: "Student not found." };
  const user = await requireClassAccess(student.classId);

  const log = await prisma.parentReportLog.upsert({
    where: { studentId_year_month: { studentId, year, month } },
    update: {},
    create: { studentId, year, month, sentById: user.assistantId ?? null },
    select: { sentAt: true },
  });

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "sent_parent_report",
    entityType: "student",
    entityId: studentId,
    classId: student.classId,
    metadata: { year, month },
  });
  revalidatePath(`/classes/${student.classId}/parent-reports`);
  revalidatePath(`/my/classes/${student.classId}/parent-reports`);
  revalidatePath("/my/tasks");
  return { ok: true, sentAt: log.sentAt.toISOString() };
}

const validPeriod = (year: number, month: number) =>
  Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12;

// The homework-feedback text for a student's monthly report: the saved edit, or
// the draft built from that month's HW weak points.
export async function getHwFeedback(
  studentId: string,
  year: number,
  month: number,
): Promise<{ ok: true; feedback: HwFeedback } | { ok: false; error: string }> {
  if (!validPeriod(year, month)) return { ok: false, error: "Invalid month." };
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!student) return { ok: false, error: "Student not found." };
  await requireClassAccess(student.classId);
  return { ok: true, feedback: await hwFeedbackFor(studentId, month, year) };
}

// Save the edited feedback (blank = leave the section off the report), or pass
// null to discard the edit and go back to the auto draft.
export async function saveHwFeedback(
  studentId: string,
  year: number,
  month: number,
  text: string | null,
): Promise<{ ok: true; feedback: HwFeedback } | { ok: false; error: string }> {
  if (!validPeriod(year, month)) return { ok: false, error: "Invalid month." };
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { classId: true } });
  if (!student) return { ok: false, error: "Student not found." };
  const user = await requireClassAccess(student.classId);

  const key = { studentId_year_month: { studentId, year, month } };
  if (text == null) {
    await prisma.parentReportNote.deleteMany({ where: { studentId, year, month } });
  } else {
    const hwFeedback = text.trim().slice(0, 4000);
    await prisma.parentReportNote.upsert({
      where: key,
      update: { hwFeedback, updatedById: user.id },
      create: { studentId, year, month, hwFeedback, updatedById: user.id },
    });
  }

  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: text == null ? "reset_report_hw_feedback" : "edited_report_hw_feedback",
    entityType: "student",
    entityId: studentId,
    classId: student.classId,
    metadata: { year, month },
  });
  return { ok: true, feedback: await hwFeedbackFor(studentId, month, year) };
}
