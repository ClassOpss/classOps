"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { divideAlphabetically, assignToSmallerGroup } from "@/lib/divide";
import { reassignResponsibilities } from "@/actions/sessions";
import { assertClassInOperation } from "@/lib/operation";
import { ymdUtc, cairoToday } from "@/lib/datetime";

export type FormState = { ok?: boolean; error?: string } | undefined;

// Active assistants on a class, ordered so index 0 is the "first" assistant
// (earliest start) — that's the one who gets the extra student on odd splits.
async function activeAssistantIds(classId: string): Promise<string[]> {
  const rows = await prisma.classAssignment.findMany({
    // Substitutes (temporary covers) are never part of the permanent 2-assistant
    // roster, so they don't count toward the max, the day-ownership split, or division.
    where: { classId, endDate: null, isSubstitute: false },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    select: { assistantId: true },
  });
  return rows.map((r) => r.assistantId);
}

// Assign an assistant to a class (max 2 active per class).
export async function assignAssistant(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("admin");
  const assistantId = String(formData.get("assistantId") ?? "");
  if (!assistantId) return { error: "Pick an assistant." };

  // Class + assistant must be in the same (active) operation — no cross-tenant mixing.
  const operationId = await assertClassInOperation(classId);
  const assistant = await prisma.assistant.findUnique({
    where: { id: assistantId },
    select: { operationId: true },
  });
  if (!assistant || assistant.operationId !== operationId) return { error: "Pick an assistant." };

  const active = await activeAssistantIds(classId);
  if (active.includes(assistantId)) return { error: "That assistant is already assigned." };
  if (active.length >= 2) return { error: "A class can have at most 2 active assistants." };

  await prisma.classAssignment.create({
    data: { classId, assistantId, startDate: new Date() },
  });
  await reassignResponsibilities(classId); // re-split day ownership across the new roster
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "assigned_assistant",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { assistantId },
  });
  revalidatePath(`/classes/${classId}/assistants`);
  return { ok: true };
}

// End an assistant's assignment (and close their active student sub-assignments).
export async function endAssignment(assignmentId: string): Promise<void> {
  const admin = await requireRole("admin");
  const now = new Date();
  const assignment = await prisma.classAssignment.update({
    where: { id: assignmentId },
    data: { endDate: now },
    select: { classId: true, assistantId: true },
  });
  await prisma.studentAssistantAssignment.updateMany({
    where: { classId: assignment.classId, assistantId: assignment.assistantId, endDate: null },
    data: { endDate: now },
  });
  await reassignResponsibilities(assignment.classId); // remaining assistant takes over the days
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "ended_assignment",
    entityType: "class",
    entityId: assignment.classId,
    classId: assignment.classId,
    metadata: { assistantId: assignment.assistantId },
  });
  revalidatePath(`/classes/${assignment.classId}/assistants`);
  revalidatePath("/my", "layout"); // the un-assigned assistant's class list must refresh
}

