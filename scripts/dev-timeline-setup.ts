// Dev helper for the class-specific-lesson / update-future feature.
// Creates two Y9 classes sharing the Y9 plan:
//   A "TL — Y9 Straddle": weekly Sundays starting 3 Sundays ago -> some delivered, some upcoming.
//   B "TL — Y9 Future":   weekly Sundays starting next Sunday    -> all upcoming.
// Idempotent: deletes prior copies first.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const OP = "00000000-0000-0000-0000-000000000001"; // Math by Mo

function sunday(offsetWeeks: number): Date {
  // The Sunday `offsetWeeks` from the most recent past Sunday (offset 0 = last Sunday).
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 7) % 7 || 7)); // last strictly-past Sunday
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7);
  return d;
}

async function ensurePlanItems(): Promise<{ id: string; topicId: string | null }[]> {
  const plan =
    (await prisma.lessonPlan.findUnique({
      where: { operationId_yearGroup: { operationId: OP, yearGroup: "Y9" } },
    })) ??
    (await prisma.lessonPlan.create({ data: { operationId: OP, yearGroup: "Y9" } }));

  let items = await prisma.lessonPlanItem.findMany({
    where: { planId: plan.id },
    orderBy: { sequence: "asc" },
    select: { id: true, topicId: true },
  });
  if (items.length >= 8) return items;

  // Top up to 8 items from Y9 topics (creating topics if needed).
  let topics = await prisma.topic.findMany({
    where: { operationId: OP, yearGroup: "Y9" },
    orderBy: { sortOrder: "asc" },
  });
  while (topics.length < 8) {
    const n = topics.length + 1;
    await prisma.topic.create({
      data: { operationId: OP, yearGroup: "Y9", title: `Y9 Topic ${n}`, sortOrder: n },
    });
    topics = await prisma.topic.findMany({
      where: { operationId: OP, yearGroup: "Y9" },
      orderBy: { sortOrder: "asc" },
    });
  }
  for (let i = items.length; i < 8; i++) {
    await prisma.lessonPlanItem.create({
      data: { planId: plan.id, sequence: i + 1, topicId: topics[i].id },
    });
  }
  items = await prisma.lessonPlanItem.findMany({
    where: { planId: plan.id },
    orderBy: { sequence: "asc" },
    select: { id: true, topicId: true },
  });
  return items;
}

async function makeClass(name: string, startOffsetWeeks: number, items: { id: string; topicId: string | null }[], schoolId: string) {
  const planStart = sunday(startOffsetWeeks);
  const klass = await prisma.class.create({
    data: {
      operationId: OP,
      schoolId,
      yearGroup: "Y9",
      name,
      schedule: { slots: [{ day: "Sunday", time: "16:00" }] },
      planStartDate: planStart,
    },
  });
  for (let i = 0; i < items.length; i++) {
    const date = new Date(planStart);
    date.setUTCDate(planStart.getUTCDate() + i * 7);
    await prisma.classSession.create({
      data: {
        classId: klass.id,
        planItemId: items[i].id,
        topicId: items[i].topicId,
        lessonNumber: i + 1,
        scheduledDate: date,
      },
    });
  }
  return { id: klass.id, planStart: planStart.toISOString().slice(0, 10) };
}

async function main() {
  const items = await ensurePlanItems();
  await prisma.class.deleteMany({ where: { operationId: OP, name: { in: ["TL — Y9 Straddle", "TL — Y9 Future"] } } });
  const school =
    (await prisma.school.findFirst({ where: { operationId: OP, name: "Timeline Test School" } })) ??
    (await prisma.school.create({ data: { operationId: OP, name: "Timeline Test School" } }));

  const a = await makeClass("TL — Y9 Straddle", -2, items, school.id); // starts 2 Sundays ago
  const b = await makeClass("TL — Y9 Future", 1, items, school.id); // starts next Sunday
  console.log(JSON.stringify({ straddle: a, future: b, planItems: items.length }, null, 2));
}

main().finally(() => prisma.$disconnect());
