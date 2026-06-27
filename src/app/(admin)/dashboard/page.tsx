import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { formatCairo } from "@/lib/datetime";
import { waiveIncident, unwaiveIncident } from "@/actions/incidents";
import { detectCoverageCandidates } from "@/lib/coverage";
import { confirmCoverage } from "@/actions/coverage";
import { currentOperationId } from "@/lib/operation";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

const INCIDENT_LABEL: Record<string, string> = {
  attendance: "Attendance",
  parent_update: "Parent update",
  classroom_upload: "Classroom upload",
  hw_correction: "HW correction",
  grade_entry: "Grade entry",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-3xl font-semibold tracking-tight text-fg">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
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
        ? prisma.lateIncident.count({ where: { waived: false, assistant: { operationId } } })
        : Promise.resolve(0),
      prisma.activityLog.findMany({
        where: { operationId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, actorRole: true, action: true, createdAt: true },
      }),
    ]);

  const incidents = isAdmin
    ? await prisma.lateIncident.findMany({
        where: { assistant: { operationId } },
        orderBy: { createdAt: "desc" },
        take: 60,
        include: {
          assistant: { select: { name: true } },
          session: { select: { class: { select: { id: true, name: true } } } },
        },
      })
    : [];
  const outstanding = incidents.filter((i) => !i.waived);
  const dueTotal = outstanding.reduce((sum, i) => sum + Number(i.deductionAmount), 0);
  const coverages = isAdmin ? await detectCoverageCandidates(operationId) : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Operations overview and recent activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active classes" value={activeClasses} />
        <StatCard label="Active assistants" value={activeAssistants} />
        <StatCard label="Sessions this month (delivered / planned)" value={`${delivered} / ${planned}`} />
        {isAdmin && <StatCard label="Open late incidents" value={openIncidentCount} />}
      </div>

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

      {isAdmin && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h2 className="section-title">Late incidents</h2>
              <p className="mt-0.5 text-sm text-muted">
                {outstanding.length} unwaived · {dueTotal} EGP in deductions
              </p>
            </div>
          </div>
          {incidents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">None — everyone&apos;s on time.</p>
          ) : (
            <ul className="divide-y divide-border">
              {incidents.map((i) => (
                <li
                  key={i.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-sm ${i.waived ? "opacity-60" : ""}`}
                >
                  <span className="font-medium">{i.assistant.name}</span>
                  <span className="badge-neutral">{INCIDENT_LABEL[i.type]}</span>
                  {i.session?.class ? (
                    <Link href={`/classes/${i.session.class.id}`} className="link">{i.session.class.name}</Link>
                  ) : null}
                  <span className="text-faint">{formatCairo(i.deadline, "d MMM, h:mm a")}</span>
                  {i.waived ? (
                    <span className="badge-neutral">Waived{i.waiveReason ? ` · ${i.waiveReason}` : ""}</span>
                  ) : (
                    <span className="badge-danger">−{Number(i.deductionAmount)} EGP</span>
                  )}
                  <span className="ml-auto">
                    {i.waived ? (
                      <form action={unwaiveIncident.bind(null, i.id)}>
                        <button type="submit" className="link">Un-waive</button>
                      </form>
                    ) : (
                      <form action={waiveIncident.bind(null, i.id)} className="flex items-center gap-2">
                        <input name="reason" placeholder="reason" className="input !w-32 !py-1.5 text-xs" />
                        <button type="submit" className="btn-secondary btn-sm">Waive</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
