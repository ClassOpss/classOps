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
  const statusBadge: Record<string, string> = {
    pending: "badge-neutral",
    approved: "badge-brand",
    sent: "badge-success",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/pay" className="link text-sm">← Pay</Link>
        <h1 className="page-title mt-1">
          {MONTHS[period.month - 1]} {period.year}
        </h1>
        <p className="page-subtitle">
          {period.calculations.length} assistants · {egp(grandTotal)} EGP total ·{" "}
          <span className="capitalize">{period.status}</span>
        </p>
      </div>

      <form action={recalcPayPeriod.bind(null, periodId)}>
        <button type="submit" className="btn-secondary">
          Recalculate (refresh after waiving incidents)
        </button>
      </form>

      {period.calculations.length === 0 ? (
        <p className="card px-5 py-6 text-sm text-muted">No assistants.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Assistant</th>
                <th>Classes</th>
                <th>Base</th>
                <th>Deductions</th>
                <th>Office hrs</th>
                <th>Coverage</th>
                <th>Adjustment</th>
                <th>Total</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {period.calculations.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.assistant.name}</td>
                  <td>{c.classesCovered}</td>
                  <td>{egp(c.baseSalary)}</td>
                  <td className="text-danger">-{egp(c.lateDeductions)}</td>
                  <td className="text-success">+{egp(c.officeHoursBonus)}</td>
                  <td className={Number(c.coverageAdjustment) < 0 ? "text-danger" : "text-success"}>
                    {Number(c.coverageAdjustment) >= 0 ? "+" : "−"}{egp(Math.abs(Number(c.coverageAdjustment)))}
                  </td>
                  <td>
                    {c.status === "sent" ? (
                      <span>{egp(c.manualAdjustment)}</span>
                    ) : (
                      <form action={setAdjustment.bind(null, c.id)} className="flex items-center gap-1.5">
                        <input
                          name="amount"
                          type="number"
                          step="1"
                          defaultValue={Number(c.manualAdjustment)}
                          className="input w-16 !py-1 text-xs"
                        />
                        <input name="note" placeholder="note" defaultValue={c.adjustmentNote ?? ""} className="input w-24 !py-1 text-xs" />
                        <button type="submit" className="link">Save</button>
                      </form>
                    )}
                  </td>
                  <td className="font-semibold">{egp(c.total)}</td>
                  <td>
                    <span className={statusBadge[c.status] ?? "badge-neutral"}>{c.status}</span>
                  </td>
                  <td>
                    {c.status === "pending" && (
                      <form action={approveCalc.bind(null, c.id)}>
                        <button type="submit" className="link">Approve</button>
                      </form>
                    )}
                    {c.status === "approved" && (
                      <form action={sendCalc.bind(null, c.id)}>
                        <button type="submit" className="font-medium text-success hover:underline">Send</button>
                      </form>
                    )}
                    {c.status === "sent" && c.sentAt && (
                      <span className="text-xs text-faint">sent</span>
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
