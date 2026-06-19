// Dev helper: a class assigned to Test Assistant, with 3 students and two sessions
// (one a week ago -> "late", one a week ahead -> "on time") for attendance testing.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function daysFromNowUTC(delta: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

async function main() {
  const school = await prisma.school.findFirst({ where: { name: "Citadel" } });
  const assistant = await prisma.assistant.findFirst({ where: { email: "assistant@classops.local" } });
  if (!school || !assistant) throw new Error("Need Citadel school + assistant@classops.local (run scripts/dev-users.ts).");

  let klass = await prisma.class.findFirst({ where: { name: "Y9-Citadel" } });
  if (!klass) {
    klass = await prisma.class.create({
      data: {
        schoolId: school.id,
        yearGroup: "Y9",
        name: "Y9-Citadel",
        schedule: { day: "Sunday", time: "08:00" },
        planStartDate: daysFromNowUTC(-7),
      },
    });
  }

  for (const [name, code] of [["Aaron Said", "C11"], ["Bob Nabil", "C42"], ["Carol Wagdy", "C73"]] as const) {
    if (!(await prisma.student.findFirst({ where: { classId: klass.id, name } }))) {
      await prisma.student.create({ data: { classId: klass.id, name, code } });
    }
  }
  await prisma.class.update({
    where: { id: klass.id },
    data: { studentCount: await prisma.student.count({ where: { classId: klass.id, active: true } }) },
  });

  if (!(await prisma.classAssignment.findFirst({ where: { classId: klass.id, assistantId: assistant.id, endDate: null } }))) {
    await prisma.classAssignment.create({
      data: { classId: klass.id, assistantId: assistant.id, startDate: daysFromNowUTC(-30) },
    });
  }

  await prisma.classSession.deleteMany({ where: { classId: klass.id } });
  await prisma.classSession.createMany({
    data: [
      { classId: klass.id, lessonNumber: 1, scheduledDate: daysFromNowUTC(-7) },
      { classId: klass.id, lessonNumber: 2, scheduledDate: daysFromNowUTC(0) },
      { classId: klass.id, lessonNumber: 3, scheduledDate: daysFromNowUTC(7) },
    ],
  });

  process.stdout.write(JSON.stringify({ classId: klass.id }));
}

main().finally(() => prisma.$disconnect());
