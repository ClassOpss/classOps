import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { recalcPayPeriod, setAdjustment, approveCalc, sendCalc } from "@/actions/pay";
import { currentOperationId } from "@/lib/operation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const egp = (v: unknown) => `${Number(v).toLocaleString("en-US")}`;

export default async function PayPeriodPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  await requireRole("admin");
  const { periodId } = await params;

  const operationId = await currentOperationId();
  const period = await prisma.payPeriod.findUnique({
    where: { id: periodId },
    include: {
      calculations: {
        orderBy: { assistant: { name: "asc" } },
        include: { assistant: { select: { name: true } } },
      },
    },
  });
  if (!period || period.operationId !== operationId) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Pay period not found</h1>
        <Link href="/pay" className="text-sm text-blue-600 hover:underline">← Pay</Link>
      </div>
    );
  }

  const grandTotal = period.calculations.reduce((s, c) => s + Number(c.total), 0);
  const inputCls =
    "rounded-md border border-black/15 bg-white px-2 py-1 text-xs outline-none focus:border-black/40 dark:border-white/20 dark:bg-transparent";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pay" className="text-sm text-blue-600 hover:underline">← Pay</Link>
        <h1 className="mt-1 text-xl font-semibold">
          {MONTHS[period.month - 1]} {period.year}
        </h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {period.calculations.length} assistants · {egp(grandTotal)} EGP total · {period.status}
        </p>
      </div>

      <form action={recalcPayPeriod.bind(null, periodId)}>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Recalculate (refresh after waiving incidents)
        </button>
      </form>

      {period.calculations.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No assistants.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 text-black/50 dark:border-white/10 dark:text-white/50">
              <tr>
                <th className="py-2 pr-3">Assistant</th>
                <th className="py-2 pr-3">Classes</th>
                <th className="py-2 pr-3">Base</th>
                <th className="py-2 pr-3">Deductions</th>
                <th className="py-2 pr-3">Office hrs</th>
                <th className="py-2 pr-3">Coverage</th>
                <th className="py-2 pr-3">Adjustment</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {period.calculations.map((c) => (
                <tr key={c.id} className="border-b border-black/5 align-top dark:border-white/5">
                  <td className="py-2 pr-3 font-medium">{c.assistant.name}</td>
                  <td className="py-2 pr-3">{c.classesCovered}</td>
                  <td className="py-2 pr-3">{egp(c.baseSalary)}</td>
                  <td className="py-2 pr-3 text-red-600">-{egp(c.lateDeductions)}</td>
                  <td className="py-2 pr-3 text-green-600">+{egp(c.officeHoursBonus)}</td>
                  <td className={`py-2 pr-3 ${Number(c.coverageAdjustment) < 0 ? "text-red-600" : "text-green-600"}`}>
                    {Number(c.coverageAdjustment) >= 0 ? "+" : "−"}{egp(Math.abs(Number(c.coverageAdjustment)))}
                  </td>
                  <td className="py-2 pr-3">
                    {c.status === "sent" ? (
                      <span>{egp(c.manualAdjustment)}</span>
                    ) : (
                      <form action={setAdjustment.bind(null, c.id)} className="flex items-center gap-1">
                        <input
                          name="amount"
                          type="number"
                          step="1"
                          defaultValue={Number(c.manualAdjustment)}
                          className={`${inputCls} w-16`}
                        />
                        <input name="note" placeholder="note" defaultValue={c.adjustmentNote ?? ""} className={`${inputCls} w-24`} />
                        <button type="submit" className="text-blue-600 hover:underline">Save</button>
                      </form>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-semibold">{egp(c.total)}</td>
                  <td className="py-2 pr-3 capitalize">{c.status}</td>
                  <td className="py-2">
                    {c.status === "pending" && (
                      <form action={approveCalc.bind(null, c.id)}>
                        <button type="submit" className="text-blue-600 hover:underline">Approve</button>
                      </form>
                    )}
                    {c.status === "approved" && (
                      <form action={sendCalc.bind(null, c.id)}>
                        <button type="submit" className="text-green-600 hover:underline">Send</button>
                      </form>
                    )}
                    {c.status === "sent" && c.sentAt && (
                      <span className="text-xs text-black/40">sent</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
