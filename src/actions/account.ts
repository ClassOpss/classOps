"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guards";
import { consumeSetupToken, createSetupToken, setupUrl } from "@/lib/tokens";
import { sendEmail, resolveOperationSender, platformSender, actionEmail } from "@/lib/email";

export type SetPasswordState = { error: string } | undefined;
export type PwState = { ok?: boolean; error?: string } | undefined;

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

// Logged-in user changes their own password (any role).
export async function changePassword(_prev: PwState, formData: FormData): Promise<PwState> {
  const sessionUser = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords do not match." };

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  await prisma.user.update({
    where: { id: sessionUser.id },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  return { ok: true };
}

// Public: request a password-reset link. Always returns ok (never reveals whether an
// account exists) — but only actually emails a link for a real, active account.
export async function requestPasswordReset(_prev: PwState, formData: FormData): Promise<PwState> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email." };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, active: true, operationId: true },
  });
  if (user && user.active) {
    const url = setupUrl(email, await createSetupToken(email));
    const sender = user.operationId
      ? await resolveOperationSender(user.operationId)
      : platformSender();
    if (sender) {
      const { html, text } = actionEmail({
        brandName: sender.fromName,
        heading: "Reset your password",
        intro: "Click below to set a new password. If you didn't request this, you can ignore this email.",
        buttonLabel: "Reset password",
        url,
        footer: "This link expires in 72 hours.",
      });
      await sendEmail({
        to: email,
        toName: user.name,
        subject: "Reset your ClassOps password",
        html,
        text,
        fromEmail: sender.fromEmail,
        fromName: sender.fromName,
        replyTo: sender.replyTo,
      });
    }
  }
  return { ok: true };
}
