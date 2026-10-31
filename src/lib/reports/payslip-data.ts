import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";
import { cairoMonthWindow, formatCairo } from "@/lib/datetime";
import { INCIDENT_LABEL, incidentDoneTimes, lateBy } from "@/lib/incident-done";
import { perIncidentCharge } from "@/lib/incident-deductions";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type PayslipLine = { label: string; amount: number; note?: string };

// One missed deadline, as listed under the breakdown. ASCII-only strings (Helvetica core font).
export type PayslipIncident = {
  date: string; // deadline day, e.g. "Tue 14 Oct"
  task: string; // "Attendance"
  detail: string | null; // class + which lesson / HW / quiz
  due: string; // "9:00 PM"
  outcome: string; // "Done Wed 15, 8:01 AM (11h late)" / "Not done (3 days overdue)"
  done: boolean;
  status: "waived" | "confirmed" | "charged";
  reason: string | null; // waive reason
  charge: number; // EGP actually deducted (0 if waived or covered by the daily cap)
};

export type PayslipData = {
  logoDataUri: string | null;
  brandName: string;
  currency: string;
  generatedAt: string;
  assistantName: string;
  periodLabel: string;
  status: string;
  classesCovered: number;
  lines: PayslipLine[];
  total: number;
  incidents: PayslipIncident[];
};

const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

// Every late incident whose deadline falls in the pay month (the same set the pay detail
// page lists), waived ones included so the assistant sees what was let off and why.
async function loadIncidents(
  assistantId: string,
  month: number,
  year: number,
  operationId: string,
  cfg: Awaited<ReturnType<typeof resolveConfigFor>>,
): Promise<PayslipIncident[]> {
  const win = cairoMonthWindow(month, year);
  const incidents = await prisma.lateIncident.findMany({
    where: { assistantId, deadline: { gte: win.start, lt: win.end } },
    orderBy: { deadline: "asc" },
    include: {
      session: { select: { scheduledDate: true, class: { select: { name: true } } } },
      homework: { select: { description: true, class: { select: { name: true } } } },
      quizPrep: { select: { quizDate: true, class: { select: { name: true } } } },
    },
  });
  const charge = perIncidentCharge(
    incidents.map((i) => ({
      id: i.id,
      assistantId,
      sessionId: i.sessionId,
      quizPrepId: i.quizPrepId,
      type: i.type,
      deductionAmount: Number(i.deductionAmount),
      waived: i.waived,
    })),
  );
  const doneTimes = await incidentDoneTimes(incidents, operationId, cfg);
  const now = new Date();

  return incidents.map((i) => {
    const cls = i.session?.class ?? i.homework?.class ?? i.quizPrep?.class;
    const what = i.session
      ? `lesson of ${dayFmt.format(i.session.scheduledDate)}`
      : i.homework
        ? i.homework.description?.trim() || "homework"
        : i.quizPrep
          ? `quiz on ${dayFmt.format(i.quizPrep.quizDate)}`
          : null;
    const done = doneTimes.get(i.id);
    const detail = [cls?.name, what, done?.note].filter(Boolean).join(" · ") || null;
    const at = done?.doneAt ?? null;
    return {
      date: formatCairo(i.deadline, "EEE d MMM"),
      task: INCIDENT_LABEL[i.type],
      detail,
      due: formatCairo(i.deadline, "h:mm a"),
      outcome: at
        ? `Done ${formatCairo(at, "EEE d MMM, h:mm a")} (${lateBy(i.deadline, at)} late)`
        : `Not done (${lateBy(i.deadline, now)} overdue)`,
      done: !!at,
      status: i.waived ? "waived" : i.confirmedAt ? "confirmed" : "charged",
      reason: i.waived ? i.waiveReason?.trim() || null : null,
      charge: charge.get(i.id) ?? 0,
    };
  });
}

async function loadLogo(operationId: string, logoPath: string): Promise<string | null> {
  const op = await prisma.operation.findUnique({
    where: { id: operationId },
    select: { logoData: true, logoMime: true },
  });
  if (op?.logoData) return `data:${op.logoMime ?? "image/png"};base64,${Buffer.from(op.logoData).toString("base64")}`;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", logoPath.replace(/^\//, "")));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildPayslipData(calcId: string, operationId: string): Promise<PayslipData | null> {
  const calc = await prisma.payCalculation.findFirst({
    where: { id: calcId, payPeriod: { operationId } },
    select: {
      classesCovered: true,
      baseSalary: true,
      lateDeductions: true,
      vacationDeduction: true,
      officeHoursBonus: true,
      coverageAdjustment: true,
      manualAdjustment: true,
      adjustmentNote: true,
      total: true,
      status: true,
      assistantId: true,
      assistant: { select: { name: true } },
      payPeriod: { select: { month: true, year: true } },
    },
  });
  if (!calc) return null;
  const cfg = await resolveConfigFor(operationId);

  const n = (v: unknown) => Number(v);
  const lines: PayslipLine[] = [
    { label: `Base salary (${calc.classesCovered} ${calc.classesCovered === 1 ? "class" : "classes"})`, amount: n(calc.baseSalary) },
    { label: "Office-hour bonus", amount: n(calc.officeHoursBonus) },
    { label: "Coverage adjustment", amount: n(calc.coverageAdjustment) },
    { label: "Late deductions", amount: -n(calc.lateDeductions) },
  ];
  if (n(calc.vacationDeduction) !== 0) {
    lines.push({ label: "School vacation", amount: -n(calc.vacationDeduction) });
  }
  if (n(calc.manualAdjustment) !== 0) {
    lines.push({ label: "Manual adjustment", amount: n(calc.manualAdjustment), note: calc.adjustmentNote ?? undefined });
  }

  return {
    logoDataUri: await loadLogo(operationId, cfg.logoPath),
    brandName: cfg.brandName,
    currency: cfg.currency,
    generatedAt: new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date()),
    assistantName: calc.assistant.name,
    periodLabel: `${MONTHS[calc.payPeriod.month - 1]} ${calc.payPeriod.year}`,
    status: calc.status,
    classesCovered: calc.classesCovered,
    lines,
    total: n(calc.total),
    incidents: await loadIncidents(calc.assistantId, calc.payPeriod.month, calc.payPeriod.year, operationId, cfg),
  };
}
