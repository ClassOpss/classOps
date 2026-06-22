"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { ACTIVE_OPERATION_COOKIE } from "@/lib/operation";
import { createSetupToken, setupUrl } from "@/lib/tokens";

export type OperationFormState =
  | { ok: true; teacherEmail: string; setupUrl: string }
  | { ok: false; error: string }
  | undefined;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// Super-admin: switch the operation the admin area is scoped to.
export async function setActiveOperation(operationId: string): Promise<void> {
  await requireRole("admin");
  const op = await prisma.operation.findUnique({ where: { id: operationId }, select: { id: true } });
  if (!op) return;
  (await cookies()).set(ACTIVE_OPERATION_COOKIE, op.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

const schema = z.object({
  name: z.string().min(1, "Operation name is required.").max(100),
  teacherName: z.string().min(1, "Teacher name is required.").max(100),
  teacherEmail: z.string().email("Enter a valid teacher email."),
  brandName: z.string().min(1).max(100),
  brandSignature: z.string().min(1).max(100),
  logoPath: z.string().min(1).max(200),
  currency: z.string().min(1).max(10),
  dailyDeadlineHour: z.coerce.number().int().min(0).max(23),
  weeklyDeadlineWeekday: z.coerce.number().int().min(0).max(6),
  weeklyDeadlineHour: z.coerce.number().int().min(0).max(23),
  perClassSalary: z.coerce.number().nonnegative(),
  officeHourBonus: z.coerce.number().nonnegative(),
  lateDeduction: z.coerce.number().nonnegative(),
  coverageAdjustment: z.coerce.number().nonnegative(),
  payMultiplier: z.coerce.number().positive(),
  schools: z.string().optional(),
});

// Super-admin: onboard a new teacher = new Operation (all config) + teacher account
// (invite link, sets own password) + optional starter school list.
export async function createOperation(
  _prev: OperationFormState,
  formData: FormData,
): Promise<OperationFormState> {
  const admin = await requireRole("admin");

  const parsed = schema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    teacherName: String(formData.get("teacherName") ?? "").trim(),
    teacherEmail: String(formData.get("teacherEmail") ?? "").trim(),
    brandName: String(formData.get("brandName") ?? "").trim(),
    brandSignature: String(formData.get("brandSignature") ?? "").trim(),
    logoPath: String(formData.get("logoPath") ?? "").trim(),
    currency: String(formData.get("currency") ?? "").trim(),
    dailyDeadlineHour: String(formData.get("dailyDeadlineHour") ?? ""),
    weeklyDeadlineWeekday: String(formData.get("weeklyDeadlineWeekday") ?? ""),
    weeklyDeadlineHour: String(formData.get("weeklyDeadlineHour") ?? ""),
    perClassSalary: String(formData.get("perClassSalary") ?? ""),
    officeHourBonus: String(formData.get("officeHourBonus") ?? ""),
    lateDeduction: String(formData.get("lateDeduction") ?? ""),
    coverageAdjustment: String(formData.get("coverageAdjustment") ?? ""),
    payMultiplier: String(formData.get("payMultiplier") ?? ""),
    schools: String(formData.get("schools") ?? ""),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const email = d.teacherEmail.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) return { ok: false, error: "A user with that email already exists." };

  // Unique slug (append a counter on collision).
  const base = slugify(d.name) || "operation";
  let slug = base;
  for (let i = 2; await prisma.operation.findUnique({ where: { slug }, select: { id: true } }); i++) {
    slug = `${base}-${i}`;
  }

  const operation = await prisma.operation.create({
    data: {
      name: d.name,
      slug,
      brandName: d.brandName,
      brandSignature: d.brandSignature,
      logoPath: d.logoPath,
      currency: d.currency,
      dailyDeadlineHour: d.dailyDeadlineHour,
      weeklyDeadlineWeekday: d.weeklyDeadlineWeekday,
      weeklyDeadlineHour: d.weeklyDeadlineHour,
      perClassSalary: d.perClassSalary,
      officeHourBonus: d.officeHourBonus,
      lateDeduction: d.lateDeduction,
      coverageAdjustment: d.coverageAdjustment,
      payMultiplier: d.payMultiplier,
    },
  });

  // The teacher account (sets their own password via the invite link).
  await prisma.user.create({
    data: {
      email,
      name: d.teacherName,
      role: "teacher",
      active: true,
      operationId: operation.id,
    },
  });

  // Optional starter schools (one per line).
  const schoolNames = (d.schools ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (schoolNames.length) {
    await prisma.school.createMany({
      data: schoolNames.map((name) => ({ name, operationId: operation.id })),
    });
  }

  const token = await createSetupToken(email);

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "created_operation",
    entityType: "operation",
    entityId: operation.id,
    operationId: operation.id,
    metadata: { teacherEmail: email, schools: schoolNames.length },
  });

  revalidatePath("/operations");
  return { ok: true, teacherEmail: email, setupUrl: setupUrl(email, token) };
}
