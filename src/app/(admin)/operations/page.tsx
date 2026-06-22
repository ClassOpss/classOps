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
        <h1 className="text-xl font-semibold">Operations</h1>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          Each teacher is one operation. Switch to scope the whole admin area (classes, pay,
          insights) to that teacher&apos;s data.
        </p>
      </div>

      <section>
        <h2 className="mb-3 font-medium">All operations ({operations.length})</h2>
        <table className="w-full max-w-2xl text-left text-sm">
          <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
            <tr>
              <th className="py-2">Operation</th>
              <th className="py-2">Classes</th>
              <th className="py-2">Assistants</th>
              <th className="py-2">People</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {operations.map((o) => {
              const isActive = o.id === activeId;
              return (
                <tr key={o.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 font-medium">
                    {o.name}
                    {isActive && <span className="ml-2 text-xs text-green-600">● active</span>}
                  </td>
                  <td className="py-2">{o._count.classes}</td>
                  <td className="py-2">{o._count.assistants}</td>
                  <td className="py-2">{o._count.users}</td>
                  <td className="py-2">
                    {isActive ? (
                      <span className="text-black/40">Current view</span>
                    ) : (
                      <form action={setActiveOperation.bind(null, o.id)}>
                        <button type="submit" className="text-blue-600 hover:underline">
                          Switch to this
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="rounded-md border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">Onboard a new teacher</h2>
        <NewOperationForm defaults={OPERATION_DEFAULTS} />
      </section>
    </div>
  );
}
