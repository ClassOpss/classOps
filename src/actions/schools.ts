"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { currentOperationId } from "@/lib/operation";

export type FormState = { ok?: boolean; error?: string } | undefined;

const nameSchema = z.string().min(1, "Name is required.").max(100);

export async function createSchool(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const parsed = nameSchema.safeParse(String(formData.get("name") ?? "").trim());
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const name = parsed.data;
  const operationId = await currentOperationId();
  const existing = await prisma.school.findFirst({ where: { name, operationId } });
  if (existing) return { error: "A school with that name already exists." };

  const school = await prisma.school.create({ data: { name, operationId } });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "created_school",
    entityType: "school",
    entityId: school.id,
  });
  revalidatePath("/classes");
  return { ok: true };
}
