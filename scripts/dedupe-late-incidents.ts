// One-off cleanup: removes duplicate late incidents. A duplicate = same assistant + same task
// (type) + same Cairo day of the deadline (e.g. the same task missed in two classes that day).
// From each group ONE row is kept — a charged one over a waived one (confirmed first), then the
// oldest — and the rest are deleted.
// Unsent payslips for the affected months are recomputed; sent ones stay frozen.
//
//   npx tsx scripts/dedupe-late-incidents.ts          # dry run: lists what would go
//   npx tsx scripts/dedupe-late-incidents.ts apply    # deletes
//
// Point DATABASE_URL at the target DB (defaults to .env = local).
import { formatInTimeZone } from "date-fns-tz";
import { prisma } from "../src/lib/db";
import { CAIRO_TZ } from "../src/lib/datetime";
import { refreshUnsentPay } from "../src/lib/quiz-incidents";

const apply = process.argv[2] === "apply";

async function main() {
  const incidents = await prisma.lateIncident.findMany({
    select: {
      id: true,
      assistantId: true,
      type: true,
      deadline: true,
      sessionId: true,
      waived: true,
      confirmedAt: true,
      createdAt: true,
      assistant: { select: { name: true } },
    },
  });

  const groups = new Map<string, typeof incidents>();
  for (const i of incidents) {
    const k = `${i.assistantId}|${i.type}|${formatInTimeZone(i.deadline, CAIRO_TZ, "yyyy-MM-dd")}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }

  // Prefer a fine the admin let stand (confirmed, then charged) over a waived one.
  const rank = (i: (typeof incidents)[number]) => (i.waived ? 2 : i.confirmedAt ? 0 : 1);
  const remove: typeof incidents = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    rows.sort((a, b) => rank(a) - rank(b) || a.createdAt.getTime() - b.createdAt.getTime());
    const [keep, ...rest] = rows;
    console.log(
      `${keep.assistant.name} · ${keep.type} · ${formatInTimeZone(keep.deadline, CAIRO_TZ, "yyyy-MM-dd")}: ` +
        `${rows.length} rows, keeping ${keep.id}${keep.waived ? " (waived)" : ""}, removing ${rest.length}`,
    );
    remove.push(...rest);
  }

  console.log(`\n${incidents.length} incidents, ${remove.length} duplicates.`);
  if (remove.length === 0 || !apply) {
    if (remove.length > 0) console.log("Dry run — re-run with `apply` to delete.");
    return;
  }

  await prisma.lateIncident.deleteMany({ where: { id: { in: remove.map((i) => i.id) } } });
  const months = new Set(remove.map((i) => `${i.assistantId}|${formatInTimeZone(i.deadline, CAIRO_TZ, "yyyy-M")}`));
  for (const m of months) {
    const [assistantId, ym] = m.split("|");
    const [year, month] = ym.split("-").map(Number);
    await refreshUnsentPay(assistantId, month, year);
  }
  console.log(`Deleted ${remove.length}; refreshed ${months.size} unsent payslip month(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
