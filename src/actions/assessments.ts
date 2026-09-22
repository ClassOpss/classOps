"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
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
  // Admin, teacher, or an assigned assistant of this class.
  const user = await requireClassAccess(classId);
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

// Set (or correct) the max mark — auto-created quiz assessments start without one.
// Existing percentages are recomputed; a max below a mark already entered is refused.
export async function setMaxMark(
  assessmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const found = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { classId: true },
  });
  if (!found) return { error: "Assessment not found." };
  const user = await requireClassAccess(found.classId);

  const parsed = schema.shape.maxMark.safeParse(String(formData.get("maxMark") ?? ""));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const maxMark = parsed.data;

  const grades = await prisma.assessmentGrade.findMany({
    where: { assessmentId, rawMark: { not: null } },
    select: { id: true, rawMark: true },
  });
  const highest = Math.max(0, ...grades.map((g) => Number(g.rawMark)));
  if (highest > maxMark) return { error: `A mark of ${highest} is already entered — max must be at least that.` };

  await prisma.$transaction([
    prisma.assessment.update({ where: { id: assessmentId }, data: { maxMark } }),
    ...grades.map((g) =>
      prisma.assessmentGrade.update({
        where: { id: g.id },
        data: { percentage: Math.round((Number(g.rawMark) / maxMark) * 10000) / 100 },
      }),
    ),
  ]);
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "set_max_mark",
    entityType: "assessment",
    entityId: assessmentId,
    classId: found.classId,
    metadata: { maxMark },
  });
  revalidatePath(`/classes/${found.classId}/assessments`);
  revalidatePath(`/my/classes/${found.classId}/assessments`, "layout");
  return { ok: true };
}

export async function deleteAssessment(assessmentId: string): Promise<void> {
  const found = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { classId: true },
  });
  if (!found) return;
  const user = await requireClassAccess(found.classId);
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
