import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { currentOperationId } from "@/lib/operation";
import { vacationFractionOff, VACATION_FULL_MONTH_DAYS } from "@/lib/vacations";
import { deleteVacation } from "@/actions/vacations";
import { VacationForm } from "./vacation-form";

const DAY_MS = 24 * 60 * 60 * 1000;

const fmt = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);

// Inclusive day span, and the share of that month's base pay withheld for the school's classes.
function spanInfo(start: Date, end: Date): { days: number; effect: string } {
  const days = Math.round((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) -
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / DAY_MS) + 1;
  const off = vacationFractionOff(days);
  const effect =
    off >= 1 ? "full month's base off" : `${Math.round(off * 100)}% of base off (${days}/${VACATION_FULL_MONTH_DAYS} days)`;
  return { days, effect };
}

export default async function VacationsPage() {
  await requireRole("admin");
  const operationId = await currentOperationId();

  const [schools, vacations] = await Promise.all([
    prisma.school.findMany({ where: { operationId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.schoolVacation.findMany({
      where: { operationId },
      orderBy: { startDate: "desc" },
      include: { school: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="page-title">School Vacations</h1>
        <p className="page-subtitle">
          Record school breaks (Easter, mid-year…). During a break, its classes aren&apos;t counted as
          missed — no late fines, no false coverage — and each affected assistant&apos;s base pay is
          prorated: 1 week off = ¼ less, 2 weeks = ½, a whole month = 0. Extra work (office hours,
          covering a colleague) is still paid.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="section-title mb-3">Add a break</h2>
        {schools.length === 0 ? (
          <p className="text-sm text-muted">Add a school first.</p>
        ) : (
          <VacationForm schools={schools} />
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="section-title">Scheduled breaks ({vacations.length})</h2>
        </div>
        {vacations.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">None yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Break</th>
                  <th>Dates</th>
                  <th>Pay effect</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {vacations.map((v) => {
                  const { days, effect } = spanInfo(v.startDate, v.endDate);
                  return (
                    <tr key={v.id}>
                      <td className="font-medium">{v.school.name}</td>
                      <td>{v.label}</td>
                      <td>
                        {fmt(v.startDate)} – {fmt(v.endDate)}{" "}
                        <span className="text-faint">({days} {days === 1 ? "day" : "days"})</span>
                      </td>
                      <td className="text-sm text-muted">{effect}</td>
                      <td>
                        <form action={deleteVacation.bind(null, v.id)}>
                          <button type="submit" className="link text-danger">Remove</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
