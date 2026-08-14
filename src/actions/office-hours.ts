"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess, getVisibleStudentIds, requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { currentOperationId } from "@/lib/operation";

export type FormState = { ok?: boolean; error?: string } | undefined;

// Assistant logs a 1-on-1 office-hour session for a student in their sub-group (spec 5.11).
// Logged as PENDING — the bonus only counts once an admin approves it.
export async function logOfficeHour(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireClassAccess(classId);
  if (!user.assistantId) return { error: "Only assistants can log office hours." };

  const studentId = String(formData.get("studentId") ?? "");
  const dateStr = String(formData.get("date") ?? "").trim();
  const topicId = String(formData.get("topicId") ?? "").trim() || null;
  const topicNotes = String(formData.get("topicNotes") ?? "").trim() || null;
  const durationRaw = String(formData.get("durationMin") ?? "").trim();
  const durationMin = durationRaw ? Number(durationRaw) : null;

  if (!studentId) return { error: "Pick a student." };
  if (!dateStr) return { error: "Pick a date." };
  if (durationMin !== null && (Number.isNaN(durationMin) || durationMin < 0)) {
    return { error: "Duration must be a positive number." };
  }

  // Student must be in this assistant's sub-group.
  const visible = await getVisibleStudentIds(classId, user);
  if (!visible.includes(studentId)) return { error: "That student isn't in your group." };

  await prisma.officeHourSession.create({
    data: {
      classId,
      assistantId: user.assistantId,
      studentId,
      date: new Date(dateStr),
      topicId,
      topicNotes,
      durationMin,
    },
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "logged_office_hour",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { studentId },
  });
  revalidatePath(`/my/classes/${classId}/office-hours`);
  return { ok: true };
}

// Admin approves a pending office hour so its bonus counts toward pay.
export async function approveOfficeHour(officeHourId: string): Promise<void> {
  const admin = await requireRole("admin");
  const operationId = await currentOperationId();
  const oh = await prisma.officeHourSession.findUnique({
    where: { id: officeHourId },
    select: { assistant: { select: { operationId: true } }, classId: true },
  });
  if (!oh || oh.assistant.operationId !== operationId) return;
  await prisma.officeHourSession.update({ where: { id: officeHourId }, data: { approved: true } });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "approved_office_hour",
    entityType: "office_hour",
    entityId: officeHourId,
    classId: oh.classId,
  });
  revalidatePath("/dashboard");
}

// Admin rejects (deletes) a pending office hour.
export async function rejectOfficeHour(officeHourId: string): Promise<void> {
  const operationId = await currentOperationId();
  await requireRole("admin");
  const oh = await prisma.officeHourSession.findUnique({
    where: { id: officeHourId },
    select: { assistant: { select: { operationId: true } } },
  });
  if (!oh || oh.assistant.operationId !== operationId) return;
  await prisma.officeHourSession.delete({ where: { id: officeHourId } });
  revalidatePath("/dashboard");
}

export async function deleteOfficeHour(officeHourId: string): Promise<void> {
  const oh = await prisma.officeHourSession.findUnique({
    where: { id: officeHourId },
    select: { classId: true, assistantId: true },
  });
  if (!oh) return;
  const user = await requireClassAccess(oh.classId);
  // Only the assistant who logged it (or an admin) may remove it.
  if (user.role === "assistant" && user.assistantId !== oh.assistantId) return;

  await prisma.officeHourSession.delete({ where: { id: officeHourId } });
  revalidatePath(`/my/classes/${oh.classId}/office-hours`);
}
