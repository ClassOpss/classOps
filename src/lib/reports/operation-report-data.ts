import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { monthWindow } from "@/lib/pay";
import { resolveConfigFor } from "@/lib/operation";
import { detectAtRiskStudents } from "@/lib/at-risk";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const ukDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

export type OperationReportData = {
  logoDataUri: string | null;
  brandName: string;
  generatedAt: string;
  monthLabel: string;
  currency: string;
  kpis: {
    sessionsDelivered: number;
    sessionsPlanned: number;
    avgAttendance: string;
    avgGrade: string;
    students: number;
    activeClasses: number;
    activeAssistants: number;
    hwCompletion: string;
    needsAttention: number;
    payTotal: string;
  };
  classes: { name: string; school: string; students: number; attendance: string; avgGrade: string }[];
  assistants: { name: string; sessions: number; officeHours: number; incidents: number; netPay: string }[];
};

async function loadLogo(operationId: string, logoPath: string): Promise<string | null> {
  const op = await prisma.operation.findUnique({ where: { id: operationId }, select: { logoData: true, logoMime: true } });
  if (op?.logoData) return `data:${op.logoMime ?? "image/png"};base64,${Buffer.from(op.logoData).toString("base64")}`;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", logoPath.replace(/^\//, "")));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildOperationReportData(
  operationId: string,
  month: number,
  year: number,
): Promise<OperationReportData> {
  const { start, end } = monthWindow(month, year);
  const inMonth = { gte: start, lt: end };
  const now = new Date();

  const [classes, sessions, grades, homeworks, assistants, payPeriod, atRisk, cfg] = await Promise.all([
    prisma.class.findMany({
      where: { active: true, operationId },
      orderBy: [{ school: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, school: { select: { name: true } }, _count: { select: { students: { where: { active: true } } } } },
    }),
    prisma.classSession.findMany({
      where: { dayOff: false, scheduledDate: inMonth, class: { active: true, operationId } },
      select: { classId: true, scheduledDate: true, responsibleAssistantId: true, coveredById: true, attendance: { select: { status: true } } },
    }),
    prisma.assessmentGrade.findMany({
      where: { percentage: { not: null }, assessment: { isDiagnostic: false, date: inMonth, class: { active: true, operationId } } },
      select: { percentage: true, assessment: { select: { classId: true } } },
    }),
    prisma.homeworkAssignment.findMany({
      where: { noHomework: false, deadline: inMonth, class: { active: true, operationId } },
      select: {
        classId: true,
        submissions: { where: { status: { in: ["on_time", "late"] } }, select: { id: true } },
        class: { select: { _count: { select: { students: { where: { active: true } } } } } },
      },
    }),
    prisma.assistant.findMany({
      where: { active: true, operationId, user: { active: true } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            officeHours: { where: { date: inMonth, approved: true } },
            incidents: { where: { deadline: inMonth, waived: false } },
          },
        },
      },
    }),
    prisma.payPeriod.findUnique({
      where: { operationId_month_year: { operationId, month, year } },
      include: { calculations: { select: { assistantId: true, total: true } } },
    }),
    detectAtRiskStudents(operationId),
    resolveConfigFor(operationId),
  ]);

  // Per-class + overall attendance, and per-assistant session ownership.
  const attByClass = new Map<string, { p: number; t: number }>();
  const sessionsByAssistant = new Map<string, number>();
  let attP = 0;
  let attT = 0;
  let delivered = 0;
  for (const s of sessions) {
    if (s.scheduledDate <= now) delivered++;
    const a = attByClass.get(s.classId) ?? { p: 0, t: 0 };
    for (const x of s.attendance) {
      a.t++;
      attT++;
      if (x.status === "present") { a.p++; attP++; }
    }
    attByClass.set(s.classId, a);
    const owner = s.coveredById ?? s.responsibleAssistantId;
    if (owner) sessionsByAssistant.set(owner, (sessionsByAssistant.get(owner) ?? 0) + 1);
  }

  // Per-class + overall grade average.
  const gradeByClass = new Map<string, { sum: number; n: number }>();
  let gradeSum = 0;
  let gradeN = 0;
  for (const g of grades) {
    const cid = g.assessment.classId;
    const gm = gradeByClass.get(cid) ?? { sum: 0, n: 0 };
    gm.sum += Number(g.percentage);
    gm.n++;
    gradeByClass.set(cid, gm);
    gradeSum += Number(g.percentage);
    gradeN++;
  }

  // Homework completion (overall): submitted / expected.
  let hwSubs = 0;
  let hwExpected = 0;
  for (const h of homeworks) {
    hwSubs += h.submissions.length;
    hwExpected += h.class._count.students;
  }

  const payByAssistant = new Map(payPeriod?.calculations.map((c) => [c.assistantId, Number(c.total)]) ?? []);
  const payTotal = payPeriod ? payPeriod.calculations.reduce((s, c) => s + Number(c.total), 0) : null;

  const money = (v: number) => `${Math.round(v).toLocaleString("en-US")} ${cfg.currency}`;

  return {
    logoDataUri: await loadLogo(operationId, cfg.logoPath),
    brandName: cfg.brandName,
    generatedAt: ukDate(now),
    monthLabel: `${MONTHS[month - 1]} ${year}`,
    currency: cfg.currency,
    kpis: {
      sessionsDelivered: delivered,
      sessionsPlanned: sessions.length,
      avgAttendance: pct(attP, attT),
      avgGrade: gradeN ? `${Math.round(gradeSum / gradeN)}%` : "—",
      students: classes.reduce((s, c) => s + c._count.students, 0),
      activeClasses: classes.length,
      activeAssistants: assistants.length,
      hwCompletion: pct(hwSubs, hwExpected),
      needsAttention: atRisk.length,
      payTotal: payTotal == null ? "—" : money(payTotal),
    },
    classes: classes.map((c) => {
      const a = attByClass.get(c.id);
      const g = gradeByClass.get(c.id);
      return {
        name: c.name,
        school: c.school.name,
        students: c._count.students,
        attendance: a ? pct(a.p, a.t) : "—",
        avgGrade: g && g.n ? `${Math.round(g.sum / g.n)}%` : "—",
      };
    }),
    assistants: assistants.map((a) => ({
      name: a.name,
      sessions: sessionsByAssistant.get(a.id) ?? 0,
      officeHours: a._count.officeHours,
      incidents: a._count.incidents,
      netPay: payByAssistant.has(a.id) ? money(payByAssistant.get(a.id)!) : "—",
    })),
  };
}
