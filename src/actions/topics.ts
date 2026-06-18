"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";

export type FormState = { ok?: boolean; error?: string } | undefined;

const topicSchema = z.object({
  title: z.string().min(1, "Title is required.").max(150),
  yearGroup: z.enum(["Y9", "Y10", "S1"]),
  chapter: z.string().max(100).optional(),
});

// Teacher/Admin: create a syllabus topic for a year group.
export async function createTopic(
  yearGroup: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin", "teacher");
  const parsed = topicSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    yearGroup,
    chapter: String(formData.get("chapter") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const dup = await prisma.topic.findFirst({
    where: { yearGroup: d.yearGroup, title: { equals: d.title, mode: "insensitive" } },
    select: { id: true },
  });
  if (dup) return { error: "That topic already exists for this year group." };

  const last = await prisma.topic.findFirst({
    where: { yearGroup: d.yearGroup },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const topic = await prisma.topic.create({
    data: {
      title: d.title,
      yearGroup: d.yearGroup,
      chapter: d.chapter,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "created_topic",
    entityType: "topic",
    entityId: topic.id,
  });
  revalidatePath("/lesson-plan");
  return { ok: true };
}

// Delete a topic. Optional FKs (plan items, sessions, assessments) null out automatically.
export async function deleteTopic(topicId: string): Promise<void> {
  const user = await requireRole("admin", "teacher");
  await prisma.topic.delete({ where: { id: topicId } });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "deleted_topic",
    entityType: "topic",
    entityId: topicId,
  });
  revalidatePath("/lesson-plan");
}
