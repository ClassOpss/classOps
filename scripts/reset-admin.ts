// Reset the super-admin password. Run from your machine against the target DB:
//   PowerShell:  $env:DATABASE_URL="<prod-postgres-url>"; npx tsx scripts/reset-admin.ts
// Optional:      $env:NEW_ADMIN_PASSWORD="something"   (defaults to 24032005)
//
// It resets every admin account's password and prints their email(s), so you also
// see the exact email to sign in with (useful if a typo'd email is the real issue).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const NEW_PASSWORD = process.env.NEW_ADMIN_PASSWORD ?? "24032005";

async function main() {
  const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true, email: true } });
  if (admins.length === 0) {
    console.log("No admin users found in this database.");
    return;
  }
  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  for (const a of admins) {
    await prisma.user.update({
      where: { id: a.id },
      data: { passwordHash, active: true, emailVerified: new Date() },
    });
    console.log(`✔ reset password for admin: ${a.email}`);
  }
  console.log(`\nSign in with the email shown above and password: ${NEW_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
