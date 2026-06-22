"use server";

import { revalidatePath } from "next/cache";
import type { YearGroup } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { currentOperationId } from "@/lib/operation";

export type FormState = { ok?: boolean; error?: string } | undefined;

// One LessonPlan per (operation, year group); create on first use.
async function getOrCreatePlan(yearGroup: YearGroup): Promise<string> {
  const operationId = await currentOperationId();
  const existing = await prisma.lessonPlan.findUnique({
    where: { operationId_yearGroup: { operationId, yearGroup } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.lessonPlan.create({
    data: { operationId, yearGroup },
    select: { id: true },
  });
  return created.id;
}

// Append a topic to the year-group plan.
export async function addPlanItem(
  yearGroup: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireRole("admin", "teacher");
  const topicId = String(formData.get("topicId") ?? "");
  if (!topicId) return { error: "Pick a topic." };

  // The topic must belong to this operation (blocks cross-operation plan items).
  const operationId = await currentOperationId();
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, select: { operationId: true } });
  if (!topic || topic.operationId !== operationId) return { error: "Pick a topic." };

  const planId = await getOrCreatePlan(yearGroup as YearGroup);
  const last = await prisma.lessonPlanItem.findFirst({
    where: { planId },
    orderBy: { sequence: "desc" },
    select: { sequence: true },
  });
  await prisma.lessonPlanItem.create({
    data: { planId, topicId, sequence: (last?.sequence ?? 0) + 1 },
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "added_plan_item",
    entityType: "lesson_plan",
    entityId: planId,
    metadata: { yearGroup, topicId },
  });
  revalidatePath("/lesson-plan");
  return { ok: true };
}

export async function removePlanItem(itemId: string): Promise<void> {
  await requireRole("admin", "teacher");
  const operationId = await currentOperationId();
  const item = await prisma.lessonPlanItem.findUnique({
    where: { id: itemId },
    select: { plan: { select: { operationId: true } } },
  });
  if (!item || item.plan.operationId !== operationId) return;
  await prisma.lessonPlanItem.delete({ where: { id: itemId } });
  revalidatePath("/lesson-plan");
}

// Move an item up or down, then renumber the whole plan 1..n.
export async function movePlanItem(itemId: string, direction: "up" | "down"): Promise<void> {
  await requireRole("admin", "teacher");
  const operationId = await currentOperationId();

  const item = await prisma.lessonPlanItem.findUnique({
    where: { id: itemId },
    select: { id: true, planId: true, plan: { select: { operationId: true } } },
  });
  if (!item || item.plan.operationId !== operationId) return;

  const items = await prisma.lessonPlanItem.findMany({
    where: { planId: item.planId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });
  const index = items.findIndex((i) => i.id === itemId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return;

  // Swap positions in the ordered list.
  [items[index], items[target]] = [items[target], items[index]];

  // Renumber in a transaction; offset first to avoid the @@unique([planId, sequence]) clash.
  await prisma.$transaction([
    ...items.map((i, idx) =>
      prisma.lessonPlanItem.update({ where: { id: i.id }, data: { sequence: idx + 1000 } }),
    ),
    ...items.map((i, idx) =>
      prisma.lessonPlanItem.update({ where: { id: i.id }, data: { sequence: idx + 1 } }),
    ),
  ]);

  revalidatePath("/lesson-plan");
}
