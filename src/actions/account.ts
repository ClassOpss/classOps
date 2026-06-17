"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { consumeSetupToken } from "@/lib/tokens";

export type SetPasswordState = { error: string } | undefined;

// Assistant/teacher self-setup: validate the invite token, then set the password.
export async function setPassword(
  _prev: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const valid = await consumeSetupToken(email, token);
  if (!valid) {
    return { error: "This setup link is invalid or has expired. Ask the admin to resend it." };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { error: "Account not found." };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { email },
    data: { passwordHash, emailVerified: new Date(), active: true },
  });

  redirect("/login?setup=done");
}
