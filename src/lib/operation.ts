import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { OPERATION_DEFAULTS, operationConfig, type OperationConfig } from "@/lib/config";

// The operation seeded by migration 20260621193000 — the home of all existing
// single-tenant data ("Math by Mo").
export const DEFAULT_OPERATION_ID = "00000000-0000-0000-0000-000000000001";

// Cookie the super-admin's operation switcher writes (chunk 4). Teachers + assistants
// ignore it — they are hard-scoped to their own operation.
export const ACTIVE_OPERATION_COOKIE = "active_operation";

// The operation the current request acts within. Every write that stamps operationId
// and every scoped read goes through here.
//   - teacher / assistant: their own operationId (from the session, immutable)
//   - super-admin (operationId null): the active-operation cookie, else the first
//     operation (the only one until more teachers are onboarded)
export const currentOperationId = cache(async (): Promise<string> => {
  const session = await auth();
  const own = session?.user?.operationId ?? null;
  if (own) return own;

  const active = (await cookies()).get(ACTIVE_OPERATION_COOKIE)?.value;
  if (active) {
    const exists = await prisma.operation.findUnique({ where: { id: active }, select: { id: true } });
    if (exists) return exists.id;
  }
  const first = await prisma.operation.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? DEFAULT_OPERATION_ID;
});

export async function getOperation(id: string) {
  return prisma.operation.findUnique({ where: { id } });
}

// Write-path guard: throw if `classId` isn't in the request's current operation.
// Blocks a scoped user (teacher) from mutating another operation's data via a
// crafted classId. Returns the resolved operationId for convenience.
export async function assertClassInOperation(classId: string): Promise<string> {
  const operationId = await currentOperationId();
  const klass = await prisma.class.findUnique({
    where: { id: classId },
    select: { operationId: true },
  });
  if (!klass || klass.operationId !== operationId) {
    throw new Error("Not found in this operation.");
  }
  return operationId;
}

// Load a specific operation's config (used where the operation is known explicitly,
// e.g. the cron processing every operation, or pay for a given assistant's operation).
// Memoized per request so repeated lookups for the same operation hit once.
export const resolveConfigFor = cache(async (operationId: string): Promise<OperationConfig> => {
  const op = await prisma.operation.findUnique({ where: { id: operationId } });
  return op ? operationConfig(op) : { ...OPERATION_DEFAULTS };
});

// Config for the current request's operation. Falls back to defaults if none resolves.
export async function resolveConfig(): Promise<OperationConfig> {
  return resolveConfigFor(await currentOperationId());
}
