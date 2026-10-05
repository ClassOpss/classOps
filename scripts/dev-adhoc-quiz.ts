// Run: npx tsx scripts/dev-adhoc-quiz.ts [--cleanup]
// Adds a midterm off the biweekly cadence to the demo class so its quiz tasks can be checked.
import { prisma } from "../src/lib/db";
import { attachQuizTasks } from "../src/lib/quiz-assessment";

const CLASS = "529fa631-01bb-4dfc-aea9-73029c06c96d";
const LABEL = "Midterm (ad-hoc test)";

async function main() {
  if (process.argv.includes("--cleanup")) {
    const a = await prisma.assessment.findMany({ where: { classId: CLASS, label: LABEL }, select: { id: true } });
    await prisma.quizPrep.deleteMany({ where: { assessmentId: { in: a.map((x) => x.id) }, adHoc: true } });
    await prisma.assessment.deleteMany({ where: { id: { in: a.map((x) => x.id) } } });
    console.log("cleaned", a.length);
    return;
  }
  const a = await prisma.assessment.create({
    data: { classId: CLASS, type: "midterm", label: LABEL, topicNotes: "Algebra, Graphs", date: new Date("2026-10-15"), time: "16:00", maxMark: 50 },
  });
  await attachQuizTasks(a);
  console.log(await prisma.quizPrep.findUnique({ where: { assessmentId: a.id } }));
}
main().finally(() => prisma.$disconnect());