// Arrange a temporary cover: give `assistantId` scoped, auto-expiring access to this
// class for the Cairo day(s) [fromDate, toDate]. Marked isSubstitute, so it never
// affects the permanent 2-assistant roster, day ownership, or student division — the
// coverer just gets the class in their /my list and full student/task access for the
// window. requireClassAccess enforces the window; the existing coverage detection +
// admin confirm still drives the ±coverage pay move.
export async function arrangeCover(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("admin");
  const assistantId = String(formData.get("assistantId") ?? "");
  const fromDate = String(formData.get("fromDate") ?? "");
  const toDate = String(formData.get("toDate") ?? "") || fromDate;
  if (!assistantId) return { error: "Pick an assistant." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return { error: "Pick a cover date." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate < fromDate)
    return { error: "The end date can't be before the start date." };

  const operationId = await assertClassInOperation(classId);
  const assistant = await prisma.assistant.findUnique({
    where: { id: assistantId },
    select: { operationId: true },
  });
  if (!assistant || assistant.operationId !== operationId) return { error: "Pick an assistant." };

  // A covering assistant shouldn't already be on this class's permanent roster.
  const active = await activeAssistantIds(classId);
  if (active.includes(assistantId)) return { error: "That assistant is already assigned to this class." };

  // startDate/endDate are @db.Date (date-only) — store plain calendar dates. Access
  // is judged against cairoToday() (see requireClassAccess), so [from, to] is inclusive.
  await prisma.classAssignment.create({
    data: { classId, assistantId, startDate: ymdUtc(fromDate), endDate: ymdUtc(toDate), isSubstitute: true },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "arranged_cover",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { assistantId, fromDate, toDate },
  });
  revalidatePath(`/classes/${classId}/assistants`);
  revalidatePath("/my", "layout");
  return { ok: true };
}

// End a cover early (expire its access window now).
export async function endCover(assignmentId: string): Promise<void> {
  const admin = await requireRole("admin");
  // Expire immediately: set the end date to yesterday so today's date-based access
  // check (endDate >= cairoToday) fails right away.
  const yesterday = new Date(cairoToday().getTime() - 86_400_000);
  const a = await prisma.classAssignment.update({
    where: { id: assignmentId },
    data: { endDate: yesterday },
    select: { classId: true, assistantId: true },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "ended_cover",
    entityType: "class",
    entityId: a.classId,
    classId: a.classId,
    metadata: { assistantId: a.assistantId },
  });
  revalidatePath(`/classes/${a.classId}/assistants`);
  revalidatePath("/my", "layout");
}

// Auto-divide active students between the class's active assistants.
export async function autoDivideStudents(classId: string): Promise<void> {
  const admin = await requireRole("admin");
  const now = new Date();
  const active = await activeAssistantIds(classId);

  // Always clear the current division first (history preserved via endDate).
  await prisma.studentAssistantAssignment.updateMany({
    where: { classId, endDate: null },
    data: { endDate: now },
  });

  if (active.length < 2) {
    // 0 or 1 assistant: no sub-groups needed (a lone assistant sees everyone).
    revalidatePath(`/classes/${classId}/assistants`);
    return;
  }

  const students = await prisma.student.findMany({
    where: { classId, active: true },
    select: { id: true, name: true },
  });
  const map = divideAlphabetically(students, active[0], active[1]);

  if (students.length > 0) {
    await prisma.studentAssistantAssignment.createMany({
      data: students.map((s) => ({
        classId,
        studentId: s.id,
        assistantId: map[s.id],
        startDate: now,
      })),
    });
  }

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "auto_divided_students",
    entityType: "class",
    entityId: classId,
    classId,
    metadata: { students: students.length },
  });
  revalidatePath(`/classes/${classId}/assistants`);
}

// Called after students are added: if the class is already divided between 2
// assistants, place each new student into the currently-smaller sub-group.
export async function autoAssignNewStudents(
  classId: string,
  newStudentIds: string[],
): Promise<void> {
  if (newStudentIds.length === 0) return;
  const active = await activeAssistantIds(classId);
  if (active.length !== 2) return;

  const subs = await prisma.studentAssistantAssignment.findMany({
    where: { classId, endDate: null },
    select: { assistantId: true, studentId: true },
  });
  if (subs.length === 0) return; // not divided yet — admin will run auto-divide

  const already = new Set(subs.map((s) => s.studentId));
  const toAssign = newStudentIds.filter((id) => !already.has(id));
  if (toAssign.length === 0) return;

  const counts = active.map((id) => ({
    assistantId: id,
    count: subs.filter((s) => s.assistantId === id).length,
  }));
  const map = assignToSmallerGroup(toAssign, counts);

  await prisma.studentAssistantAssignment.createMany({
    data: toAssign.map((studentId) => ({
      classId,
      studentId,
      assistantId: map[studentId],
      startDate: new Date(),
    })),
  });
}
