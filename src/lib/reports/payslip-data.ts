import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type PayslipLine = { label: string; amount: number; note?: string };

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
};

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
      officeHoursBonus: true,
      coverageAdjustment: true,
      manualAdjustment: true,
      adjustmentNote: true,
      total: true,
      status: true,
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
  };
}
