import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { OPERATION_DEFAULTS } from "@/lib/config";
import { setActiveOperation } from "@/actions/operations";
import { NewOperationForm } from "./new-operation-form";

export default async function OperationsPage() {
  await requireRole("admin");
  const activeId = await currentOperationId();

  const operations = await prisma.operation.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      active: true,
      _count: { select: { classes: true, assistants: true, users: true } },
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Operations</h1>
        <p className="page-subtitle">
          Each teacher is one operation. Switch to scope the whole admin area (classes, pay,
          insights) to that teacher&apos;s data.
        </p>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">All operations ({operations.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Classes</th>
                <th>Assistants</th>
                <th>People</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {operations.map((o) => {
                const isActive = o.id === activeId;
                return (
                  <tr key={o.id}>
                    <td>
                      <span className="font-medium">{o.name}</span>
                      {isActive && <span className="badge-success ml-2">Active</span>}
                    </td>
                    <td>{o._count.classes}</td>
                    <td>{o._count.assistants}</td>
                    <td>{o._count.users}</td>
                    <td>
                      {isActive ? (
                        <span className="text-faint">Current view</span>
                      ) : (
                        <form action={setActiveOperation.bind(null, o.id)}>
                          <button type="submit" className="btn-secondary btn-sm">Switch to this</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="section-title mb-1">Onboard a new teacher</h2>
        <p className="mb-5 text-sm text-muted">Creates the operation, its config, and a teacher invite link.</p>
        <NewOperationForm defaults={OPERATION_DEFAULTS} />
      </section>
    </div>
  );
}
