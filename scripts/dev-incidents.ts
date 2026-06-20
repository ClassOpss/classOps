// Dev helper: a class with an assistant where ALL deadlines are missed today —
// a session with no tasks done, a homework due today with no submissions, and an
// assessment today with no grades. Used to exercise the late-incident cron.
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
  if (!school || !assistant) throw new Error("Need Citadel + assistant@classops.local.");

  await prisma.class.deleteMany({ where: { name: "Y9-Citadel" } });
  const klass = await prisma.class.create({
    data: {
      schoolId: school.id,
      yearGroup: "Y9",
      name: "Y9-Citadel",
      schedule: { day: "Sunday", time: "08:00" },
      planStartDate: daysFromNowUTC(-30),
    },
  });
  for (const [name, code] of [["Aaron Said", "C11"], ["Bob Nabil", "C42"]] as const) {
    await prisma.student.create({ data: { classId: klass.id, name, code } });
  }
  await prisma.class.update({ where: { id: klass.id }, data: { studentCount: 2 } });
  await prisma.classAssignment.create({
    data: { classId: klass.id, assistantId: assistant.id, startDate: daysFromNowUTC(-40) },
  });

  const session = await prisma.classSession.create({
    data: { classId: klass.id, lessonNumber: 1, scheduledDate: daysFromNowUTC(0) },
  });
  await prisma.homeworkAssignment.create({
    data: { sessionId: session.id, classId: klass.id, description: "Ex 2", deadline: daysFromNowUTC(0) },
  });
  await prisma.assessment.create({
    data: { classId: klass.id, type: "quiz", label: "Quiz X", date: daysFromNowUTC(0), maxMark: 10 },
  });

  const today = daysFromNowUTC(0).toISOString().slice(0, 10);
  process.stdout.write(JSON.stringify({ classId: klass.id, today }));
}

main().finally(() => prisma.$disconnect());
