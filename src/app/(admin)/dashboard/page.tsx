import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { formatCairo } from "@/lib/datetime";
import { detectCoverageCandidates } from "@/lib/coverage";
import { detectAtRiskStudents } from "@/lib/at-risk";
import { confirmCoverage } from "@/actions/coverage";
import { approveOfficeHour, rejectOfficeHour } from "@/actions/office-hours";
import { currentOperationId } from "@/lib/operation";
import { cairoMonthWindow } from "@/lib/datetime";
import { IncidentsPanel, type IncidentFilters } from "./incidents-panel";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-3xl font-semibold tracking-tight text-fg">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<IncidentFilters>;
}) {
  const sp = await searchParams;
  const user = await requireRole("admin", "teacher");
  const isAdmin = user.role === "admin";
  const operationId = await currentOperationId();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  const [activeClasses, activeAssistants, planned, delivered, openIncidentCount, activity] =
    await Promise.all([
      prisma.class.count({ where: { active: true, operationId } }),
      prisma.assistant.count({ where: { active: true, operationId, user: { active: true } } }),
      prisma.classSession.count({
        where: { dayOff: false, scheduledDate: { gte: monthStart, lt: monthEnd }, class: { active: true, operationId } },
      }),
      prisma.classSession.count({
        where: { dayOff: false, scheduledDate: { gte: monthStart, lt: todayEnd }, class: { active: true, operationId } },
      }),
      isAdmin
        ? (() => {
            // This Cairo month only — earlier months are billed on their own payslips.
            const w = cairoMonthWindow(Number(formatCairo(now, "M")), Number(formatCairo(now, "yyyy")));
            return prisma.lateIncident.count({
              where: { waived: false, confirmedAt: null, assistant: { operationId }, deadline: { gte: w.start, lt: w.end } },
            });
          })()
        : Promise.resolve(0),
      prisma.activityLog.findMany({
        where: { operationId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, actorRole: true, action: true, createdAt: true },
      }),
    ]);

  const coverages = isAdmin ? await detectCoverageCandidates(operationId) : [];
  const atRisk = await detectAtRiskStudents(operationId);
  const pendingOfficeHours = isAdmin
    ? await prisma.officeHourSession.findMany({
        where: { approved: false, assistant: { operationId } },
        orderBy: { date: "desc" },
        take: 40,
        select: {
          id: true,
          date: true,
          topicNotes: true,
          durationMin: true,
          assistant: { select: { name: true } },
          student: { select: { name: true } },
          class: { select: { id: true, name: true } },
        },
      })
    : [];

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const curMonth = now.getUTCMonth() + 1;
  const curYear = now.getUTCFullYear();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Operations overview and recent activity.</p>
        </div>
        <form action="/api/reports/operation" method="get" target="_blank" className="flex items-end gap-2">
          <select name="month" defaultValue={curMonth} className="input !w-auto !py-1.5 text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select name="year" defaultValue={curYear} className="input !w-auto !py-1.5 text-sm">
            {[curYear - 1, curYear].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="submit" className="btn-primary btn-sm">Operation report (PDF)</button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active classes" value={activeClasses} />
        <StatCard label="Active assistants" value={activeAssistants} />
        <StatCard label="Sessions this month (delivered / planned)" value={`${delivered} / ${planned}`} />
        {isAdmin && <StatCard label="Late fines to review (this month)" value={openIncidentCount} />}
      </div>

      {atRisk.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="section-title">Needs attention ({atRisk.length})</h2>
            <p className="mt-0.5 text-sm text-muted">
              Students averaging under 50% or submitting under half their homework. Low attendance is noted, not counted.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {atRisk.slice(0, 12).map((st) => (
              <li key={st.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-sm">
                <span className="font-medium">{st.name}</span>
                <Link href={`/classes/${st.classId}`} className="link">{st.className}</Link>
                <span className="ml-auto flex flex-wrap gap-1.5">
                  {st.reasons.map((r) => (
                    <span key={r} className="badge-danger">{r}</span>
                  ))}
                  {st.flags.map((f) => (
                    <span key={f} className="badge-warn">{f}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {atRisk.length > 12 && (
            <p className="px-5 py-2 text-xs text-faint">+ {atRisk.length - 12} more</p>
          )}
        </section>
      )}

      {isAdmin && pendingOfficeHours.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="section-title">Office hours to approve ({pendingOfficeHours.length})</h2>
            <p className="mt-0.5 text-sm text-muted">
              Approve to count the bonus toward pay, or reject to remove it.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {pendingOfficeHours.map((oh) => (
              <li key={oh.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-sm">
                <span className="font-medium">{oh.assistant.name}</span>
                <span className="text-muted">with {oh.student.name}</span>
                <Link href={`/classes/${oh.class.id}`} className="link">{oh.class.name}</Link>
                <span className="text-faint">{formatCairo(oh.date, "d MMM")}</span>
                {oh.durationMin ? <span className="badge-neutral">{oh.durationMin} min</span> : null}
                {oh.topicNotes ? <span className="text-muted">· {oh.topicNotes}</span> : null}
                <span className="ml-auto flex items-center gap-3">
                  <form action={approveOfficeHour.bind(null, oh.id)}>
                    <button type="submit" className="text-success hover:underline">Approve</button>
                  </form>
                  <form action={rejectOfficeHour.bind(null, oh.id)}>
                    <button type="submit" className="text-danger hover:underline">Reject</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && coverages.length > 0 && (
        <section className="card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="section-title">Coverage to confirm</h2>
            <p className="mt-0.5 text-sm text-muted">
              Someone logged a session that wasn&apos;t theirs — confirm to move ±50 EGP.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {coverages.map((c) => (
              <li key={c.sessionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium">{c.covererName}</span>{" "}
                  <span className="text-muted">covered</span>{" "}
                  <span className="font-medium">{c.ownerName}</span>
                </span>
                <Link href={`/classes/${c.classId}`} className="link">{c.className}</Link>
                <span className="text-faint">{formatCairo(c.date, "d MMM")}</span>
                <form action={confirmCoverage.bind(null, c.sessionId, c.covererId)} className="ml-auto">
                  <button type="submit" className="btn-secondary btn-sm">Confirm (+50 / −50)</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && <IncidentsPanel operationId={operationId} sp={sp} />}

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Recent activity</h2>
        </div>
        {activity.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span>
                  <span className="badge-neutral mr-2 capitalize">{a.actorRole}</span>
                  <span className="text-fg">{a.action.replace(/_/g, " ")}</span>
                </span>
                <span className="text-faint">{formatCairo(a.createdAt, "d MMM, h:mm a")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
