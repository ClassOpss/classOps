import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";
import { loadVacations, vacationDaysInMonth, vacationFractionOff } from "@/lib/vacations";
import { effectiveDeductionTotal } from "@/lib/incident-deductions";
import { cairoMonthWindow } from "@/lib/datetime";

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

export type PaidClass = {
  classId: string;
  name: string;
  schoolId: string;
  endDate: Date | null;
  days: number; // days on this class's roster within the month
  monthDays: number;
  share: number; // days / monthDays — the fraction of this class's base salary earned
};

// The distinct classes an assistant gets a base salary for in a month: permanent roster rows
// overlapping the month (endDate exclusive), prorated by days on the roster. Covers (isSubstitute) are paid via
// coverageAdjustment, deactivated classes are hidden from the assistant, and zero-length rows
// (assigned by mistake, ended the same day) don't count. A class counts once even with several
// rows (day-owner switches close one row and open another).
export async function paidClasses(assistantId: string, month: number, year: number): Promise<PaidClass[]> {
  const { start, end } = monthWindow(month, year);
  const rows = await prisma.classAssignment.findMany({
    where: {
      assistantId,
      isSubstitute: false,
      class: { active: true },
      startDate: { lt: end },
      OR: [{ endDate: null }, { endDate: { gt: start } }],
    },
    orderBy: { startDate: "asc" },
    select: { classId: true, startDate: true, endDate: true, class: { select: { name: true, schoolId: true } } },
  });
  const DAY = 86_400_000;
  const monthDays = Math.round((end.getTime() - start.getTime()) / DAY);
  const byClass = new Map<string, PaidClass>();
  for (const r of rows) {
    if (r.endDate && r.endDate.getTime() <= r.startDate.getTime()) continue;
    // Days on the roster inside this month; a class's rows don't overlap, so they add up.
    const from = Math.max(start.getTime(), r.startDate.getTime());
    const to = Math.min(end.getTime(), (r.endDate ?? end).getTime());
    const days = Math.max(0, Math.round((to - from) / DAY));
    const prev = byClass.get(r.classId);
    const total = Math.min(monthDays, (prev?.days ?? 0) + days);
    // Later rows win the endDate, so the current open row beats an earlier closed one.
    byClass.set(r.classId, {
      classId: r.classId,
      name: r.class.name,
      schoolId: r.class.schoolId,
      endDate: r.endDate,
      days: total,
      monthDays,
      share: total / monthDays,
    });
  }
  return [...byClass.values()].filter((c) => c.days > 0);
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
  const incidentWindow = cairoMonthWindow(month, year);
  const assistant = await prisma.assistant.findUnique({
    where: { id: assistantId },
    select: { operationId: true, perClassSalary: true },
  });
  const cfg = await resolveConfigFor(assistant?.operationId ?? "");
  // Per-assistant rate (seniority) overrides the operation default when set.
  const perClassRate =
    assistant?.perClassSalary != null ? Number(assistant.perClassSalary) : cfg.perClassSalary;
  const [assignments, incidents, officeHours, covered, ownedCovered, vacations] = await Promise.all([
    paidClasses(assistantId, month, year),
    // Non-waived incidents whose deadline falls this month (Cairo calendar). Each incident
    // belongs to exactly ONE month, so last month's fines never carry into this payslip.
    // Daily tasks are capped per session-day (see effectiveDeductionTotal); weekly per incident.
    prisma.lateIncident.findMany({
      where: { assistantId, waived: false, deadline: { gte: incidentWindow.start, lt: incidentWindow.end } },
      select: { sessionId: true, quizPrepId: true, type: true, deductionAmount: true },
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

  // Base is prorated per class; the stored count is whole-class equivalents (e.g. 2 full
  // classes + 1 day of a third = 2). The pay page lists the partial classes.
  const classShares = assignments.reduce((s, a) => s + a.share, 0);
  const classesCovered = Math.round(classShares);
  const perClassBase = perClassRate * cfg.payMultiplier;
  const lateDeductions = effectiveDeductionTotal(
    incidents.map((i) => ({
      assistantId,
      sessionId: i.sessionId,
      quizPrepId: i.quizPrepId,
      type: i.type,
      deductionAmount: Number(i.deductionAmount),
      waived: false,
    })),
  );

  // Per class: withhold a fraction of its base for its school's vacation days this month.
  let vacationDeduction = 0;
  for (const a of assignments) {
    const days = vacationDaysInMonth(a.schoolId, month, year, vacations);
    vacationDeduction += perClassBase * a.share * vacationFractionOff(days);
  }

  return {
    classesCovered,
    baseSalary: Math.round(classShares * perClassBase),
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
