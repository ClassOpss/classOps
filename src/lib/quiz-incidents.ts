import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "@/lib/db";
import { resolveConfigFor } from "@/lib/operation";
import { CAIRO_TZ, quizPrepDeadline, quizAnnounceDeadline } from "@/lib/datetime";
import { computePayComponents, payTotal } from "@/lib/pay";

// After a quiz is cancelled, moved, pushed or deleted, its old late fines no longer stand:
// a cancelled quiz had no tasks, and a moved one's deadline is no longer the one it was fined
// for. Delete every quiz fine on these cycles that doesn't match the cycle's CURRENT deadline
// (all of them for a cancelled/deleted cycle), then refresh any unsent payslip it was in.
// The cron re-fines on the new deadline day if the task is still missed then.
export async function clearStaleQuizIncidents(quizPrepIds: string[]): Promise<number> {
  if (quizPrepIds.length === 0) return 0;
  const incidents = await prisma.lateIncident.findMany({
    where: { quizPrepId: { in: quizPrepIds } },
    select: {
      id: true,
      assistantId: true,
      type: true,
      deadline: true,
      quizPrep: { select: { quizDate: true, cancelled: true, class: { select: { operationId: true } } } },
    },
  });
  if (incidents.length === 0) return 0;

  const cfgs = new Map<string, Awaited<ReturnType<typeof resolveConfigFor>>>();
  const stale: typeof incidents = [];
  for (const i of incidents) {
    const qp = i.quizPrep;
    if (!qp || qp.cancelled) {
      stale.push(i);
      continue;
    }
    const opId = qp.class.operationId;
    if (!cfgs.has(opId)) cfgs.set(opId, await resolveConfigFor(opId));
    const cfg = cfgs.get(opId)!;
    const current =
      i.type === "quiz_prep" ? quizPrepDeadline(qp.quizDate, cfg)
      : i.type === "quiz_announcement" ? quizAnnounceDeadline(qp.quizDate, cfg)
      : null;
    if (current && current.getTime() !== i.deadline.getTime()) stale.push(i);
  }
  if (stale.length === 0) return 0;

  await prisma.lateIncident.deleteMany({ where: { id: { in: stale.map((i) => i.id) } } });

  // Refresh the (unsent) payslips those fines sat in — sent ones stay frozen.
  const months = new Set(
    stale.map((i) => `${i.assistantId}|${formatInTimeZone(i.deadline, CAIRO_TZ, "yyyy-M")}`),
  );
  for (const key of months) {
    const [assistantId, ym] = key.split("|");
    const [year, month] = ym.split("-").map(Number);
    await refreshUnsentPay(assistantId, month, year);
  }
  return stale.length;
}

async function refreshUnsentPay(assistantId: string, month: number, year: number) {
  const calc = await prisma.payCalculation.findFirst({
    where: { assistantId, status: { not: "sent" }, payPeriod: { month, year, status: { not: "sent" } } },
    select: { id: true, manualAdjustment: true },
  });
  if (!calc) return;
  const c = await computePayComponents(assistantId, month, year);
  await prisma.payCalculation.update({
    where: { id: calc.id },
    data: {
      classesCovered: c.classesCovered,
      baseSalary: c.baseSalary,
      lateDeductions: c.lateDeductions,
      vacationDeduction: c.vacationDeduction,
      officeHoursBonus: c.officeHoursBonus,
      coverageAdjustment: c.coverageAdjustment,
      total: payTotal(c, Number(calc.manualAdjustment)),
    },
  });
}
