// Pure student-division logic (no DB) so it can be unit-tested directly.
// Rule (start-of-year decision): split the roster into alphabetical halves; the
// FIRST assistant takes the extra student on odd counts.

export type DividableStudent = { id: string; name: string };

// Returns a map of studentId -> assistantId for a 2-assistant split.
export function divideAlphabetically(
  students: DividableStudent[],
  firstAssistantId: string,
  secondAssistantId: string,
): Record<string, string> {
  const sorted = [...students].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const firstShare = Math.ceil(sorted.length / 2); // first assistant gets the extra
  const map: Record<string, string> = {};
  sorted.forEach((s, i) => {
    map[s.id] = i < firstShare ? firstAssistantId : secondAssistantId;
  });
  return map;
}

// For students added AFTER a division: assign each to whichever assistant currently
// has the smaller sub-group (ties go to the first assistant). Counts update as we go.
export function assignToSmallerGroup(
  newStudentIds: string[],
  counts: { assistantId: string; count: number }[],
): Record<string, string> {
  // Copy so we can mutate counts locally.
  const tally = counts.map((c) => ({ ...c }));
  const map: Record<string, string> = {};
  for (const studentId of newStudentIds) {
    // Smallest count wins; stable order keeps the first assistant ahead on ties.
    let target = tally[0];
    for (const t of tally) if (t.count < target.count) target = t;
    map[studentId] = target.assistantId;
    target.count += 1;
  }
  return map;
}
