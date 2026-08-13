"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { currentOperationId } from "@/lib/operation";
import { logActivity } from "@/lib/activity";

export type BrandingState = { ok?: boolean; error?: string } | undefined;

const MAX_BYTES = 1_000_000; // 1 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// Teacher (or super-admin, for the active operation) uploads/replaces the operation logo.
export async function uploadLogo(_prev: BrandingState, formData: FormData): Promise<BrandingState> {
  const user = await requireRole("admin", "teacher");
  const operationId = await currentOperationId();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file." };
  if (!ALLOWED.includes(file.type)) return { error: "Use a PNG, JPG, WEBP, or SVG image." };
  if (file.size > MAX_BYTES) return { error: "Image must be under 1 MB." };

  const bytes = Buffer.from(await file.arrayBuffer());
  await prisma.operation.update({
    where: { id: operationId },
    data: { logoData: bytes, logoMime: file.type },
  });
  await logActivity({
    actorId: user.id,
    actorRole: user.role,
    action: "updated_logo",
    entityType: "operation",
    entityId: operationId,
  });
  revalidatePath("/settings");
  return { ok: true };
}

// Clear an uploaded logo -> falls back to the file-based logoPath default.
export async function removeLogo(): Promise<void> {
  await requireRole("admin", "teacher");
  const operationId = await currentOperationId();
  await prisma.operation.update({
    where: { id: operationId },
    data: { logoData: null, logoMime: null },
  });
  revalidatePath("/settings");
}

// Set the operation's invite "from" email. Must be verified in Brevo to send truly
// from it; otherwise it becomes the Reply-To behind the platform fallback sender.
export async function setSenderEmail(_prev: BrandingState, formData: FormData): Promise<BrandingState> {
  await requireRole("admin", "teacher");
  const operationId = await currentOperationId();
  const raw = String(formData.get("senderEmail") ?? "").trim();
  if (raw && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) return { error: "Enter a valid email." };
  await prisma.operation.update({
    where: { id: operationId },
    data: { senderEmail: raw || null },
  });
  revalidatePath("/settings");
  return { ok: true };
}
