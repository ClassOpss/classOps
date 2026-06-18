// Dev helper: Y9-Citadel under Citadel + 5 students (for testing auto-divide).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst({ where: { name: "Citadel" } });
  if (!school) throw new Error("Seed schools first.");

  let klass = await prisma.class.findFirst({ where: { name: "Y9-Citadel" } });
  if (!klass) {
    klass = await prisma.class.create({
      data: {
        schoolId: school.id,
        yearGroup: "Y9",
        name: "Y9-Citadel",
        schedule: { day: "Sunday", time: "16:00" },
        planStartDate: new Date("2026-09-13"),
      },
    });
  }

  const names = ["Aaron Said", "Bob Nabil", "Carol Wagdy", "Dan Fouad", "Eve Magdy"];
  let i = 1;
  for (const name of names) {
    const exists = await prisma.student.findFirst({ where: { classId: klass.id, name } });
    if (!exists) {
      await prisma.student.create({ data: { classId: klass.id, name, code: `C${i}` } });
    }
    i++;
  }
  await prisma.class.update({
    where: { id: klass.id },
    data: { studentCount: await prisma.student.count({ where: { classId: klass.id, active: true } }) },
  });

  const assistants = await prisma.assistant.findMany({ select: { name: true, email: true } });
  process.stdout.write(JSON.stringify({ classId: klass.id, assistants }));
}

main().finally(() => prisma.$disconnect());
