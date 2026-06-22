import { cache } from "react";
import { prisma } from "@/lib/db";
import { OPERATION_DEFAULTS, operationConfig, type OperationConfig } from "@/lib/config";

// The operation seeded by migration 20260621193000 — the home of all existing
// single-tenant data ("Math by Mo").
export const DEFAULT_OPERATION_ID = "00000000-0000-0000-0000-000000000001";

// The operation the current request acts within.
//
// Chunk 1 (foundation): always the default operation. Chunk 3 upgrades this to
// resolve from the signed-in user (teacher/assistant -> their operationId) or the
// super-admin's active-operation cookie. Every write that stamps operationId and
// every scoped read goes through here, so that swap is localized.
export async function currentOperationId(): Promise<string> {
  return DEFAULT_OPERATION_ID;
}

export async function getOperation(id: string) {
  return prisma.operation.findUnique({ where: { id } });
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
