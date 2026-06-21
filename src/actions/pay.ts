"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { logActivity } from "@/lib/activity";
import { computePayComponents, payTotal } from "@/lib/pay";

export type FormState = { ok?: boolean; error?: string } | undefined;

// Open a pay period and auto-generate one calculation per active assistant (spec 5.9).
export async function createPayPeriod(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireRole("admin");
  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: "Pick a month." };
  if (!Number.isInteger(year) || year < 2024 || year > 2100) return { error: "Enter a valid year." };

  const existing = await prisma.payPeriod.findUnique({ where: { month_year: { month, year } } });
  if (existing) return { error: "That pay period already exists." };

  const period = await prisma.payPeriod.create({ data: { month, year } });
  await generateCalculations(period.id, month, year);

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "opened_pay_period",
    entityType: "pay_period",
    entityId: period.id,
    metadata: { month, year },
  });
  revalidatePath("/pay");
  return { ok: true };
}

async function generateCalculations(periodId: string, month: number, year: number) {
  const assistants = await prisma.assistant.findMany({
    where: { active: true, user: { active: true } },
    select: { id: true },
  });
  for (const a of assistants) {
    const c = await computePayComponents(a.id, month, year);
    const existing = await prisma.payCalculation.findUnique({
      where: { payPeriodId_assistantId: { payPeriodId: periodId, assistantId: a.id } },
      select: { manualAdjustment: true },
    });
    const manual = Number(existing?.manualAdjustment ?? 0);
    await prisma.payCalculation.upsert({
      where: { payPeriodId_assistantId: { payPeriodId: periodId, assistantId: a.id } },
      update: {
        classesCovered: c.classesCovered,
        baseSalary: c.baseSalary,
        lateDeductions: c.lateDeductions,
        officeHoursBonus: c.officeHoursBonus,
        coverageAdjustment: c.coverageAdjustment,
        total: payTotal(c, manual),
      },
      create: {
        payPeriodId: periodId,
        assistantId: a.id,
        classesCovered: c.classesCovered,
        baseSalary: c.baseSalary,
        lateDeductions: c.lateDeductions,
        officeHoursBonus: c.officeHoursBonus,
        coverageAdjustment: c.coverageAdjustment,
        manualAdjustment: 0,
        total: payTotal(c, 0),
      },
    });
  }
}

// Recompute base/deductions/bonus (e.g. after waiving incidents); keep manual adjustments.
export async function recalcPayPeriod(periodId: string): Promise<void> {
  await requireRole("admin");
  const period = await prisma.payPeriod.findUnique({ where: { id: periodId } });
  if (!period || period.status === "sent") return;
  await generateCalculations(periodId, period.month, period.year);
  revalidatePath(`/pay/${periodId}`);
}

export async function setAdjustment(calcId: string, formData: FormData): Promise<void> {
  await requireRole("admin");
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (Number.isNaN(amount)) return;

  const calc = await prisma.payCalculation.findUnique({
    where: { id: calcId },
    select: {
      baseSalary: true,
      lateDeductions: true,
      officeHoursBonus: true,
      coverageAdjustment: true,
      payPeriodId: true,
    },
  });
  if (!calc) return;
  const total =
    Number(calc.baseSalary) -
    Number(calc.lateDeductions) +
    Number(calc.officeHoursBonus) +
    Number(calc.coverageAdjustment) +
    amount;
  await prisma.payCalculation.update({
    where: { id: calcId },
    data: { manualAdjustment: amount, adjustmentNote: note, total },
  });
  revalidatePath(`/pay/${calc.payPeriodId}`);
}

export async function approveCalc(calcId: string): Promise<void> {
  await requireRole("admin");
  const c = await prisma.payCalculation.update({
    where: { id: calcId },
    data: { status: "approved" },
    select: { payPeriodId: true },
  });
  revalidatePath(`/pay/${c.payPeriodId}`);
}

export async function sendCalc(calcId: string): Promise<void> {
  const admin = await requireRole("admin");
  const c = await prisma.payCalculation.update({
    where: { id: calcId },
    data: { status: "sent", sentAt: new Date() },
    select: { payPeriodId: true, assistantId: true },
  });
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "sent_pay_slip",
    entityType: "pay_calculation",
    entityId: calcId,
  });
  revalidatePath(`/pay/${c.payPeriodId}`);
}
