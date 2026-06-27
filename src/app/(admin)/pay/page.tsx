import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { CreatePeriodForm } from "./create-period-form";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function PayPage() {
  await requireRole("admin");
  const operationId = await currentOperationId();

  const periods = await prisma.payPeriod.findMany({
    where: { operationId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: { _count: { select: { calculations: true } } },
  });

  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">Pay</h1>
        <p className="page-subtitle">Open monthly periods and review each assistant&apos;s pay.</p>
      </div>

      <section className="card p-5">
        <h2 className="section-title mb-3">Open a pay period</h2>
        <CreatePeriodForm defaultMonth={now.getUTCMonth() + 1} defaultYear={now.getUTCFullYear()} />
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Pay periods ({periods.length})</h2>
        </div>
        {periods.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">None yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Assistants</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/pay/${p.id}`} className="link">
                      {MONTHS[p.month - 1]} {p.year}
                    </Link>
                  </td>
                  <td>{p._count.calculations}</td>
                  <td>
                    <span className={p.status === "sent" ? "badge-success" : "badge-neutral"}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
