// Cambridge-style grade boundaries, stored per assessment in RAW marks (papers shift
// year to year, so there's no fixed % table). Pure — safe for client and server.

export const GRADES = ["A*", "A", "B", "C", "D", "E", "F", "G"] as const;
export type Boundary = { grade: string; min: number };

// Read the stored JSON defensively; best grade first.
export function parseBoundaries(raw: unknown): Boundary[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter((b): b is Boundary => !!b && typeof b.grade === "string" && typeof b.min === "number")
    .sort((a, b) => b.min - a.min);
  return out.length ? out : null;
}

// Best grade whose minimum the mark reaches; "U" below the lowest boundary.
export function letterFor(rawMark: number, boundaries: Boundary[]): string {
  return boundaries.find((b) => rawMark >= b.min)?.grade ?? "U";
}

// Validate an entered set: blanks are skipped (e.g. Core papers stop at C); marks must
// be within the max and strictly fall as the grade falls.
export function validateBoundaries(
  entries: { grade: string; min: string }[],
  maxMark: number,
): { boundaries: Boundary[] } | { error: string } {
  const boundaries: Boundary[] = [];
  for (const e of entries) {
    const v = e.min.trim();
    if (!v) continue;
    const min = Number(v);
    if (!Number.isFinite(min) || min < 0) return { error: `${e.grade}: enter a mark of 0 or more.` };
    if (min > maxMark) return { error: `${e.grade}: ${min} is above the max mark (${maxMark}).` };
    const prev = boundaries[boundaries.length - 1];
    if (prev && min >= prev.min) return { error: `${e.grade} (${min}) must be below ${prev.grade} (${prev.min}).` };
    boundaries.push({ grade: e.grade, min });
  }
  return { boundaries };
}
