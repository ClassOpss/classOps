// Dev helper: ensure a Y9 plan (4 lessons) + Y9-Citadel class (Sunday, plan start 2026-09-13).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: "Citadel" } });
  if (!school) throw new Error("Seed schools first.");

  // Plan with first 4 Y9 topics
  const topics = await prisma.topic.findMany({
    where: { yearGroup: "Y9" },
    orderBy: { sortOrder: "asc" },
    take: 4,
    select: { id: true },
  });
  const plan = await prisma.lessonPlan.upsert({
    where: { yearGroup: "Y9" },
    update: {},
    create: { yearGroup: "Y9" },
  });
  const existingItems = await prisma.lessonPlanItem.count({ where: { planId: plan.id } });
  if (existingItems === 0) {
    await prisma.lessonPlanItem.createMany({
      data: topics.map((t, i) => ({ planId: plan.id, topicId: t.id, sequence: i + 1 })),
    });
  }

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
