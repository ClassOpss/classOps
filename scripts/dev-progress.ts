// Dev helper: two Y9 classes with past weekly sessions; Noon has a day-off so it
// trails Citadel — to exercise the cross-class progress view.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function weeklyDatesEndingToday(count: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i * 7);
    out.push(d);
  }
  return out;
}

async function makeClass(name: string, schoolId: string, dayOffIndex: number | null) {
  let klass = await prisma.class.findFirst({ where: { name } });
  if (!klass) {
    klass = await prisma.class.create({
      data: {
        schoolId,
        yearGroup: "Y9",
        name,
        schedule: { day: "Sunday", time: "16:00" },
        planStartDate: weeklyDatesEndingToday(6)[0],
      },
    });
  }
  await prisma.classSession.deleteMany({ where: { classId: klass.id } });
  const dates = weeklyDatesEndingToday(6);
  await prisma.classSession.createMany({
    data: dates.map((d, i) => ({
      classId: klass!.id,
      lessonNumber: i + 1,
      scheduledDate: d,
      dayOff: dayOffIndex === i,
      cancellationReason: dayOffIndex === i ? "Holiday" : null,
    })),
  });
  return klass.id;
}

async function main() {
  const citadel = await prisma.school.findFirst({ where: { name: "Citadel" } });
  const noon = await prisma.school.findFirst({ where: { name: "Noon" } });
  if (!citadel || !noon) throw new Error("Seed schools first.");

  const a = await makeClass("Y9-Citadel", citadel.id, null); // 6 delivered
  const b = await makeClass("Y9-Noon", noon.id, 2); // 5 delivered (one day-off)
  process.stdout.write(JSON.stringify({ citadel: a, noon: b }));
}

main().finally(() => prisma.$disconnect());
