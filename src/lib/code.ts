// Student codes: a school-derived letter prefix + a RANDOM number (e.g. Citadel -> "C284").
// Reports are sent by code, so the number is randomized (not sequential) — a code never
// reveals a student's identity or their position/number in the roster. The prefix is just a
// human-friendly hint of which school the code belongs to. Codes are unique per class.

// First letter of the school name (e.g. "Citadel" -> "C"). Falls back to "S" (student).
export function schoolPrefix(schoolName: string): string {
  const letters = schoolName.replace(/[^A-Za-z]/g, "");
  return (letters[0] ?? "S").toUpperCase();
}

function randomNumber(max: number): number {
  return 1 + Math.floor(Math.random() * max);
}

export function studentCode(prefix: string, max = 9999): string {
  return `${prefix}${randomNumber(max)}`;
}

// A code with the given prefix not already in `taken`. Widens the number range if needed
// (defensive; classes are tiny so this effectively never triggers).
export function uniqueStudentCode(prefix: string, taken: Set<string>): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = studentCode(prefix);
    if (!taken.has(code)) return code;
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = studentCode(prefix, 999999);
    if (!taken.has(code)) return code;
  }
  throw new Error("Could not allocate a unique student code.");
}
