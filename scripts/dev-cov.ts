// Dev helper: seeds a coverage scenario for the per-day ownership rework.
// Class "ZZ-Cov" (this month) is owned by assistant A on one session, but
// assistant B logged that session's attendance -> a coverage candidate the
// admin should see on the dashboard and confirm (+50 B / -50 A in pay).
// Run: npx tsx scripts/dev-cov.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_OPERATION_ID = "00000000-0000-0000-0000-000000000001";

function dayUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

async function ensureAssistant(email: string, name: string) {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, active: true, role: "assistant" },
    create: { email, name, role: "assistant", active: true, emailVerified: new Date(), passwordHash },
  });
  await prisma.user.update({ where: { id: user.id }, data: { operationId: DEFAULT_OPERATION_ID } });
  return prisma.assistant.upsert({
    where: { userId: user.id },
    update: { active: true },
    create: { userId: user.id, name, email, operationId: DEFAULT_OPERATION_ID },
  });
}

async function main() {
  const A = await ensureAssistant("assistant@classops.local", "Test Assistant");
  const B = await ensureAssistant("assistant-b@classops.local", "Assistant Bee");

  const school =
    (await prisma.school.findFirst({ where: { name: "ZZ-Cov-School" } })) ??
    (await prisma.school.create({ data: { name: "ZZ-Cov-School", operationId: DEFAULT_OPERATION_ID } }));

  await prisma.class.deleteMany({ where: { name: "ZZ-Cov" } });
  const klass = await prisma.class.create({
    data: {
      operationId: DEFAULT_OPERATION_ID,
      schoolId: school.id,
      yearGroup: "Y9",
      name: "ZZ-Cov",
      schedule: { days: ["Tuesday", "Thursday"], time: "16:00" },
      planStartDate: dayUTC(2026, 6, 1),
      studentCount: 2,
    },
  });

  const s1 = await prisma.student.create({ data: { classId: klass.id, name: "Cov One", code: "Z1" } });
  await prisma.student.create({ data: { classId: klass.id, name: "Cov Two", code: "Z2" } });

  for (const a of [A, B]) {
    await prisma.classAssignment.create({
      data: { classId: klass.id, assistantId: a.id, startDate: dayUTC(2026, 6, 1) },
    });
  }

  // A's session (Tuesday 2026-06-16), but B logged the attendance -> coverage.
  const session = await prisma.classSession.create({
    data: {
      classId: klass.id,
      lessonNumber: 1,
      scheduledDate: dayUTC(2026, 6, 16),
      responsibleAssistantId: A.id,
    },
  });
  await prisma.attendance.create({
    data: { sessionId: session.id, studentId: s1.id, status: "present", loggedById: B.id },
  });

  console.log(JSON.stringify({
    classId: klass.id,
    sessionId: session.id,
    ownerA: A.id,
    covererB: B.id,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
