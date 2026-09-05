import "server-only";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const RESET_TTL_MS = 1000 * 60 * 60 * 72; // 72 hours (password resets)
export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days (onboarding invites)

// Create a single-use setup/reset token for an email. Prior *unexpired* links for the
// same email stay valid — so re-sending an invite no longer breaks the earlier link the
// person may already have open (a common onboarding trap). Only expired tokens are cleared.
export async function createSetupToken(email: string, ttlMs = RESET_TTL_MS): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.deleteMany({
    where: { identifier: email, expires: { lt: new Date() } },
  });
  await prisma.verificationToken.create({
    data: { identifier: email, token, expires: new Date(Date.now() + ttlMs) },
  });
  return token;
}

export type ConsumeResult = "ok" | "not_found" | "expired";

// Validate + consume a token. `token` is trimmed to survive stray whitespace/newlines
// picked up when a link is copied through email or chat. Returns why it failed so the
// UI can give an actionable message.
export async function consumeSetupToken(email: string, token: string): Promise<ConsumeResult> {
  const clean = token.trim();
  if (!clean) return "not_found";
  const vt = await prisma.verificationToken.findUnique({ where: { token: clean } });
  if (!vt || vt.identifier !== email) return "not_found";
  // Single-use: remove it once matched, even if expired.
  await prisma.verificationToken.delete({ where: { token: clean } }).catch(() => {});
  return vt.expires >= new Date() ? "ok" : "expired";
}

export function setupUrl(email: string, token: string): string {
  const base = process.env.AUTH_URL ?? "http://localhost:3000";
  const url = new URL("/set-password", base);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
}
