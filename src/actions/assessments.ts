"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { attachQuizTasks } from "@/lib/quiz-assessment";
import { clearStaleQuizIncidents } from "@/lib/quiz-incidents";
import { Prisma } from "@prisma/client";
import { GRADES, validateBoundaries } from "@/lib/grade-boundaries";

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
  await attachQuizTasks(assessment);
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "created_assessment",
    entityType: "assessment",
    entityId: assessment.id,
    classId,
  });
  revalidatePath(`/classes/${classId}/assessments`);
  revalidatePath(`/classes/${classId}/quizzes`);
  revalidatePath(`/my/classes/${classId}`, "layout");
  revalidatePath("/my/tasks");
  return { ok: true };
}

// Rename an assessment (e.g. an auto-made "Quiz 3" -> "Quiz 3 — Trigonometry").
export async function renameAssessment(
  assessmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const found = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { classId: true, label: true },
  });
  if (!found) return { error: "Assessment not found." };
  const user = await requireClassAccess(found.classId);

  const parsed = schema.shape.label.safeParse(String(formData.get("label") ?? "").trim());
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const label = parsed.data;
  if (label === found.label) return { ok: true };

  await prisma.assessment.update({ where: { id: assessmentId }, data: { label } });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "renamed_assessment",
    entityType: "assessment",
    entityId: assessmentId,
    classId: found.classId,
    metadata: { from: found.label, to: label },
  });
  revalidatePath(`/classes/${found.classId}`, "layout");
  revalidatePath(`/my/classes/${found.classId}`, "layout");
  revalidatePath("/my/tasks");
  revalidatePath("/trends");
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

// Set (or clear) this assessment's grade boundaries, in raw marks. Fields "g_<grade>";
// blank grades are skipped (e.g. a Core paper stops at C); all blank clears them.
export async function setGradeBoundaries(
  assessmentId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const found = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { classId: true, maxMark: true },
  });
  if (!found) return { error: "Assessment not found." };
  const user = await requireClassAccess(found.classId);
  if (found.maxMark == null) return { error: "Set the max mark first." };

  // "Use automatic" clears the override; a blank form does the same.
  const reset = formData.get("reset") === "1";
  const result = reset
    ? { boundaries: [] }
    : validateBoundaries(
        GRADES.map((grade) => ({ grade, min: String(formData.get(`g_${grade}`) ?? "") })),
        found.maxMark,
      );
  if ("error" in result) return { error: result.error };

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: { gradeBoundaries: result.boundaries.length ? result.boundaries : Prisma.DbNull },
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "set_grade_boundaries",
    entityType: "assessment",
    entityId: assessmentId,
    classId: found.classId,
    metadata: { boundaries: result.boundaries },
  });
  revalidatePath(`/classes/${found.classId}`, "layout");
  revalidatePath(`/my/classes/${found.classId}`, "layout");
  revalidatePath("/trends");
  return { ok: true };
}

export async function deleteAssessment(assessmentId: string): Promise<void> {
  const found = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { classId: true },
  });
  if (!found) return;
  const user = await requireClassAccess(found.classId);
  // Its own ad-hoc quiz tasks go with it — and their late fines, since the quiz is gone;
  // a cadence cycle just loses the link.
  const own = await prisma.quizPrep.findMany({ where: { assessmentId, adHoc: true }, select: { id: true } });
  if (own.length > 0) {
    await prisma.quizPrep.updateMany({ where: { id: { in: own.map((r) => r.id) } }, data: { cancelled: true } });
    await clearStaleQuizIncidents(own.map((r) => r.id));
    await prisma.quizPrep.deleteMany({ where: { id: { in: own.map((r) => r.id) } } });
  }
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
  revalidatePath(`/classes/${a.classId}/quizzes`);
  revalidatePath(`/my/classes/${a.classId}`, "layout");
  revalidatePath("/my/tasks");
  if (own.length > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/pay", "layout");
  }
}
