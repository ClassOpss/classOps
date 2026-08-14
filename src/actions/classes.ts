"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { DAYS } from "@/lib/constants";
import { currentOperationId, assertClassInOperation } from "@/lib/operation";

export type FormState = { ok?: boolean; error?: string } | undefined;

const classSchema = z.object({
  schoolId: z.string().min(1, "Pick a school."),
  yearGroup: z.enum(["Y9", "Y10", "S1"]),
  name: z.string().min(1, "Name is required.").max(100),
  lmsType: z.enum(["google_classroom", "ie_learn"]).default("google_classroom"),
  // One slot per selected weekday, each with its own start time.
  slots: z
    .array(
      z.object({
        day: z.enum(DAYS),
        time: z.string().regex(/^\d{2}:\d{2}$/, "Each day needs a start time."),
      }),
    )
    .min(1, "Pick at least one day."),
  planStartDate: z.string().optional(),
  notes: z.string().optional(),
});

function parseForm(formData: FormData) {
  // A day is selected when its checkbox is on; pair it with its own time input.
  const slots = DAYS.filter((d) => formData.get(`day_${d}`) === "on").map((d) => ({
    day: d,
    time: String(formData.get(`time_${d}`) ?? "").trim() || "16:00",
  }));
  return classSchema.safeParse({
    schoolId: String(formData.get("schoolId") ?? ""),
    yearGroup: String(formData.get("yearGroup") ?? ""),
    name: String(formData.get("name") ?? "").trim(),
    lmsType: String(formData.get("lmsType") ?? "google_classroom"),
    slots,
    planStartDate: String(formData.get("planStartDate") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
  });
}

export async function createClass(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const klass = await prisma.class.create({
    data: {
      operationId: await currentOperationId(),
      schoolId: d.schoolId,
      yearGroup: d.yearGroup,
      name: d.name,
      lmsType: d.lmsType,
      schedule: { slots: d.slots },
      planStartDate: d.planStartDate ? new Date(d.planStartDate) : null,
      notes: d.notes,
    },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "created_class",
    entityType: "class",
    entityId: klass.id,
    classId: klass.id,
  });
  revalidatePath("/classes");
  return { ok: true };
}

export async function updateClass(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("admin");
  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  await prisma.class.update({
    where: { id: classId },
    data: {
      schoolId: d.schoolId,
      yearGroup: d.yearGroup,
      name: d.name,
      lmsType: d.lmsType,
      schedule: { slots: d.slots },
      planStartDate: d.planStartDate ? new Date(d.planStartDate) : null,
      notes: d.notes,
    },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "updated_class",
    entityType: "class",
    entityId: classId,
    classId,
  });
  revalidatePath(`/classes/${classId}`);
  revalidatePath("/classes");
  return { ok: true };
}

export async function setClassActive(classId: string, active: boolean): Promise<void> {
  const admin = await requireRole("admin");
  await prisma.class.update({ where: { id: classId }, data: { active } });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: active ? "activated_class" : "deactivated_class",
    entityType: "class",
    entityId: classId,
    classId,
  });
  revalidatePath("/classes");
  revalidatePath(`/classes/${classId}`);
}

export type ArchiveState = { ok?: boolean; error?: string; archived?: number } | undefined;

// Start-of-year rollover: deactivate every active class in the operation and end
// their open assistant assignments (so they stop counting toward pay). History is
// kept — deactivated classes just drop off the active lists. New classes are then
// created fresh for the new year.
export async function archiveAllClasses(_prev: ArchiveState, formData: FormData): Promise<ArchiveState> {
  const admin = await requireRole("admin");
  const operationId = await currentOperationId();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "ARCHIVE") {
    return { error: 'Type "ARCHIVE" to confirm.' };
  }

  const classes = await prisma.class.findMany({
    where: { operationId, active: true },
    select: { id: true },
  });
  const classIds = classes.map((c) => c.id);
  if (classIds.length === 0) return { ok: true, archived: 0 };

  const today = new Date();
  await prisma.$transaction([
    prisma.class.updateMany({ where: { id: { in: classIds } }, data: { active: false } }),
    prisma.classAssignment.updateMany({
      where: { classId: { in: classIds }, endDate: null },
      data: { endDate: today },
    }),
    prisma.studentAssistantAssignment.updateMany({
      where: { classId: { in: classIds }, endDate: null },
      data: { endDate: today },
    }),
  ]);

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "archived_classes",
    entityType: "operation",
    entityId: operationId,
    operationId,
    metadata: { count: classIds.length },
  });
  revalidatePath("/classes");
  return { ok: true, archived: classIds.length };
}

// Store the per-class onboarding destinations (Google Classroom + WhatsApp links).
export async function setClassLinks(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireRole("admin", "teacher");
  await assertClassInOperation(classId);

  const trim = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length ? v : null;
  };
  await prisma.class.update({
    where: { id: classId },
    data: {
      googleClassroomLink: trim("googleClassroomLink"),
      studentGroupLink: trim("studentGroupLink"),
      parentCommunityLink: trim("parentCommunityLink"),
    },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "updated_class_links",
    entityType: "class",
    entityId: classId,
    classId,
  });
  revalidatePath(`/classes/${classId}/invites`);
  return { ok: true };
}
