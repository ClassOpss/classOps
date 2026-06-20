// Dev helper: class assigned to Test Assistant, 3 students, one assessment (max 20).
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
  for (const [name, code] of [["Aaron Said", "C11"], ["Bob Nabil", "C42"], ["Carol Wagdy", "C73"]] as const) {
    await prisma.student.create({ data: { classId: klass.id, name, code } });
  }
  await prisma.class.update({ where: { id: klass.id }, data: { studentCount: 3 } });
  await prisma.classAssignment.create({
    data: { classId: klass.id, assistantId: assistant.id, startDate: daysFromNowUTC(-40) },
  });

  const assessment = await prisma.assessment.create({
    data: { classId: klass.id, type: "quiz", label: "Quiz 3", date: daysFromNowUTC(-3), maxMark: 20 },
  });

  process.stdout.write(JSON.stringify({ classId: klass.id, assessmentId: assessment.id }));
}

main().finally(() => prisma.$disconnect());
