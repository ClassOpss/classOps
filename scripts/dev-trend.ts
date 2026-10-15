// Dev helper: seed 5 quizzes + 6 homeworks into the test assistant's first class so
// the trend badges/chart have data. One student improving, one slipping, rest steady.
// Run: npx tsx scripts/dev-trend.ts        (seed)
//      npx tsx scripts/dev-trend.ts clean  (remove everything it created)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const TAG = "[trend-dev]";

async function main() {
  if (process.argv[2] === "clean") {
    const a = await prisma.assessment.deleteMany({ where: { topicNotes: TAG } });
    const h = await prisma.homeworkAssignment.deleteMany({ where: { description: { startsWith: TAG } } });
    console.log(`removed ${a.count} assessments, ${h.count} homeworks`);
    return;
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "assistant@classops.local" } });
  const asst = await prisma.assistant.findFirstOrThrow({ where: { userId: user.id } });
  const asg = await prisma.classAssignment.findFirstOrThrow({
    where: { assistantId: asst.id, endDate: null, class: { active: true } },
    include: { class: { include: { students: { where: { active: true }, orderBy: { name: "asc" } } } } },
  });
  const students = asg.class.students;
  if (students.length < 2) throw new Error("need 2+ students");
  const day = (n: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d; };

  // gaps: students[0] improving, students[1] slipping, others ~class
  for (let q = 0; q < 5; q++) {
    const a = await prisma.assessment.create({
      data: { classId: asg.classId, type: "quiz", label: `Trend Quiz ${q + 1}`, date: day(70 - q * 14), maxMark: 100, topicNotes: TAG },
    });
    const base = [70, 55, 65, 50, 60][q]; // varying difficulty
    await prisma.assessmentGrade.createMany({
      data: students.map((s, i) => {
        const pct = i === 0 ? base - 15 + q * 8 : i === 1 ? base + 15 - q * 9 : base + ((i * 7) % 5) - 2;
        const p = Math.max(0, Math.min(100, pct));
        return { assessmentId: a.id, studentId: s.id, rawMark: p, percentage: p, loggedById: asst.id };
      }),
    });
  }
  const outcomes = (i: number, k: number) =>
    i === 0 ? (k < 3 ? "missing" : "on_time") : i === 1 ? (k < 3 ? "on_time" : k === 3 ? "late" : "missing") : "on_time";
  for (let k = 0; k < 6; k++) {
    const hw = await prisma.homeworkAssignment.create({
      data: { classId: asg.classId, description: `${TAG} HW ${k + 1}`, deadline: day(50 - k * 7) },
    });
    await prisma.homeworkSubmission.createMany({
      data: students.map((s, i) => {
        const status = outcomes(i, k) as "on_time" | "late" | "missing";
        return {
          homeworkId: hw.id, studentId: s.id, status, loggedById: asst.id,
          submissionDate: status === "missing" ? null : hw.deadline,
        };
      }),
    });
  }
  console.log(`seeded class ${asg.class.name} (${asg.classId}); improving=${students[0].name} slipping=${students[1].name}`);
}
main().finally(() => prisma.$disconnect());
