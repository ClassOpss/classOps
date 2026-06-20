import { prisma } from "@/lib/db";

export const PER_CLASS = 1000; // EGP per class covered (spec 5.9)
export const PER_OFFICE_HOUR = 100; // EGP bonus per office-hour session

export type PayComponents = {
  classesCovered: number;
  baseSalary: number;
  lateDeductions: number;
  officeHoursBonus: number;
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

  const [assignments, incidents, officeHours] = await Promise.all([
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
      where: { assistantId, waived: false, deadline: { gte: start, lt: end } },
      _sum: { deductionAmount: true },
    }),
    prisma.officeHourSession.count({
      where: { assistantId, date: { gte: start, lt: end } },
    }),
  ]);

  const classesCovered = new Set(assignments.map((a) => a.classId)).size;
  const lateDeductions = Number(incidents._sum.deductionAmount ?? 0);

  return {
    classesCovered,
    baseSalary: classesCovered * PER_CLASS,
    lateDeductions,
    officeHoursBonus: officeHours * PER_OFFICE_HOUR,
  };
}

export function payTotal(c: PayComponents, manualAdjustment: number): number {
  return c.baseSalary - c.lateDeductions + c.officeHoursBonus + manualAdjustment;
}
