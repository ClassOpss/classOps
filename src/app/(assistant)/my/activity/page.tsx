import { requireRole, requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { formatCairo } from "@/lib/datetime";

export default async function MyActivityPage() {
  await requireRole("assistant", "admin");
  const user = await requireUser();

  const items = await prisma.activityLog.findMany({
    where: { actorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, action: true, createdAt: true },
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="page-title">Activity</h1>
        <p className="page-subtitle">Everything you&apos;ve logged, most recent first.</p>
      </div>
      <section className="card overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="capitalize text-fg">{a.action.replace(/_/g, " ")}</span>
                <span className="shrink-0 text-faint">{formatCairo(a.createdAt, "d MMM, h:mm a")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
