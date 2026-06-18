// Student codes: a school-derived letter prefix + a RANDOM number (e.g. Citadel -> "C284").
// Reports are sent by code, so the number is randomized (not sequential) — a code never
// reveals a student's identity or their position/number in the roster. The prefix is just a
// human-friendly hint of which school the code belongs to. Codes are unique per class.

// First letter of the school name (e.g. "Citadel" -> "C"). Falls back to "S" (student).
export function schoolPrefix(schoolName: string): string {
  const letters = schoolName.replace(/[^A-Za-z]/g, "");
  return (letters[0] ?? "S").toUpperCase();
}

// Cryptographically secure, unbiased integer in [1, max] (Web Crypto; works
// server + client). Secure RNG so a code can't be predicted/reproduced, and the
// values carry no relation to roster order.
function randomNumber(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max; // reject values that would bias the modulo
  const buf = new Uint32Array(1);
  let x: number;
  do {
    globalThis.crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return 1 + (x % max);
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
