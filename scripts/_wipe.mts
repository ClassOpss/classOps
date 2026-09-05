// One-off PRODUCTION wipe — "total blank slate".
// Keeps ONLY the admin user (Jana) with her existing password hash, truncates
// every other table, then reseeding (separate step) recreates operation/schools/topics.
//
// Safety: refuses to run unless CONFIRM_WIPE=YES and prints the target host first.
// Run: CONFIRM_WIPE=YES DATABASE_URL="<prod-url>" npx tsx scripts/_wipe.mts
import { PrismaClient } from "@prisma/client";

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "jana.meriden05@eng-st.cu.edu.eg";

function maskedHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  console.log("Target DB host:", maskedHost(url));

  if (process.env.CONFIRM_WIPE !== "YES") {
    console.log("Refusing to wipe: set CONFIRM_WIPE=YES to proceed. (dry run)");
    return;
  }

  const prisma = new PrismaClient();

  // 1. Capture the admin row so we can restore it verbatim (esp. passwordHash).
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    await prisma.$disconnect();
    throw new Error(`Admin user ${ADMIN_EMAIL} not found — aborting to avoid a login-less DB.`);
  }
  console.log("Preserving admin:", admin.email, "(id", admin.id + ")");

  // 2. Every public table except Prisma's migration ledger.
  const rows = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const tables = rows.map((r) => `"${r.tablename}"`);
  console.log(`Truncating ${tables.length} tables...`);

  // 3. CASCADE handles FK order; RESTART IDENTITY resets any serial counters.
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables.join(", ")} RESTART IDENTITY CASCADE`,
  );

  // 4. Restore the admin user verbatim (keeps her password + super-admin status).
  await prisma.user.create({ data: admin });
  console.log("Admin restored.");

  await prisma.$disconnect();
  console.log("Wipe complete. Next: reseed operation/schools/topics.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
