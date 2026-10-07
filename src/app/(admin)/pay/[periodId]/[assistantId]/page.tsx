import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { cairoMonthWindow, formatCairo } from "@/lib/datetime";
import { computePayComponents, monthWindow, paidClasses } from "@/lib/pay";
import { perIncidentCharge } from "@/lib/incident-deductions";
import { recalcPayPeriod } from "@/actions/pay";
import { waiveIncident, unwaiveIncident, confirmIncidents } from "@/actions/incidents";
import { INCIDENT_LABEL } from "@/app/(admin)/dashboard/incidents-panel";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const egp = (v: unknown) => Number(v).toLocaleString("en-US");
const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-border px-5 py-3">
        <h2 className="section-title">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

// One assistant's month on the payslip: what each number is made of — every missed task
// (which day, which class, done late or never, waived and why), office hours, coverage.
export default async function AssistantPayDetailPage({
  params,
}: {
  params: Promise<{ periodId: string; assistantId: string }>;
}) {
  await requireRole("admin");
  const { periodId, assistantId } = await params;
  const operationId = await currentOperationId();

  const calc = await prisma.payCalculation.findUnique({
    where: { payPeriodId_assistantId: { payPeriodId: periodId, assistantId } },
    include: {
      assistant: { select: { name: true, perClassSalary: true } },
      payPeriod: { select: { month: true, year: true, operationId: true } },
    },
  });
  if (!calc || calc.payPeriod.operationId !== operationId) notFound();
  const { month, year } = calc.payPeriod;
  const { start, end } = monthWindow(month, year);
  const incWin = cairoMonthWindow(month, year);

  const [incidents, officeHours, coveredFor, coveredBy, classes, live] = await Promise.all([
    prisma.lateIncident.findMany({
      where: { assistantId, deadline: { gte: incWin.start, lt: incWin.end } },
      orderBy: { deadline: "asc" },
      include: {
        session: { select: { scheduledDate: true, class: { select: { id: true, name: true } } } },
        homework: { select: { description: true, class: { select: { id: true, name: true } } } },
        quizPrep: { select: { quizDate: true, class: { select: { id: true, name: true } } } },
      },
    }),
    prisma.officeHourSession.findMany({
      where: { assistantId, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        approved: true,
        durationMin: true,
        student: { select: { name: true } },
        class: { select: { name: true } },
      },
    }),
    prisma.classSession.findMany({
      where: { coveredById: assistantId, scheduledDate: { gte: start, lt: end } },
      orderBy: { scheduledDate: "asc" },
      select: { id: true, scheduledDate: true, class: { select: { name: true } }, responsibleAssistant: { select: { name: true } } },
    }),
    prisma.classSession.findMany({
      where: {
        responsibleAssistantId: assistantId,
        coveredById: { not: null, notIn: [assistantId] },
        scheduledDate: { gte: start, lt: end },
      },
      orderBy: { scheduledDate: "asc" },
      select: { id: true, scheduledDate: true, class: { select: { name: true } }, coveredBy: { select: { name: true } } },
    }),
    paidClasses(assistantId, month, year),
    computePayComponents(assistantId, month, year),
  ]);

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
  const waived = incidents.filter((i) => i.waived);
  const sent = calc.status === "sent";
  // Stored payslip is stale if a fine was waived/added since the last recalculation.
  const stale = !sent && live.lateDeductions !== Number(calc.lateDeductions);

  const lines: { label: string; amount: number; note?: string }[] = [
    { label: `Base salary (${calc.classesCovered} class${calc.classesCovered === 1 ? "" : "es"})`, amount: Number(calc.baseSalary) },
    { label: "Late deductions", amount: -Number(calc.lateDeductions) },
    { label: "School vacation", amount: -Number(calc.vacationDeduction) },
    { label: "Office-hour bonus", amount: Number(calc.officeHoursBonus) },
    { label: "Coverage", amount: Number(calc.coverageAdjustment) },
    { label: "Manual adjustment", amount: Number(calc.manualAdjustment), note: calc.adjustmentNote ?? undefined },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/pay/${periodId}`} className="link text-sm">← {MONTHS[month - 1]} {year} pay</Link>
        <h1 className="page-title mt-1">{calc.assistant.name}</h1>
        <p className="page-subtitle">
          {MONTHS[month - 1]} {year} · {egp(calc.total)} EGP · <span className="capitalize">{calc.status}</span>
          {" · "}
          <a href={`/api/payslip/${calc.id}`} target="_blank" rel="noopener noreferrer" className="link">Payslip PDF</a>
        </p>
      </div>

      {stale && (
        <div className="card flex flex-wrap items-center gap-3 border-warn bg-warn-soft px-5 py-3 text-sm">
          <span className="text-warn">
            Fines changed since the last calculation: deductions are now {egp(live.lateDeductions)} EGP (payslip shows{" "}
            {egp(calc.lateDeductions)}).
          </span>
          <form action={recalcPayPeriod.bind(null, periodId)} className="ml-auto">
            <button type="submit" className="btn-secondary btn-sm">Recalculate</button>
          </form>
        </div>
      )}

      <Section title="Breakdown">
        <ul className="divide-y divide-border text-sm">
          {lines
            .filter((l) => l.amount !== 0 || l.label.startsWith("Base"))
            .map((l) => (
              <li key={l.label} className="flex items-center gap-3 px-5 py-2">
                <span className="flex-1">
                  {l.label}
                  {l.note && <span className="block text-xs text-faint">{l.note}</span>}
                </span>
                <span className={`tabular-nums ${l.amount < 0 ? "text-danger" : l.amount > 0 && !l.label.startsWith("Base") ? "text-success" : ""}`}>
                  {l.amount < 0 ? "−" : l.label.startsWith("Base") ? "" : "+"}
                  {egp(Math.abs(l.amount))}
                </span>
              </li>
            ))}
          <li className="flex items-center gap-3 bg-card-muted px-5 py-2 font-semibold">
            <span className="flex-1">Total</span>
            <span className="tabular-nums">{egp(calc.total)} EGP</span>
          </li>
        </ul>
        {classes.length > 0 && (
          <p className="border-t border-border px-5 py-2.5 text-xs text-muted">
            Classes:{" "}
            {classes
              .map((c) => (c.days < c.monthDays ? `${c.name} (${c.days}/${c.monthDays} days)` : c.name))
              .join(" · ")}
          </p>
        )}
      </Section>

      <Section
        title={`Missed tasks (${incidents.length})`}
        hint={`${incidents.length - waived.length} charged · ${waived.length} waived. A day's daily tasks (or one quiz's tasks) are charged once.`}
      >
        {incidents.length === 0 ? (
          <p className="px-5 py-5 text-sm text-muted">No missed deadlines this month. 🎉</p>
        ) : (
          <ul className="divide-y divide-border">
            {incidents.map((i) => {
              const cls = i.session?.class ?? i.homework?.class ?? i.quizPrep?.class;
              const what = i.session
                ? `lesson of ${dayFmt.format(i.session.scheduledDate)}`
                : i.homework
                  ? i.homework.description?.trim() || "homework"
                  : i.quizPrep
                    ? `quiz on ${dayFmt.format(i.quizPrep.quizDate)}`
                    : null;
              const c = charge.get(i.id) ?? 0;
              return (
                <li key={i.id} className={`px-5 py-3 text-sm ${i.waived ? "bg-card-muted" : ""}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="w-28 shrink-0 font-medium tabular-nums">{formatCairo(i.deadline, "EEE d MMM")}</span>
                    <span className="badge-brand">{INCIDENT_LABEL[i.type]}</span>
                    {cls && <Link href={`/classes/${cls.id}`} className="link">{cls.name}</Link>}
                    {what && <span className="text-muted">{what}</span>}
                    <span className="ml-auto">
                      {i.waived ? (
                        <span className="badge-neutral">Waived</span>
                      ) : c > 0 ? (
                        <span className="badge-danger">−{c} EGP</span>
                      ) : (
                        <span className="badge-neutral" title="Grouped tasks are charged once">included in cap</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                    <span>
                      Due {formatCairo(i.deadline, "h:mm a")} ·{" "}
                      {i.actualTime ? `done late ${formatCairo(i.actualTime, "EEE d MMM, h:mm a")}` : "not done by the deadline"}
                    </span>
                    {i.waived && (
                      <span className="font-medium text-fg">
                        Reason: {i.waiveReason ? i.waiveReason : <span className="italic text-faint">none given</span>}
                      </span>
                    )}
                    {!i.waived && i.confirmedAt && <span className="text-success">✓ Confirmed</span>}
                    {!sent && (
                      <span className="ml-auto flex items-center gap-2">
                        {i.waived ? (
                          <form action={unwaiveIncident.bind(null, i.id)}>
                            <button type="submit" className="link">Un-waive</button>
                          </form>
                        ) : (
                          <>
                            {!i.confirmedAt && (
                              <form action={confirmIncidents.bind(null, [i.id])}>
                                <button type="submit" className="link">Confirm</button>
                              </form>
                            )}
                            <form action={waiveIncident.bind(null, i.id)} className="flex items-center gap-1.5">
                              <input name="reason" placeholder="reason" className="input !w-32 !py-1 text-xs" />
                              <button type="submit" className="btn-secondary btn-sm">Waive</button>
                            </form>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {officeHours.length > 0 && (
        <Section title={`Office hours (${officeHours.length})`} hint="Only approved sessions earn the bonus.">
          <ul className="divide-y divide-border">
            {officeHours.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <span className="w-28 shrink-0 tabular-nums text-muted">{dayFmt.format(o.date)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {o.student.name} <span className="text-faint">· {o.class.name}</span>
                </span>
                {o.durationMin != null && <span className="text-xs text-faint">{o.durationMin} min</span>}
                <span className={o.approved ? "badge-success" : "badge-neutral"}>{o.approved ? "Approved" : "Not approved"}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(coveredFor.length > 0 || coveredBy.length > 0) && (
        <Section title="Coverage">
          <ul className="divide-y divide-border">
            {coveredFor.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <span className="w-28 shrink-0 tabular-nums text-muted">{dayFmt.format(s.scheduledDate)}</span>
                <span className="flex-1">
                  Covered {s.responsibleAssistant?.name ?? "a colleague"} · {s.class.name}
                </span>
                <span className="text-success">+</span>
              </li>
            ))}
            {coveredBy.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                <span className="w-28 shrink-0 tabular-nums text-muted">{dayFmt.format(s.scheduledDate)}</span>
                <span className="flex-1">
                  Covered by {s.coveredBy?.name ?? "a colleague"} · {s.class.name}
                </span>
                <span className="text-danger">−</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
