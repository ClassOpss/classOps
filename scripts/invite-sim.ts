// Test helper: mirrors the DB effects of inviteOne() / consumeSetupToken() + setPassword()
// without importing the `server-only` modules. Drives the invite -> set-password chain
// so we can verify login behavior against the real auth endpoint.
//   tsx scripts/invite-sim.ts invite <email>
//   tsx scripts/invite-sim.ts consume <email> <token> <password>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function invite(email: string) {
  email = email.toLowerCase();
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "assistant", active: true, passwordHash: null },
    create: {
      email,
      name: email.split("@")[0],
      role: "assistant",
      active: true,
      assistant: { create: { name: email.split("@")[0], email } },
    },
  });
  if (!(await prisma.assistant.findUnique({ where: { userId: user.id } }))) {
    await prisma.assistant.create({ data: { userId: user.id, name: email.split("@")[0], email } });
  }
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + 72 * 3600 * 1000) },
  });
  process.stdout.write(token);
}

async function consume(email: string, token: string, password: string) {
  email = email.toLowerCase();
  const vt = await prisma.verificationToken.findUnique({ where: { token } });
  if (!vt || vt.identifier !== email) {
    process.stdout.write("FAIL_TOKEN");
    return;
  }
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
  if (vt.expires < new Date()) {
    process.stdout.write("FAIL_EXPIRED");
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash, emailVerified: new Date(), active: true },
  });
  process.stdout.write("OK");
}

async function main() {
  const [cmd, email, token, password] = process.argv.slice(2);
  if (cmd === "invite") await invite(email);
  else if (cmd === "consume") await consume(email, token, password);
  else process.stdout.write("usage: invite <email> | consume <email> <token> <password>");
}

main().finally(() => prisma.$disconnect());
