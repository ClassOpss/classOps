"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

export type FormState = { ok?: boolean; error?: string } | undefined;

const schema = z.object({
  type: z.enum(["quiz", "midterm", "past_paper", "exam"]),
  label: z.string().min(1, "Label is required.").max(150),
  topicNotes: z.string().max(300).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date."),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maxMark: z.coerce.number().int().positive("Max mark must be a positive number."),
  isDiagnostic: z.boolean(),
});

export async function createAssessment(
  classId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin", "teacher");
  const parsed = schema.safeParse({
    type: String(formData.get("type") ?? ""),
    label: String(formData.get("label") ?? "").trim(),
    topicNotes: String(formData.get("topicNotes") ?? "").trim() || undefined,
    date: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? "").trim() || undefined,
    maxMark: String(formData.get("maxMark") ?? ""),
    // Past papers are diagnostic by default (excluded from cumulative averages, spec 4.14).
    isDiagnostic: formData.get("isDiagnostic") === "on" || String(formData.get("type")) === "past_paper",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const assessment = await prisma.assessment.create({
    data: {
      classId,
      type: d.type,
      label: d.label,
      topicNotes: d.topicNotes,
      date: new Date(d.date),
      time: d.time,
      maxMark: d.maxMark,
      isDiagnostic: d.isDiagnostic,
    },
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "created_assessment",
    entityType: "assessment",
    entityId: assessment.id,
    classId,
  });
  revalidatePath(`/classes/${classId}/assessments`);
  return { ok: true };
}

export async function deleteAssessment(assessmentId: string): Promise<void> {
  const user = await requireRole("admin", "teacher");
  const a = await prisma.assessment.delete({
    where: { id: assessmentId },
    select: { classId: true },
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "deleted_assessment",
    entityType: "assessment",
    entityId: assessmentId,
    classId: a.classId,
  });
  revalidatePath(`/classes/${a.classId}/assessments`);
}
