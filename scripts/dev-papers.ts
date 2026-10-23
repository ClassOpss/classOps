// Dev-only: seeds a paper-ownership test on "Demo — Y9 Stars" (2 assistants): alphabetical
// sub-groups (if none) + an ungraded assessment "ZZ Papers test" dated this Tuesday.
// Run: npx tsx scripts/dev-papers.ts [clean]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const LABEL = "ZZ Papers test";
const MARK = "dev-papers"; // sub-assignments we create start on this date, so clean can find them
const START = new Date("2020-01-01");

async function main() {
  const klass = await prisma.class.findFirstOrThrow({ where: { name: "Demo — Y9 Stars" }, select: { id: true } });
  if (process.argv[2] === "clean") {
    await prisma.assessment.deleteMany({ where: { classId: klass.id, label: LABEL } });
    await prisma.studentAssistantAssignment.deleteMany({ where: { classId: klass.id, startDate: START } });
    console.log("cleaned");
    return;
  }
  const assistants = await prisma.classAssignment.findMany({
    where: { classId: klass.id, endDate: null },
    orderBy: { startDate: "asc" },
    select: { assistantId: true },
  });
  const subs = await prisma.studentAssistantAssignment.count({ where: { classId: klass.id, endDate: null } });
  if (subs === 0) {
    const students = await prisma.student.findMany({ where: { classId: klass.id, active: true }, orderBy: { name: "asc" }, select: { id: true } });
    const half = Math.ceil(students.length / 2);
    await prisma.studentAssistantAssignment.createMany({
      data: students.map((s, i) => ({
        classId: klass.id,
        studentId: s.id,
        assistantId: assistants[i < half ? 0 : 1].assistantId,
        startDate: START,
      })),
    });
  }
  await prisma.assessment.deleteMany({ where: { classId: klass.id, label: LABEL } });
  const a = await prisma.assessment.create({
    data: { classId: klass.id, type: "quiz", label: LABEL, date: new Date("2026-10-20"), maxMark: 20 },
  });
  console.log(MARK, "assessment", a.id, "class", klass.id);
}

main().finally(() => prisma.$disconnect());
