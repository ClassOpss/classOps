// Daily-task ownership per session (see task-division-model). Given a class's sessions and
// its (ordered) assistants, decide who is responsible for each session's daily tasks:
//   • 1 assistant  -> all sessions are theirs.
//   • 2 assistants, MULTIPLE weekdays (e.g. Tue + Thu) -> each weekday is owned by one
//     assistant (Tue -> A, Thu -> B), so A owns every Tuesday, B every Thursday.
//   • 2 assistants, a SINGLE weekday -> alternate week by week (A, B, A, B …).
// Day-off sessions have no owner (null). Returns owners aligned to the input order.
export function assignResponsibilities<T extends { scheduledDate: Date; dayOff: boolean }>(
  sessions: T[],
  assistantIds: string[],
): (string | null)[] {
  const n = sessions.length;
  if (assistantIds.length === 0) return new Array(n).fill(null);
  if (assistantIds.length === 1) {
    return sessions.map((s) => (s.dayOff ? null : assistantIds[0]));
  }

  const result: (string | null)[] = new Array(n).fill(null);
  const weekdays = new Set(sessions.filter((s) => !s.dayOff).map((s) => s.scheduledDate.getUTCDay()));

  if (weekdays.size >= 2) {
    const sorted = [...weekdays].sort((a, b) => a - b);
    const owner = new Map(sorted.map((wd, i) => [wd, assistantIds[i % assistantIds.length]]));
    for (let i = 0; i < n; i++) {
      result[i] = sessions[i].dayOff ? null : (owner.get(sessions[i].scheduledDate.getUTCDay()) ?? null);
    }
    return result;
  }

  // Single weekday -> alternate by lesson occurrence in date order (day-offs don't advance).
  const order = sessions
    .map((_, i) => i)
    .sort((a, b) => {
      const diff = sessions[a].scheduledDate.getTime() - sessions[b].scheduledDate.getTime();
      return diff !== 0 ? diff : a - b;
    });
  let k = 0;
  for (const idx of order) {
    if (sessions[idx].dayOff) continue;
    result[idx] = assistantIds[k % assistantIds.length];
    k++;
  }
  return result;
}
