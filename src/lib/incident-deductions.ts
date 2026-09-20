import type { IncidentType } from "@prisma/client";

// Some tasks are billed as a CAPPED GROUP: missing any member of the group costs a single
// lateDeduction, not one per member. Two such families today:
//   • DAILY  — attendance / parent_update / classroom_upload, capped per assistant+session-day
//              (missing one daily task is the same as missing all three that day).
//   • QUIZ   — quiz_prep / quiz_announcement, capped per assistant+quiz-cycle
//              (the whole quiz is one charge, however many of its sub-tasks were missed).
// Weekly tasks (hw_correction, grade_entry) are still charged per incident. The per-task
// incident rows are always kept (so admins see exactly what was missed); only the MONEY is
// capped here.
export const DAILY_INCIDENT_TYPES = ["attendance", "parent_update", "classroom_upload"] as const;
export const QUIZ_INCIDENT_TYPES = ["quiz_prep", "quiz_announcement"] as const;
const DAILY = new Set<IncidentType>(DAILY_INCIDENT_TYPES);
const QUIZ = new Set<IncidentType>(QUIZ_INCIDENT_TYPES);

export function isDailyIncidentType(type: IncidentType): boolean {
  return DAILY.has(type);
}

export type DeductibleIncident = {
  assistantId: string;
  sessionId: string | null;
  quizPrepId?: string | null;
  type: IncidentType;
  deductionAmount: number;
  waived: boolean;
};

// The group an incident is capped within, or null when it is charged per-incident.
function groupKey(i: DeductibleIncident): string | null {
  if (DAILY.has(i.type)) return `d|${i.assistantId}|${i.sessionId ?? ""}`;
  if (QUIZ.has(i.type)) return `q|${i.assistantId}|${i.quizPrepId ?? ""}`;
  return null;
}

// Total non-waived deductions, with each capped family charged once per group (the largest
// deduction in that group — in practice all equal the operation's lateDeduction).
export function effectiveDeductionTotal(incidents: DeductibleIncident[]): number {
  let total = 0;
  const grouped = new Map<string, number>();
  for (const i of incidents) {
    if (i.waived) continue;
    const g = groupKey(i);
    if (g) grouped.set(g, Math.max(grouped.get(g) ?? 0, i.deductionAmount));
    else total += i.deductionAmount;
  }
  for (const v of grouped.values()) total += v;
  return total;
}

// Per-incident effective charge (non-waived only), so a UI row can show whether it carries
// the money or is folded into its group's cap. For each capped group ONE incident carries
// the full charge and the rest carry 0. Summing this map equals effectiveDeductionTotal.
export function perIncidentCharge<T extends { id: string } & DeductibleIncident>(
  incidents: T[],
): Map<string, number> {
  const charge = new Map<string, number>();
  const carrier = new Map<string, T>(); // groupKey -> incident currently carrying the charge
  for (const i of incidents) {
    if (i.waived) {
      charge.set(i.id, 0);
      continue;
    }
    const g = groupKey(i);
    if (!g) {
      charge.set(i.id, i.deductionAmount);
      continue;
    }
    const cur = carrier.get(g);
    if (!cur || i.deductionAmount > cur.deductionAmount) {
      if (cur) charge.set(cur.id, 0);
      carrier.set(g, i);
      charge.set(i.id, i.deductionAmount);
    } else {
      charge.set(i.id, 0);
    }
  }
  return charge;
}
