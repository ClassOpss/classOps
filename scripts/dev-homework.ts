// Dev helper: class assigned to Test Assistant with 3 students, a session, and one
// homework assignment (deadline yesterday) for testing submission-status entry.
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
  if (!school || !assistant) throw new Error("Need Citadel + assistant@classops.local (scripts/dev-users.ts).");

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
  const session = await prisma.classSession.create({
    data: { classId: klass.id, lessonNumber: 1, scheduledDate: daysFromNowUTC(-7) },
  });
  const hw = await prisma.homeworkAssignment.create({
    data: { sessionId: session.id, classId: klass.id, description: "Exercise 4B, Q1-10", deadline: daysFromNowUTC(-1) },
  });

  process.stdout.write(JSON.stringify({ classId: klass.id, homeworkId: hw.id }));
}

main().finally(() => prisma.$disconnect());
