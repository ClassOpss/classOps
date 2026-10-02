import Link from "next/link";
import type { IncidentType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cairoDayWindow, cairoMonthWindow, formatCairo } from "@/lib/datetime";
import { waiveIncident, unwaiveIncident, confirmIncidents, unconfirmIncident } from "@/actions/incidents";
import { effectiveDeductionTotal, perIncidentCharge } from "@/lib/incident-deductions";

export const INCIDENT_LABEL: Record<IncidentType, string> = {
  attendance: "Attendance",
  parent_update: "Parent update",
  classroom_upload: "Classroom upload",
  hw_correction: "HW correction",
  grade_entry: "Grade entry",
  quiz_prep: "Quiz prep",
  quiz_announcement: "Quiz announcement",
  monthly_report: "Monthly reports",
};
const TASK_ORDER = Object.keys(INCIDENT_LABEL) as IncidentType[];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type IncidentFilters = {
  im?: string; // month 1-12
  iy?: string; // year
  task?: string;
  who?: string; // assistantId
  day?: string; // yyyy-mm-dd (Cairo)
  status?: string; // review (default) | confirmed | waived | all
};

type Status = "review" | "confirmed" | "waived" | "all";
const STATUS_LABEL: Record<Status, string> = {
  review: "To review",
  confirmed: "Confirmed",
  waived: "Waived",
  all: "All",
};
type Row = { waived: boolean; confirmedAt: Date | null };
const rowStatus = (i: Row): Exclude<Status, "all"> =>
  i.waived ? "waived" : i.confirmedAt ? "confirmed" : "review";

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-brand bg-brand text-brand-fg"
          : "border-border-strong bg-card text-muted hover:bg-card-muted hover:text-fg"
      }`}
    >
      {children}
    </Link>
  );
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span className={`rounded-full px-1.5 text-[0.68rem] ${active ? "bg-white/20" : "bg-card-muted text-faint"}`}>
      {n}
    </span>
  );
}

// Late incidents, scoped to ONE Cairo month (the same window the payslip uses), with
// assistant / task / day / status filters driven by the URL so views are linkable.
export async function IncidentsPanel({
  operationId,
  sp,
}: {
  operationId: string;
  sp: IncidentFilters;
}) {
  const now = new Date();
  const curMonth = Number(formatCairo(now, "M"));
  const curYear = Number(formatCairo(now, "yyyy"));
  const month = Number(sp.im) >= 1 && Number(sp.im) <= 12 ? Number(sp.im) : curMonth;
  const year = Number(sp.iy) >= 2024 && Number(sp.iy) <= 2100 ? Number(sp.iy) : curYear;
  const status: Status =
    sp.status === "confirmed" || sp.status === "waived" || sp.status === "all" ? sp.status : "review";
  const task = sp.task && sp.task in INCIDENT_LABEL ? (sp.task as IncidentType) : null;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : null;
  const who = sp.who || null;

  const href = (o: Partial<Record<keyof IncidentFilters, string | null>>) => {
    const base: Record<string, string | null> = {
      im: String(month),
      iy: String(year),
      task,
      who,
      day,
      status: status === "review" ? null : status,
    };
    const merged = { ...base, ...o };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    return `/dashboard?${qs.toString()}#incidents`;
  };

  const prev = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
  const next = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };
  const isCurrent = month === curMonth && year === curYear;
  const isFuture = year > curYear || (year === curYear && month > curMonth);

  const win = cairoMonthWindow(month, year);
  const [monthIncidents, period] = await Promise.all([
    prisma.lateIncident.findMany({
      where: { assistant: { operationId }, deadline: { gte: win.start, lt: win.end } },
      orderBy: { deadline: "desc" },
      include: {
        assistant: { select: { id: true, name: true } },
        session: { select: { class: { select: { id: true, name: true } } } },
        quizPrep: { select: { class: { select: { id: true, name: true } } } },
      },
    }),
    prisma.payPeriod.findUnique({
      where: { operationId_month_year: { operationId, month, year } },
      select: {
        id: true,
        status: true,
        calculations: { select: { assistantId: true, status: true, sentAt: true } },
      },
    }),
  ]);

  // Charges are computed over the WHOLE month (caps group a session-day / quiz), then filtered.
  const deductible = monthIncidents.map((i) => ({
    id: i.id,
    assistantId: i.assistantId,
    sessionId: i.sessionId,
    quizPrepId: i.quizPrepId,
    type: i.type,
    deductionAmount: Number(i.deductionAmount),
    waived: i.waived,
  }));
  const rowCharge = perIncidentCharge(deductible);
  const sentFor = new Map(
    (period?.calculations ?? []).filter((c) => c.status === "sent").map((c) => [c.assistantId, c.sentAt]),
  );

  // Per-assistant summary (always over the month, ignoring other filters).
  const byAssistant = new Map<string, { name: string; review: number; egp: number }>();
  for (const i of monthIncidents) {
    const a = byAssistant.get(i.assistantId) ?? { name: i.assistant.name, review: 0, egp: 0 };
    if (rowStatus(i) === "review") a.review++;
    byAssistant.set(i.assistantId, a);
  }
  for (const [id, a] of byAssistant) {
    a.egp = effectiveDeductionTotal(deductible.filter((d) => d.assistantId === id));
  }
  const assistants = [...byAssistant.entries()].sort((x, y) => y[1].egp - x[1].egp || x[1].name.localeCompare(y[1].name));

  const matchStatus = (i: Row) => status === "all" || rowStatus(i) === status;
  const dayKey = (d: Date) => formatCairo(d, "yyyy-MM-dd");
  // Each filter's counts respect the OTHER filters, so chips show what clicking would give.
  const base = monthIncidents.filter((i) => !who || i.assistantId === who);
  const taskCounts = new Map<IncidentType, number>();
  for (const i of base) {
    if (!matchStatus(i) || (day && dayKey(i.deadline) !== day)) continue;
    taskCounts.set(i.type, (taskCounts.get(i.type) ?? 0) + 1);
  }
  const dayCounts = new Map<string, number>();
  for (const i of base) {
    if (!matchStatus(i) || (task && i.type !== task)) continue;
    const k = dayKey(i.deadline);
    dayCounts.set(k, (dayCounts.get(k) ?? 0) + 1);
  }
  const statusCounts = { review: 0, confirmed: 0, waived: 0, all: 0 };
  for (const i of base) {
    if ((task && i.type !== task) || (day && dayKey(i.deadline) !== day)) continue;
    statusCounts.all++;
    statusCounts[rowStatus(i)]++;
  }

  const shown = base.filter(
    (i) => matchStatus(i) && (!task || i.type === task) && (!day || dayKey(i.deadline) === day),
  );
  const reviewIds = shown.filter((i) => rowStatus(i) === "review").map((i) => i.id);
  const shownEgp =shown.reduce((s, i) => s + (rowCharge.get(i.id) ?? 0), 0);

  const groups = new Map<string, typeof shown>();
  for (const i of shown) {
    const k = dayKey(i.deadline);
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }

  const monthName = MONTHS[month - 1];
  const anyFilter = !!(task || who || day || status !== "review");
  const whoName = who ? byAssistant.get(who)?.name : null;
  const allSent =
    !!period &&
    period.calculations.length > 0 &&
    period.calculations.every((c) => c.status === "sent") &&
    assistants.every(([id]) => sentFor.has(id));

  return (
    <section id="incidents" className="card scroll-mt-4 overflow-hidden">
      {/* Header: month switcher + where these fines are billed */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="section-title">Late incidents</h2>
          <p className="mt-0.5 text-sm text-muted">
            Each fine belongs to the month its deadline fell in — it&apos;s billed once, on that month&apos;s payslip.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={href({ im: String(prev.m), iy: String(prev.y), day: null })} scroll={false} className="btn-ghost btn-sm" aria-label="Previous month">
            ‹
          </Link>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold text-fg">
            {monthName} {year}
          </span>
          <Link href={href({ im: String(next.m), iy: String(next.y), day: null })} scroll={false} className="btn-ghost btn-sm" aria-label="Next month">
            ›
          </Link>
          {!isCurrent && (
            <Link href={href({ im: String(curMonth), iy: String(curYear), day: null })} scroll={false} className="link ml-2 text-xs">
              This month
            </Link>
          )}
        </div>
      </div>

      {/* Payslip banner */}
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-5 py-2.5 text-sm ${
          allSent ? "bg-success-soft" : "bg-card-muted"
        }`}
      >
        {allSent ? (
          <span className="text-success">
            🔒 <span className="font-medium">{monthName} payslips are sent</span> — these fines are closed and
            can&apos;t affect any other month. Waiving now won&apos;t change a sent payslip (use a manual adjustment).
          </span>
        ) : period ? (
          <span className="text-muted">
            Billed on the <span className="font-medium text-fg">{monthName} payslip</span> ({period.status}
            {sentFor.size > 0 ? `, ${sentFor.size} sent` : ""}).{" "}
            <Link href={`/pay/${period.id}`} className="link">Open pay period</Link> — press Recalculate after waiving.
          </span>
        ) : (
          <span className="text-muted">
            {isFuture ? "Nothing billed yet." : (
              <>
                Will be billed on the <span className="font-medium text-fg">{monthName} payslip</span> (not created yet).
              </>
            )}
          </span>
        )}
      </div>

      {/* Per-assistant summary — click to filter */}
      {assistants.length > 0 && (
        <div className="grid gap-2 border-b border-border px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {assistants.map(([id, a]) => {
            const active = who === id;
            const locked = sentFor.has(id);
            return (
              <Link
                key={id}
                href={href({ who: active ? null : id })}
                scroll={false}
                className={`rounded-lg border px-3 py-2.5 transition-colors ${
                  active ? "border-brand bg-brand-soft" : "border-border hover:bg-card-muted"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-fg">{a.name}</span>
                  {locked && <span className="badge-success" title="Payslip sent">🔒 sent</span>}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-lg font-semibold ${a.egp > 0 ? "text-danger" : "text-success"}`}>
                    {a.egp > 0 ? `−${a.egp}` : "0"} <span className="text-xs font-normal">EGP</span>
                  </span>
                  <span className={`text-xs ${a.review > 0 ? "font-medium text-warn" : "text-faint"}`}>
                    {a.review > 0 ? `${a.review} to review` : "✓ reviewed"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Filters */}
      {monthIncidents.length > 0 && (
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1 w-12">Show</span>
            {(["review", "confirmed", "waived", "all"] as const).map((s) => (
              <Chip key={s} href={href({ status: s === "review" ? null : s })} active={status === s}>
                {STATUS_LABEL[s]}
                <Count n={statusCounts[s]} active={status === s} />
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1 w-12">Task</span>
            <Chip href={href({ task: null })} active={!task}>All tasks</Chip>
            {TASK_ORDER.filter((t) => taskCounts.has(t) || t === task).map((t) => (
              <Chip key={t} href={href({ task: task === t ? null : t })} active={task === t}>
                {INCIDENT_LABEL[t]}
                <Count n={taskCounts.get(t) ?? 0} active={task === t} />
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="eyebrow mr-1 w-12">Day</span>
            <Chip href={href({ day: null })} active={!day}>All days</Chip>
            {[...dayCounts.keys()]
              .concat(day && !dayCounts.has(day) ? [day] : [])
              .sort()
              .map((d) => (
                <Chip key={d} href={href({ day: day === d ? null : d })} active={day === d}>
                  {formatCairo(cairoDayWindow(d).start, "EEE d")}
                  <Count n={dayCounts.get(d) ?? 0} active={day === d} />
                </Chip>
              ))}
          </div>
          {(anyFilter || reviewIds.length > 1) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
              {anyFilter && (
                <span>
                  Showing {shown.length} incident{shown.length === 1 ? "" : "s"}
                  {whoName ? ` for ${whoName}` : ""} · {shownEgp} EGP ·{" "}
                  <Link href={href({ task: null, who: null, day: null, status: null })} scroll={false} className="link">
                    Clear filters
                  </Link>
                </span>
              )}
              {reviewIds.length > 1 && (
                <form action={confirmIncidents.bind(null, reviewIds)} className="ml-auto">
                  <button type="submit" className="btn-primary btn-sm">
                    Confirm all {reviewIds.length} shown
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Day-grouped list */}
      {monthIncidents.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">No late incidents in {monthName} — everyone&apos;s on time. 🎉</p>
      ) : shown.length === 0 ? (
        status === "review" && !task && !day ? (
          <div className="px-5 py-8 text-center text-sm">
            <p className="font-medium text-success">✓ All caught up — every {monthName} fine{whoName ? ` for ${whoName}` : ""} is reviewed.</p>
            <p className="mt-1 text-muted">
              New fines will show up here. See{" "}
              <Link href={href({ status: "confirmed" })} scroll={false} className="link">confirmed</Link> or{" "}
              <Link href={href({ status: "waived" })} scroll={false} className="link">waived</Link>.
            </p>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-muted">Nothing matches these filters.</p>
        )
      ) : (
        <div>
          {[...groups.entries()].map(([d, rows]) => {
            const egp = rows.reduce((s, i) => s + (rowCharge.get(i.id) ?? 0), 0);
            return (
              <div key={d}>
                <div className="flex items-center justify-between bg-card-muted px-5 py-1.5 text-xs">
                  <span className="font-semibold text-fg">{formatCairo(cairoDayWindow(d).start, "EEEE d MMM")}</span>
                  <span className="text-muted">
                    {rows.length} incident{rows.length === 1 ? "" : "s"}
                    {egp > 0 ? ` · −${egp} EGP` : ""}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((i) => {
                    const cls = i.session?.class ?? i.quizPrep?.class;
                    const charge = rowCharge.get(i.id) ?? 0;
                    const locked = sentFor.has(i.assistantId);
                    return (
                      <li
                        key={i.id}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-2.5 text-sm ${i.waived ? "opacity-60" : ""}`}
                      >
                        {!who && <span className="w-32 truncate font-medium">{i.assistant.name}</span>}
                        <Link href={href({ task: i.type })} scroll={false} className="badge-brand hover:underline">
                          {INCIDENT_LABEL[i.type]}
                        </Link>
                        {cls ? <Link href={`/classes/${cls.id}`} className="link">{cls.name}</Link> : null}
                        <span className="text-faint">due {formatCairo(i.deadline, "h:mm a")}</span>
                        {i.waived ? (
                          <span className="badge-neutral">Waived{i.waiveReason ? ` · ${i.waiveReason}` : ""}</span>
                        ) : charge > 0 ? (
                          <span className="badge-danger">−{charge} EGP</span>
                        ) : (
                          <span className="badge-neutral" title="Grouped tasks (a session-day, or one quiz) are charged once">
                            included in cap
                          </span>
                        )}
                        <span className="ml-auto">
                          {locked ? (
                            <span className="flex items-center gap-2">
                              <span className="text-xs text-faint" title="This assistant's payslip for the month is sent">
                                🔒 payslip sent
                              </span>
                              {rowStatus(i) === "review" && (
                                <form action={confirmIncidents.bind(null, [i.id])}>
                                  <button type="submit" className="btn-primary btn-sm">Confirm</button>
                                </form>
                              )}
                            </span>
                          ) : i.waived ? (
                            <form action={unwaiveIncident.bind(null, i.id)}>
                              <button type="submit" className="link text-xs">Un-waive</button>
                            </form>
                          ) : i.confirmedAt ? (
                            <form action={unconfirmIncident.bind(null, i.id)} className="flex items-center gap-2">
                              <span className="badge-success" title={`Confirmed ${formatCairo(i.confirmedAt, "d MMM, h:mm a")}`}>
                                ✓ Confirmed
                              </span>
                              <button type="submit" className="link text-xs">Undo</button>
                            </form>
                          ) : (
                            <span className="flex items-center gap-2">
                              <form action={confirmIncidents.bind(null, [i.id])}>
                                <button type="submit" className="btn-primary btn-sm" title="The fine stands — it stays on the payslip and leaves this list">
                                  Confirm
                                </button>
                              </form>
                              <form action={waiveIncident.bind(null, i.id)} className="flex items-center gap-2">
                                <input name="reason" placeholder="reason" className="input !w-28 !py-1 text-xs" />
                                <button type="submit" className="btn-secondary btn-sm">Waive</button>
                              </form>
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
