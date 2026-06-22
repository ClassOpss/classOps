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
      <h1 className="text-xl font-semibold">Pay</h1>

      <section className="rounded-md border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">Open a pay period</h2>
        <CreatePeriodForm defaultMonth={now.getUTCMonth() + 1} defaultYear={now.getUTCFullYear()} />
      </section>

      <section>
        <h2 className="mb-3 font-medium">Pay periods ({periods.length})</h2>
        {periods.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">None yet.</p>
        ) : (
          <table className="w-full max-w-xl text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="py-2">Period</th>
                <th className="py-2">Assistants</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">
                    <Link href={`/pay/${p.id}`} className="text-blue-600 hover:underline">
                      {MONTHS[p.month - 1]} {p.year}
                    </Link>
                  </td>
                  <td className="py-2">{p._count.calculations}</td>
                  <td className="py-2 capitalize">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
