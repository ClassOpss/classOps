import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";

const INVITE_TTL_MS = 1000 * 60 * 60 * 72; // 72 hours

// Create a single-use setup/reset token for an email (replaces any existing one).
export async function createSetupToken(email: string, ttlMs = INVITE_TTL_MS): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + ttlMs) },
  });
  return token;
}

// Validate + consume a token. Returns true only if it matches the email and is unexpired.
export async function consumeSetupToken(email: string, token: string): Promise<boolean> {
  const vt = await prisma.verificationToken.findUnique({ where: { token } });
  if (!vt || vt.identifier !== email) return false;
  // Always remove the token once looked up (single-use), even if expired.
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});
  return vt.expires >= new Date();
}

export function setupUrl(email: string, token: string): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const url = new URL("/set-password", base);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
}
