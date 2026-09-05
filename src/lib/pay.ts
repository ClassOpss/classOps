import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";
import { loadVacations, vacationDaysInMonth, vacationFractionOff } from "@/lib/vacations";

export type PayComponents = {
  classesCovered: number;
  baseSalary: number;
  lateDeductions: number;
  // Base pay withheld for school vacations that month (prorated per class by its school's
  // break: 1 week off = ¼, 2 weeks = ½, whole month = full base). Never touches bonuses.
  vacationDeduction: number;
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
    select: { operationId: true, perClassSalary: true },
  });
  const cfg = await resolveConfigFor(assistant?.operationId ?? "");
  // Per-assistant rate (seniority) overrides the operation default when set.
  const perClassRate =
    assistant?.perClassSalary != null ? Number(assistant.perClassSalary) : cfg.perClassSalary;
  const [assignments, incidents, officeHours, covered, ownedCovered, vacations] = await Promise.all([
    // Distinct classes the assistant had an active assignment overlapping this month.
    prisma.classAssignment.findMany({
      where: {
        assistantId,
        startDate: { lt: end },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
      },
      select: { classId: true, class: { select: { schoolId: true } } },
    }),
    prisma.lateIncident.aggregate({
      where: { assistantId, waived: false, deadline: inMonth },
      _sum: { deductionAmount: true },
    }),
    // Only admin-approved office hours count toward the bonus.
    prisma.officeHourSession.count({ where: { assistantId, date: inMonth, approved: true } }),
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
    loadVacations(assistant?.operationId ?? ""),
  ]);

  // Distinct classes, each with its school (a class contributes once even with 2 assignments).
  const classSchool = new Map<string, string>();
  for (const a of assignments) classSchool.set(a.classId, a.class.schoolId);
  const classesCovered = classSchool.size;
  const perClassBase = perClassRate * cfg.payMultiplier;
  const lateDeductions = Number(incidents._sum.deductionAmount ?? 0);

  // Per class: withhold a fraction of its base for its school's vacation days this month.
  let vacationDeduction = 0;
  for (const schoolId of classSchool.values()) {
    const days = vacationDaysInMonth(schoolId, month, year, vacations);
    vacationDeduction += perClassBase * vacationFractionOff(days);
  }

  return {
    classesCovered,
    baseSalary: classesCovered * perClassBase,
    lateDeductions,
    vacationDeduction,
    officeHoursBonus: officeHours * cfg.officeHourBonus,
    coverageAdjustment: (covered - ownedCovered) * cfg.coverageAdjustment,
  };
}

export function payTotal(c: PayComponents, manualAdjustment: number): number {
  return (
    c.baseSalary -
    c.lateDeductions -
    c.vacationDeduction +
    c.officeHoursBonus +
    c.coverageAdjustment +
    manualAdjustment
  );
}
