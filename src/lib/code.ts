// Random, opaque student codes — used on reports so a code never reveals a
// student's identity or their position/number in the roster.
// Works in both server (Node) and browser via the Web Crypto API.

// Unambiguous charset: no 0/O, 1/I/L to avoid confusion when read off a report.
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DEFAULT_LENGTH = 5;

export function randomCode(length = DEFAULT_LENGTH): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i] % CHARSET.length];
  }
  return out;
}

// A code not already in `taken`. Grows length if the space gets crowded (defensive;
// classes are tiny so this effectively never triggers).
export function uniqueCode(taken: Set<string>, length = DEFAULT_LENGTH): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = randomCode(length);
    if (!taken.has(code)) return code;
  }
  return uniqueCode(taken, length + 1);
}
