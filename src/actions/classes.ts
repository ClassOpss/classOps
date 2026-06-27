"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { DAYS } from "@/lib/constants";
import { currentOperationId } from "@/lib/operation";

export type FormState = { ok?: boolean; error?: string } | undefined;

const classSchema = z.object({
  schoolId: z.string().min(1, "Pick a school."),
  yearGroup: z.enum(["Y9", "Y10", "S1"]),
  name: z.string().min(1, "Name is required.").max(100),
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
