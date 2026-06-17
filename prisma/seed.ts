import { PrismaClient, YearGroup } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
  // --- Default admin (Jana) ---
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

  // --- Schools ---
  for (const name of SCHOOLS) {
    const existing = await prisma.school.findFirst({ where: { name } });
    if (!existing) await prisma.school.create({ data: { name } });
  }
  console.log(`Schools seeded: ${SCHOOLS.length}`);

  // --- Topics ---
  let sort = 0;
  for (const [title, yearGroup, chapter] of TOPICS) {
    const existing = await prisma.topic.findFirst({ where: { title, yearGroup } });
    if (!existing) {
      await prisma.topic.create({
        data: { title, yearGroup, chapter, sortOrder: sort++ },
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
