import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Lazy so importing this module never throws when ANTHROPIC_API_KEY is unset
// (the caller guards on the env var before invoking extractStudentNames).
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

// Pull a JSON array of strings out of Claude's response, tolerating stray prose.
function parseNames(text: string): string[] {
  let candidate = text.trim();
  if (!candidate.startsWith("[")) {
    const start = candidate.indexOf("[");
    const end = candidate.lastIndexOf("]");
    if (start === -1 || end === -1 || end < start) return [];
    candidate = candidate.slice(start, end + 1);
  }
  try {
    const arr = JSON.parse(candidate);
    if (!Array.isArray(arr)) return [];
    return arr.map((n) => String(n).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// Extract student full names from raw class-list PDF text.
// Model fixed to claude-sonnet-4-6 per CLAUDE.md (sufficient + cheaper for this extraction).
export async function extractStudentNames(rawText: string): Promise<string[]> {
  const trimmed = rawText.slice(0, 100_000);
  const response = await client().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system:
      "You extract student full names from the raw text of a class-list PDF. " +
      "Ignore headers, footers, page numbers, dates, school names, and column labels. " +
      "Return ONLY a JSON array of strings (each a student's full name), nothing else.",
    messages: [
      {
        role: "user",
        content: `Extract the list of student full names from this text:\n\n${trimmed}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? parseNames(block.text) : [];
}
