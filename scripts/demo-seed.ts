// Self-contained demo for Math by Mo: a fully-populated class + a test teacher and
// test assistant (known passwords) so you can log in and see both POVs. Idempotent:
// re-running wipes and rebuilds the demo objects only. Your real data is untouched.
//
// Run against ANY database (local to preview, or prod to demo live):
//   PowerShell:  $env:DATABASE_URL="<db-url>"; npx tsx scripts/demo-seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const OP = "00000000-0000-0000-0000-000000000001"; // Math by Mo
const PASSWORD = "Demo1234!";
const TEACHER_EMAIL = "demo.teacher@classops.app";
const ASSISTANT_EMAIL = "demo.assistant@classops.app";
const CLASS_NAME = "Demo — Y9 Stars";
const SCHOOL_NAME = "Demo Academy";

function sundaysBack(count: number): Date[] {
  // `count` weekly dates ending at the most recent past Sunday (all in the past).
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 7) % 7 || 7)); // last Sunday (strictly past)
  const out: Date[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - i * 7);
    out.push(x);
  }
  return out;
}

async function ensureUser(email: string, name: string, role: "teacher" | "assistant") {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, active: true, role, operationId: OP, emailVerified: new Date() },
    create: { email, name, role, active: true, operationId: OP, emailVerified: new Date(), passwordHash },
  });
}

async function main() {
  // --- accounts ---
  await ensureUser(TEACHER_EMAIL, "Demo Teacher", "teacher");
  const assistantUser = await ensureUser(ASSISTANT_EMAIL, "Demo Assistant", "assistant");
  const assistant = await prisma.assistant.upsert({
    where: { userId: assistantUser.id },
    update: { active: true, operationId: OP },
    create: { userId: assistantUser.id, name: "Demo Assistant", email: ASSISTANT_EMAIL, operationId: OP },
  });

  // --- clean previous demo class (cascades its sessions/students/etc.) ---
  await prisma.class.deleteMany({ where: { operationId: OP, name: CLASS_NAME } });
  const school =
    (await prisma.school.findFirst({ where: { operationId: OP, name: SCHOOL_NAME } })) ??
    (await prisma.school.create({ data: { operationId: OP, name: SCHOOL_NAME } }));

  const dates = sundaysBack(6);
  const klass = await prisma.class.create({
    data: {
      operationId: OP,
      schoolId: school.id,
      yearGroup: "Y9",
      name: CLASS_NAME,
      schedule: { slots: [{ day: "Sunday", time: "16:00" }] },
      planStartDate: dates[0],
      googleClassroomLink: "https://classroom.google.com/c/DEMO",
      studentGroupLink: "https://chat.whatsapp.com/DEMOstudents",
      parentCommunityLink: "https://chat.whatsapp.com/DEMOparents",
    },
  });

  // --- students (with contacts) ---
  const names = ["Youssef Adel", "Malak Hisham", "Omar Tarek", "Nour Sameh", "Ali Mostafa", "Farida Wael"];
  const students = [];
  for (let i = 0; i < names.length; i++) {
    students.push(
      await prisma.student.create({
        data: {
          classId: klass.id,
          name: names[i],
          code: `D${1000 + i}`,
          email: `${names[i].split(" ")[0].toLowerCase()}@student.demo`,
          phone: `010000000${i}0`,
          parentName: `Parent of ${names[i].split(" ")[0]}`,
          parentPhone: `011000000${i}0`,
        },
      }),
    );
  }
  await prisma.class.update({ where: { id: klass.id }, data: { studentCount: students.length } });
  await prisma.classAssignment.create({
    data: { classId: klass.id, assistantId: assistant.id, startDate: dates[0] },
  });

  // --- lesson plan (Y9) + items, and dated sessions with attendance ---
  const topics = await prisma.topic.findMany({
    where: { operationId: OP, yearGroup: "Y9" },
    orderBy: { sortOrder: "asc" },
    take: dates.length,
  });
  const plan =
    (await prisma.lessonPlan.findUnique({ where: { operationId_yearGroup: { operationId: OP, yearGroup: "Y9" } } })) ??
    (await prisma.lessonPlan.create({ data: { operationId: OP, yearGroup: "Y9" } }));

  for (let i = 0; i < dates.length; i++) {
    const topic = topics[i % Math.max(topics.length, 1)];
    const session = await prisma.classSession.create({
      data: {
        classId: klass.id,
        lessonNumber: i + 1,
        scheduledDate: dates[i],
        topicId: topic?.id ?? null,
        responsibleAssistantId: assistant.id,
        messageNotes: i === dates.length - 1 ? "Quiz next week — revise!" : null,
      },
    });
    // attendance: mostly present, a couple absences sprinkled in
    for (let s = 0; s < students.length; s++) {
      const absent = (i + s) % 7 === 0;
      await prisma.attendance.create({
        data: {
          sessionId: session.id,
          studentId: students[s].id,
          status: absent ? "absent" : "present",
          loggedById: assistant.id,
        },
      });
    }
    // parent update + classroom upload logged (so tasks look complete)
    await prisma.parentUpdateLog.create({ data: { sessionId: session.id, assistantId: assistant.id } });
    await prisma.classroomUploadLog.create({ data: { sessionId: session.id, assistantId: assistant.id } });
  }

  // --- a graded quiz ---
  const quiz = await prisma.assessment.create({
    data: {
      classId: klass.id,
      type: "quiz",
      label: "Algebra Quiz 1",
      date: dates[3],
      maxMark: 20,
      topicId: topics[0]?.id ?? null,
    },
  });
  for (let s = 0; s < students.length; s++) {
    const raw = 10 + ((s * 3) % 11); // 10..20
    await prisma.assessmentGrade.create({
      data: {
        assessmentId: quiz.id,
        studentId: students[s].id,
        rawMark: raw,
        percentage: (raw / 20) * 100,
        loggedById: assistant.id,
      },
    });
  }

  // --- a homework with submissions ---
  const hw = await prisma.homeworkAssignment.create({
    data: { sessionId: (await prisma.classSession.findFirst({ where: { classId: klass.id }, orderBy: { scheduledDate: "asc" } }))!.id, classId: klass.id, description: "Exercise 3A, Q1–10", deadline: dates[1] },
  });
  const weak = ["factorising", "sign errors", "", "word problems", "", "fractions"];
  for (let s = 0; s < students.length; s++) {
    const status = s % 5 === 0 ? "missing" : s % 3 === 0 ? "late" : "on_time";
    await prisma.homeworkSubmission.create({
      data: {
        homeworkId: hw.id,
        studentId: students[s].id,
        submissionDate: status === "missing" ? null : dates[1],
        status: status as "on_time" | "late" | "missing",
        weakPoints: weak[s] || null,
        loggedById: assistant.id,
      },
    });
  }

  // --- an office hour ---
  await prisma.officeHourSession.create({
    data: { classId: klass.id, assistantId: assistant.id, studentId: students[0].id, date: dates[4], topicNotes: "Extra help with equations", durationMin: 45 },
  });

  console.log(
    JSON.stringify(
      {
        classId: klass.id,
        students: students.length,
        sessions: dates.length,
        login: { teacher: TEACHER_EMAIL, assistant: ASSISTANT_EMAIL, password: PASSWORD },
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
