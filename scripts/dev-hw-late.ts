// Dev helper for the "edit after Saturday" scenario:
// HW deadline 10 days ago; the assistant did the correction 11 days ago (before that
// week's Saturday = on time). Carol was marked missing. Later (now) a student submits
// late and the assistant edits — must NOT make the assistant late.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function daysFromNowUTC(delta: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}
function daysAgoInstant(delta: number): Date {
  return new Date(Date.now() - delta * 24 * 3600 * 1000);
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
  const students = [];
  for (const [name, code] of [["Aaron Said", "C11"], ["Bob Nabil", "C42"], ["Carol Wagdy", "C73"]] as const) {
    students.push(await prisma.student.create({ data: { classId: klass.id, name, code } }));
  }
  await prisma.class.update({ where: { id: klass.id }, data: { studentCount: 3 } });
  await prisma.classAssignment.create({
    data: { classId: klass.id, assistantId: assistant.id, startDate: daysFromNowUTC(-40) },
  });

  const session = await prisma.classSession.create({
    data: { classId: klass.id, lessonNumber: 1, scheduledDate: daysFromNowUTC(-17) },
  });
  const hw = await prisma.homeworkAssignment.create({
    data: { sessionId: session.id, classId: klass.id, description: "Exercise 3A", deadline: daysFromNowUTC(-10) },
  });

  const loggedOnTime = daysAgoInstant(11); // before that week's Saturday
  await prisma.homeworkSubmission.createMany({
    data: [
      { homeworkId: hw.id, studentId: students[0].id, submissionDate: daysFromNowUTC(-11), status: "on_time", loggedById: assistant.id, loggedAt: loggedOnTime },
      { homeworkId: hw.id, studentId: students[1].id, submissionDate: daysFromNowUTC(-11), status: "on_time", loggedById: assistant.id, loggedAt: loggedOnTime },
      { homeworkId: hw.id, studentId: students[2].id, submissionDate: null, status: "missing", loggedById: assistant.id, loggedAt: loggedOnTime },
    ],
  });

  process.stdout.write(JSON.stringify({ classId: klass.id, homeworkId: hw.id, carolId: students[2].id }));
}

main().finally(() => prisma.$disconnect());
