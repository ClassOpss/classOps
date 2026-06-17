// Dev-only helper: creates a teacher and an assistant account for testing role gates.
// Run: npx tsx scripts/dev-users.ts   (password for both: ChangeMe123!)
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@classops.local" },
    update: { passwordHash, active: true, role: "teacher" },
    create: {
      email: "teacher@classops.local",
      name: "Test Teacher",
      role: "teacher",
      active: true,
      emailVerified: new Date(),
      passwordHash,
    },
  });

  const assistantUser = await prisma.user.upsert({
    where: { email: "assistant@classops.local" },
    update: { passwordHash, active: true, role: "assistant" },
    create: {
      email: "assistant@classops.local",
      name: "Test Assistant",
      role: "assistant",
      active: true,
      emailVerified: new Date(),
      passwordHash,
    },
  });

  await prisma.assistant.upsert({
    where: { userId: assistantUser.id },
    update: {},
    create: {
      userId: assistantUser.id,
      name: "Test Assistant",
      email: assistantUser.email,
    },
  });

  console.log("teacher:", teacher.email, "| assistant:", assistantUser.email);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
