import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";

export type PayComponents = {
  classesCovered: number;
  baseSalary: number;
  lateDeductions: number;
  officeHoursBonus: number;
  // Net coverage: +X per session I covered for a colleague, −X per session of mine a colleague covered.
  coverageAdjustment: number;
};

export function monthWindow(month: number, year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

// Live-computed pay parts for an assistant in a month (manual adjustment lives on the
// stored calculation, not here). total = base − deductions + bonus + manualAdjustment.
export async function computePayComponents(
  assistantId: string,
  month: number,
  year: number,
): Promise<PayComponents> {
  const { start, end } = monthWindow(month, year);

  const inMonth = { gte: start, lt: end };
  const assistant = await prisma.assistant.findUnique({
    where: { id: assistantId },
    select: { operationId: true },
  });
  const cfg = await resolveConfigFor(assistant?.operationId ?? "");
  const [assignments, incidents, officeHours, covered, ownedCovered] = await Promise.all([
    // Distinct classes the assistant had an active assignment overlapping this month.
    prisma.classAssignment.findMany({
      where: {
        assistantId,
        startDate: { lt: end },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
      },
      select: { classId: true },
    }),
    prisma.lateIncident.aggregate({
      where: { assistantId, waived: false, deadline: inMonth },
      _sum: { deductionAmount: true },
    }),
    prisma.officeHourSession.count({ where: { assistantId, date: inMonth } }),
    // Sessions I covered for a colleague (+).
    prisma.classSession.count({ where: { coveredById: assistantId, scheduledDate: inMonth } }),
    // My sessions a colleague covered (−).
    prisma.classSession.count({
      where: {
        responsibleAssistantId: assistantId,
        coveredById: { not: null, notIn: [assistantId] },
        scheduledDate: inMonth,
      },
    }),
  ]);

  const classesCovered = new Set(assignments.map((a) => a.classId)).size;
  const lateDeductions = Number(incidents._sum.deductionAmount ?? 0);

  return {
    classesCovered,
    baseSalary: classesCovered * cfg.perClassSalary * cfg.payMultiplier,
    lateDeductions,
    officeHoursBonus: officeHours * cfg.officeHourBonus,
    coverageAdjustment: (covered - ownedCovered) * cfg.coverageAdjustment,
  };
}

export function payTotal(c: PayComponents, manualAdjustment: number): number {
  return (
    c.baseSalary - c.lateDeductions + c.officeHoursBonus + c.coverageAdjustment + manualAdjustment
  );
}
