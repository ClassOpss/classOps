// Dev helper: reproduces a mid-year roster switch (the "false cover" bug).
// Class "ZZ-Switch" (Tue+Thu). Before today: Belal (Tue) + Old (Thu); Old logged past
// Thursdays. Today Old leaves and Omar joins. The buggy re-stamp then made Omar the owner
// of PAST Thursdays -> Old's logs showed as covers. Run: npx tsx scripts/dev-switch.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const OP = "00000000-0000-0000-0000-000000000001";
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day));

async function ensureAssistant(email: string, name: string) {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { active: true, role: "assistant", operationId: OP },
    create: { email, name, role: "assistant", active: true, emailVerified: new Date(), passwordHash, operationId: OP },
  });
  return prisma.assistant.upsert({
    where: { userId: user.id },
    update: { active: true },
    create: { userId: user.id, name, email, operationId: OP },
  });
}

async function main() {
  const belal = await ensureAssistant("zz-belal@classops.local", "ZZ Belal");
  const old = await ensureAssistant("zz-old@classops.local", "ZZ Old");
  const omar = await ensureAssistant("zz-omar@classops.local", "ZZ Omar");
  const school =
    (await prisma.school.findFirst({ where: { name: "ZZ-Cov-School" } })) ??
    (await prisma.school.create({ data: { name: "ZZ-Cov-School", operationId: OP } }));

  await prisma.class.deleteMany({ where: { name: "ZZ-Switch" } });
  const klass = await prisma.class.create({
    data: {
      operationId: OP, schoolId: school.id, yearGroup: "Y9", name: "ZZ-Switch",
      schedule: { days: ["Tuesday", "Thursday"], time: "16:00" }, planStartDate: d(2026, 9, 1), studentCount: 1,
    },
  });
  const st = await prisma.student.create({ data: { classId: klass.id, name: "Switch One", code: "S1" } });
  const today = d(2026, 10, 2);
  await prisma.classAssignment.createMany({
    data: [
      { classId: klass.id, assistantId: belal.id, startDate: d(2026, 9, 1) },
      { classId: klass.id, assistantId: old.id, startDate: d(2026, 9, 1), endDate: today },
      { classId: klass.id, assistantId: omar.id, startDate: today },
    ],
  });

  // Sep 1 (Tue) .. Oct 29 (Thu): Tue+Thu sessions.
  let n = 0;
  for (let t = d(2026, 9, 1); t <= d(2026, 10, 29); t = new Date(t.getTime() + 86400000)) {
    const wd = t.getUTCDay();
    if (wd !== 2 && wd !== 4) continue;
    const past = t < today;
    // Buggy state: everything re-stamped to TODAY's roster (Belal Tue, Omar Thu).
    const owner = wd === 2 ? belal.id : omar.id;
    const s = await prisma.classSession.create({
      data: { classId: klass.id, lessonNumber: ++n, scheduledDate: t, responsibleAssistantId: owner },
    });
    if (past) {
      await prisma.attendance.create({
        data: { sessionId: s.id, studentId: st.id, status: "present", loggedById: wd === 2 ? belal.id : old.id },
      });
    }
  }
  console.log("ZZ-Switch seeded:", klass.id, "sessions:", n);
}
main().finally(() => prisma.$disconnect());
