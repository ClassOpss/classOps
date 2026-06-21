import { PrismaClient, YearGroup } from "@prisma/client";
import bcrypt from "bcryptjs";
import { OPERATION_DEFAULTS } from "../src/lib/config";

const prisma = new PrismaClient();

// The first operation — home of all v1 single-tenant data. Must match the id the
// add_operations migration seeds, so a fresh `db seed` and a migrated DB agree.
const DEFAULT_OPERATION_ID = "00000000-0000-0000-0000-000000000001";

// Schools from spec section 4.1
const SCHOOLS = [
  "Citadel",
  "Noon",
  "Summits",
  "Eschola",
  "Glory",
  "Center",
  "BICC",
  "Manchester",
  "Gulf",
  "BMS",
];

// Starter IGCSE Math topic list. Teacher expands/edits in-app.
// (title, yearGroup, chapter, sortOrder)
const TOPICS: Array<[string, YearGroup, string | null]> = [
  ["Number & Operations", "Y9", "Number"],
  ["Fractions, Decimals & Percentages", "Y9", "Number"],
  ["Algebraic Expressions", "Y9", "Algebra"],
  ["Linear Equations", "Y9", "Algebra"],
  ["Coordinate Geometry", "Y9", "Geometry"],
  ["Angles & Polygons", "Y9", "Geometry"],
  ["Probability & Statistics", "Y9", "Statistics"],
  ["Indices & Standard Form", "Y10", "Number"],
  ["Algebraic Fractions", "Y10", "Algebra"],
  ["Quadratic Equations", "Y10", "Algebra"],
  ["Simultaneous Equations", "Y10", "Algebra"],
  ["Trigonometry", "Y10", "Geometry"],
  ["Vectors", "Y10", "Geometry"],
  ["Interpreting Data", "Y10", "Statistics"],
  ["Functions", "S1", "Algebra"],
  ["Differentiation", "S1", "Calculus"],
  ["Integration", "S1", "Calculus"],
  ["Sequences & Series", "S1", "Algebra"],
];

async function main() {
  // --- Default operation ("Math by Mo") — all v1 data lives here ---
  await prisma.operation.upsert({
    where: { id: DEFAULT_OPERATION_ID },
    update: {},
    create: {
      id: DEFAULT_OPERATION_ID,
      name: OPERATION_DEFAULTS.brandName,
      slug: "math-by-mo",
      brandName: OPERATION_DEFAULTS.brandName,
      brandSignature: OPERATION_DEFAULTS.brandSignature,
      logoPath: OPERATION_DEFAULTS.logoPath,
      currency: OPERATION_DEFAULTS.currency,
      dailyDeadlineHour: OPERATION_DEFAULTS.dailyDeadlineHour,
      weeklyDeadlineWeekday: OPERATION_DEFAULTS.weeklyDeadlineWeekday,
      weeklyDeadlineHour: OPERATION_DEFAULTS.weeklyDeadlineHour,
      perClassSalary: OPERATION_DEFAULTS.perClassSalary,
      officeHourBonus: OPERATION_DEFAULTS.officeHourBonus,
      lateDeduction: OPERATION_DEFAULTS.lateDeduction,
      coverageAdjustment: OPERATION_DEFAULTS.coverageAdjustment,
      payMultiplier: OPERATION_DEFAULTS.payMultiplier,
    },
  });
  console.log("Operation ready: Math by Mo");

  // --- Default admin (Jana) — super-admin, not scoped to any operation ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "jana.meriden05@eng-st.cu.edu.eg";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Jana",
      phone: "01055656674",
      role: "admin",
      active: true,
      emailVerified: new Date(),
      passwordHash,
    },
  });
  console.log(`Admin ready: ${adminEmail}`);

  // --- Schools (scoped to the default operation) ---
  for (const name of SCHOOLS) {
    const existing = await prisma.school.findFirst({ where: { name, operationId: DEFAULT_OPERATION_ID } });
    if (!existing) await prisma.school.create({ data: { name, operationId: DEFAULT_OPERATION_ID } });
  }
  console.log(`Schools seeded: ${SCHOOLS.length}`);

  // --- Topics (scoped to the default operation) ---
  let sort = 0;
  for (const [title, yearGroup, chapter] of TOPICS) {
    const existing = await prisma.topic.findFirst({
      where: { title, yearGroup, operationId: DEFAULT_OPERATION_ID },
    });
    if (!existing) {
      await prisma.topic.create({
        data: { title, yearGroup, chapter, sortOrder: sort++, operationId: DEFAULT_OPERATION_ID },
      });
    }
  }
  console.log(`Topics seeded: ${TOPICS.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
