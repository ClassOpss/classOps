import type { IncidentType } from "@prisma/client";

// The three per-session DAILY tasks. Missing any of them costs a single lateDeduction
// for that assistant+session-day: missing one is the same as missing all three — the
// whole day is one flat charge. Weekly tasks (hw_correction, grade_entry) are still
// charged per incident. The per-task incident rows are kept (so admins see exactly what
// was missed); only the MONEY is capped here.
export const DAILY_INCIDENT_TYPES = ["attendance", "parent_update", "classroom_upload"] as const;
const DAILY = new Set<IncidentType>(DAILY_INCIDENT_TYPES);

export function isDailyIncidentType(type: IncidentType): boolean {
  return DAILY.has(type);
}

export type DeductibleIncident = {
  assistantId: string;
  sessionId: string | null;
  type: IncidentType;
  deductionAmount: number;
  waived: boolean;
};

function dayKey(i: { assistantId: string; sessionId: string | null }): string {
  return `${i.assistantId}|${i.sessionId ?? ""}`;
}

// Total non-waived deductions, with daily tasks capped at ONE charge per
// assistant+session-day (the largest daily deduction in that day — in practice they are
// all equal to the operation's lateDeduction).
export function effectiveDeductionTotal(incidents: DeductibleIncident[]): number {
  let total = 0;
  const dailyDay = new Map<string, number>();
  for (const i of incidents) {
    if (i.waived) continue;
    if (DAILY.has(i.type)) {
      const k = dayKey(i);
      dailyDay.set(k, Math.max(dailyDay.get(k) ?? 0, i.deductionAmount));
    } else {
      total += i.deductionAmount;
    }
  }
  for (const v of dailyDay.values()) total += v;
  return total;
}

// Per-incident effective charge (non-waived only), so a UI row can show whether it
// carries the money or is folded into its day's cap. For each daily day-group ONE
// incident carries the full charge and the rest carry 0. Summing this map equals
// effectiveDeductionTotal over the same list.
export function perIncidentCharge<T extends { id: string } & DeductibleIncident>(
  incidents: T[],
): Map<string, number> {
  const charge = new Map<string, number>();
  const carrier = new Map<string, T>(); // dayKey -> incident currently carrying the charge
  for (const i of incidents) {
    if (i.waived) {
      charge.set(i.id, 0);
      continue;
    }
    if (!DAILY.has(i.type)) {
      charge.set(i.id, i.deductionAmount);
      continue;
    }
    const k = dayKey(i);
    const cur = carrier.get(k);
    if (!cur || i.deductionAmount > cur.deductionAmount) {
      if (cur) charge.set(cur.id, 0);
      carrier.set(k, i);
      charge.set(i.id, i.deductionAmount);
    } else {
      charge.set(i.id, 0);
    }
  }
  return charge;
}
