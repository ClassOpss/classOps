// Dev helper: seed 6 quizzes + 10 homeworks into the test assistant's first class so
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
  for (let q = 0; q < 6; q++) {
    const a = await prisma.assessment.create({
      data: {
        classId: asg.classId,
        // Q4 is a mock (diagnostic) — included in the trends table, excluded from averages.
        type: q === 3 ? "past_paper" : "quiz",
        isDiagnostic: q === 3,
        label: q === 3 ? "Mock" : `Trend Quiz ${q + 1}`,
        date: day(84 - q * 14),
        maxMark: 100,
        topicNotes: TAG,
        gradeBoundaries: q % 2 === 0 ? [{ grade: "A*", min: 85 }, { grade: "A", min: 75 }, { grade: "B", min: 65 }, { grade: "C", min: 55 }, { grade: "D", min: 45 }, { grade: "E", min: 35 }] : undefined,
      },
    });
    const base = [70, 55, 65, 50, 60, 68][q]; // varying difficulty
    await prisma.assessmentGrade.createMany({
      data: students.map((s, i) => {
        // 0: from below class to above. 1: from above to below. Rest: steady, with quiz-to-quiz wobble.
        // 2: steady then a sudden crash on the last quiz. 3: well below 50 (remedial).
        const pct =
          i === 0 ? base - 18 + q * 7
          : i === 1 ? base + 15 - q * 7
          : i === 2 ? (q === 5 ? 18 : base + 8)
          : i === 3 ? base - 25
          : base + (((i + q) * 7) % 11) - 5;
        const p = Math.max(0, Math.min(100, pct));
        return { assessmentId: a.id, studentId: s.id, rawMark: p, percentage: p, loggedById: asst.id };
      }),
    });
  }
  // 0: missing early, then hands everything in. 1: clean, then 3 of the last 4 missed.
  // 2: clean with ONE recent miss (must stay steady). Rest: clean.
  const outcomes = (i: number, k: number) =>
    i === 0 ? (k < 4 ? (k % 2 ? "late" : "missing") : "on_time")
    : i === 1 ? (k < 6 ? "on_time" : k === 7 ? "late" : "missing")
    : i === 2 ? (k === 8 ? "missing" : "on_time")
    : "on_time";
  for (let k = 0; k < 10; k++) {
    const hw = await prisma.homeworkAssignment.create({
      data: { classId: asg.classId, description: `${TAG} HW ${k + 1}`, deadline: day(75 - k * 7) },
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
