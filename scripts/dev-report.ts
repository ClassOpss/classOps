// Dev helper: a class with a month's worth of data to exercise the PDF report.
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
      schoolId: school.id, yearGroup: "Y9", name: "Y9-Citadel",
      schedule: { day: "Sunday", time: "08:00" }, planStartDate: daysFromNowUTC(-30),
    },
  });
  const aaron = await prisma.student.create({ data: { classId: klass.id, name: "Aaron Said", code: "C11" } });
  const bob = await prisma.student.create({ data: { classId: klass.id, name: "Bob Nabil", code: "C42" } });
  await prisma.class.update({ where: { id: klass.id }, data: { studentCount: 2 } });
  await prisma.classAssignment.create({ data: { classId: klass.id, assistantId: assistant.id, startDate: daysFromNowUTC(-40) } });

  const topic = await prisma.topic.findFirst({ where: { yearGroup: "Y9" }, orderBy: { sortOrder: "asc" } });
  const session = await prisma.classSession.create({
    data: { classId: klass.id, lessonNumber: 1, scheduledDate: daysFromNowUTC(-2), topicId: topic?.id ?? null },
  });
  await prisma.attendance.createMany({
    data: [
      { sessionId: session.id, studentId: aaron.id, status: "present", loggedById: assistant.id },
      { sessionId: session.id, studentId: bob.id, status: "absent", loggedById: assistant.id },
    ],
  });
  const hw = await prisma.homeworkAssignment.create({
    data: { sessionId: session.id, classId: klass.id, description: "Exercise 1A", deadline: daysFromNowUTC(-1) },
  });
  await prisma.homeworkSubmission.create({
    data: { homeworkId: hw.id, studentId: aaron.id, submissionDate: daysFromNowUTC(-1), status: "on_time", loggedById: assistant.id, weakPoints: "factorising quadratics" },
  });
  const assessment = await prisma.assessment.create({
    data: { classId: klass.id, type: "quiz", label: "Quiz 3", date: daysFromNowUTC(-3), maxMark: 20 },
  });
  await prisma.assessmentGrade.createMany({
    data: [
      { assessmentId: assessment.id, studentId: aaron.id, rawMark: 18, percentage: 90, loggedById: assistant.id },
      { assessmentId: assessment.id, studentId: bob.id, rawMark: 10, percentage: 50, loggedById: assistant.id },
    ],
  });

  const now = new Date();
  process.stdout.write(JSON.stringify({ classId: klass.id, month: now.getUTCMonth() + 1, year: now.getUTCFullYear() }));
}

main().finally(() => prisma.$disconnect());
