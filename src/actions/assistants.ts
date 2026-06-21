"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { createSetupToken, setupUrl } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";
import { currentOperationId } from "@/lib/operation";

const emailSchema = z.string().email();

export type InviteLink = { email: string; url: string };
export type InviteState =
  | { ok: true; links: InviteLink[] }
  | { ok: false; error: string }
  | undefined;

// Create (or top up) an assistant account and return a setup link.
// In v1 there's no SMTP, so the admin copies the link to the assistant (email send
// can be slotted in later without changing this flow).
async function inviteOne(name: string, rawEmail: string, operationId: string): Promise<InviteLink> {
  const email = rawEmail.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { assistant: true },
  });

  let userId: string;
  if (existing) {
    userId = existing.id;
    if (!existing.assistant) {
      await prisma.assistant.create({ data: { userId, name, email, operationId } });
    }
  } else {
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: "assistant",
        active: true,
        operationId,
        assistant: { create: { name, email, operationId } },
      },
    });
    userId = user.id;
  }

  const token = await createSetupToken(email);
  return { email, url: setupUrl(email, token) };
}

export async function inviteAssistantAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requireRole("admin");
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!emailSchema.safeParse(email).success) return { ok: false, error: "Enter a valid email." };

  const link = await inviteOne(name, email, await currentOperationId());
  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "invited_assistant",
    entityType: "user",
    entityId: link.email,
  });
  revalidatePath("/users");
  return { ok: true, links: [link] };
}

export async function bulkInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const admin = await requireRole("admin");
  const raw = String(formData.get("emails") ?? "");
  const emails = Array.from(
    new Set(
      raw
        .split(/[\n,;]+/)
        .map((e) => e.toLowerCase().trim())
        .filter(Boolean),
    ),
  );

  if (emails.length === 0) return { ok: false, error: "Paste at least one email." };
  const invalid = emails.filter((e) => !emailSchema.safeParse(e).success);
  if (invalid.length) return { ok: false, error: `Invalid email(s): ${invalid.join(", ")}` };

  const operationId = await currentOperationId();
  const links: InviteLink[] = [];
  for (const email of emails) {
    // No name provided in bulk — derive a placeholder from the local part.
    const placeholder = email.split("@")[0];
    links.push(await inviteOne(placeholder, email, operationId));
  }

  await logActivity({
    actorId: admin.id,
    actorRole: admin.role,
    action: "invited_assistants_bulk",
    entityType: "user",
    metadata: { count: links.length },
  });
  revalidatePath("/users");
  return { ok: true, links };
}
