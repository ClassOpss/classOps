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
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-sm text-black/50 dark:text-white/50">{label}</p>
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
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active classes" value={activeClasses} />
        <StatCard label="Active assistants" value={activeAssistants} />
        <StatCard label="Sessions this month (delivered / planned)" value={`${delivered} / ${planned}`} />
        {isAdmin && <StatCard label="Open late incidents" value={openIncidentCount} />}
      </div>

      {isAdmin && coverages.length > 0 && (
        <section>
          <h2 className="mb-1 font-medium">Coverage to confirm</h2>
          <p className="mb-3 text-sm text-black/50 dark:text-white/50">
            Someone logged a session that wasn&apos;t theirs — confirm to move ±50 EGP.
          </p>
          <ul className="flex flex-col gap-1">
            {coverages.map((c) => (
              <li
                key={c.sessionId}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/5 py-2 text-sm dark:border-white/5"
              >
                <span>
                  <span className="font-medium">{c.covererName}</span> covered{" "}
                  <span className="font-medium">{c.ownerName}</span>
                </span>
                <Link href={`/classes/${c.classId}`} className="text-blue-600 hover:underline">
                  {c.className}
                </Link>
                <span className="text-black/40">{formatCairo(c.date, "d MMM")}</span>
                <form action={confirmCoverage.bind(null, c.sessionId, c.covererId)} className="ml-auto">
                  <button type="submit" className="text-blue-600 hover:underline">
                    Confirm (+50 / −50)
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && (
        <section>
          <h2 className="mb-1 font-medium">Late incidents</h2>
          <p className="mb-3 text-sm text-black/50 dark:text-white/50">
            {outstanding.length} unwaived · {dueTotal} EGP in deductions
          </p>
          {incidents.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">None — everyone&apos;s on time.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {incidents.map((i) => (
                <li
                  key={i.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-black/5 py-2 text-sm dark:border-white/5 ${
                    i.waived ? "text-black/40" : ""
                  }`}
                >
                  <span className="font-medium">{i.assistant.name}</span>
                  <span>{INCIDENT_LABEL[i.type]}</span>
                  {i.session?.class ? (
                    <Link href={`/classes/${i.session.class.id}`} className="text-blue-600 hover:underline">
                      {i.session.class.name}
                    </Link>
                  ) : null}
                  <span className="text-black/40">{formatCairo(i.deadline, "d MMM, h:mm a")}</span>
                  <span className={i.waived ? "" : "text-red-600"}>
                    {i.waived ? `Waived${i.waiveReason ? ` · ${i.waiveReason}` : ""}` : `-${Number(i.deductionAmount)} EGP`}
                  </span>
                  <span className="ml-auto">
                    {i.waived ? (
                      <form action={unwaiveIncident.bind(null, i.id)}>
                        <button type="submit" className="text-blue-600 hover:underline">Un-waive</button>
                      </form>
                    ) : (
                      <form action={waiveIncident.bind(null, i.id)} className="flex items-center gap-1">
                        <input
                          name="reason"
                          placeholder="reason"
                          className="w-28 rounded-md border border-black/15 bg-white px-2 py-1 text-xs outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent"
                        />
                        <button type="submit" className="text-blue-600 hover:underline">Waive</button>
                      </form>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 font-medium">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex justify-between border-b border-black/5 py-1 dark:border-white/5">
                <span>
                  <span className="capitalize text-black/50 dark:text-white/50">{a.actorRole}</span>{" "}
                  {a.action.replace(/_/g, " ")}
                </span>
                <span className="text-black/40">{formatCairo(a.createdAt, "d MMM, h:mm a")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
