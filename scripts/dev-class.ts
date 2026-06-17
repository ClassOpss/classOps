// Dev helper: create one class under an existing seeded school (to exercise pages).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: "Citadel" } });
  if (!school) throw new Error("Seed schools first (npm run db:seed).");

  let klass = await prisma.class.findFirst({ where: { name: "Y9-Citadel" } });
  if (!klass) {
    klass = await prisma.class.create({
      data: {
        schoolId: school.id,
        yearGroup: "Y9",
        name: "Y9-Citadel",
        schedule: { day: "Sunday", time: "16:00" },
        planStartDate: new Date("2026-09-13"),
      },
    });
  }
  process.stdout.write(klass.id);
}

main().finally(() => prisma.$disconnect());
