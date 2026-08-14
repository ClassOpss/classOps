"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { currentOperationId } from "@/lib/operation";
import { logActivity } from "@/lib/activity";

export type ConfigState = { ok?: boolean; error?: string } | undefined;

const schema = z.object({
  brandName: z.string().min(1, "Brand name is required.").max(100),
  brandSignature: z.string().min(1, "Signature is required.").max(100),
  currency: z.string().min(1).max(10),
  dailyDeadlineHour: z.coerce.number().int().min(0).max(23),
  weeklyDeadlineWeekday: z.coerce.number().int().min(0).max(6),
  weeklyDeadlineHour: z.coerce.number().int().min(0).max(23),
  perClassSalary: z.coerce.number().nonnegative(),
  officeHourBonus: z.coerce.number().nonnegative(),
  lateDeduction: z.coerce.number().nonnegative(),
  coverageAdjustment: z.coerce.number().nonnegative(),
  payMultiplier: z.coerce.number().positive(),
});

// Super-admin: update an operation's pay/config mid-year. Applies to future pay
// runs and any open (un-sent) period on recalculation; already-sent periods keep
// their stored figures.
export async function updateOperationConfig(_prev: ConfigState, formData: FormData): Promise<ConfigState> {
  const admin = await requireRole("admin");
  const operationId = await currentOperationId();

  const parsed = schema.safeParse({
    brandName: String(formData.get("brandName") ?? "").trim(),
    brandSignature: String(formData.get("brandSignature") ?? "").trim(),
    currency: String(formData.get("currency") ?? "").trim(),
    dailyDeadlineHour: String(formData.get("dailyDeadlineHour") ?? ""),
    weeklyDeadlineWeekday: String(formData.get("weeklyDeadlineWeekday") ?? ""),
    weeklyDeadlineHour: String(formData.get("weeklyDeadlineHour") ?? ""),
    perClassSalary: String(formData.get("perClassSalary") ?? ""),
    officeHourBonus: String(formData.get("officeHourBonus") ?? ""),
    lateDeduction: String(formData.get("lateDeduction") ?? ""),
    coverageAdjustment: String(formData.get("coverageAdjustment") ?? ""),
    payMultiplier: String(formData.get("payMultiplier") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.operation.update({ where: { id: operationId }, data: parsed.data });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "updated_operation_config",
    entityType: "operation",
    entityId: operationId,
    operationId,
  });
  revalidatePath("/settings");
  return { ok: true };
}
