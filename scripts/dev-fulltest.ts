// Rigorous-test seed: class + Test Assistant + 2 students, a past session with NO tasks done
// (so the cron raises attendance/parent/classroom incidents), an assessment with a graded
// student + an ABSENT student (tests absent handling), and a homework. Office hours are logged
// via the UI during the test.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function dUTC(delta: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + delta);
  return d;
}

async function main() {
  const school = await prisma.school.findFirst({ where: { name: "Citadel" } });
  const assistant = await prisma.assistant.findFirst({ where: { email: "assistant@classops.local" } });
  if (!school || !assistant) throw new Error("Need Citadel + assistant@classops.local (scripts/dev-users.ts).");

  await prisma.class.deleteMany({ where: { name: "Y9-Citadel" } });
  const klass = await prisma.class.create({
    data: {
      schoolId: school.id, yearGroup: "Y9", name: "Y9-Citadel",
      schedule: { day: "Sunday", time: "08:00" }, planStartDate: dUTC(-30),
    },
  });
  const aaron = await prisma.student.create({ data: { classId: klass.id, name: "Aaron Said", code: "C11" } });
  const bob = await prisma.student.create({ data: { classId: klass.id, name: "Bob Nabil", code: "C42" } });
  await prisma.class.update({ where: { id: klass.id }, data: { studentCount: 2 } });
  await prisma.classAssignment.create({ data: { classId: klass.id, assistantId: assistant.id, startDate: dUTC(-40) } });

  // Past session, nothing logged -> cron will raise 3 daily incidents.
  const sessionDate = dUTC(-7);
  const session = await prisma.classSession.create({
    data: { classId: klass.id, lessonNumber: 1, scheduledDate: sessionDate },
  });

  // Assessment with a topic (for the insights chart) + one graded, one ABSENT.
  const topic = await prisma.topic.findFirst({ where: { yearGroup: "Y9" }, orderBy: { sortOrder: "asc" } });
  const assessment = await prisma.assessment.create({
    data: { classId: klass.id, type: "quiz", label: "Quiz 1", date: dUTC(-3), maxMark: 20, topicId: topic?.id ?? null },
  });
  await prisma.assessmentGrade.create({
    data: { assessmentId: assessment.id, studentId: aaron.id, rawMark: 18, percentage: 90, loggedById: assistant.id },
  });
  await prisma.assessmentGrade.create({
    data: { assessmentId: assessment.id, studentId: bob.id, absent: true, rawMark: null, percentage: null, loggedById: assistant.id },
  });

  const hw = await prisma.homeworkAssignment.create({
    data: { sessionId: session.id, classId: klass.id, description: "Ex 1A", deadline: dUTC(-1) },
  });
  await prisma.homeworkSubmission.create({
    data: { homeworkId: hw.id, studentId: aaron.id, submissionDate: dUTC(-1), status: "on_time", loggedById: assistant.id },
  });

  const now = new Date();
  process.stdout.write(JSON.stringify({
    classId: klass.id,
    sessionDateIso: sessionDate.toISOString().slice(0, 10),
    month: now.getUTCMonth() + 1,
    year: now.getUTCFullYear(),
  }));
}

main().finally(() => prisma.$disconnect());
