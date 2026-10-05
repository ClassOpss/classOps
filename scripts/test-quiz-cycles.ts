// Run: npx tsx scripts/test-quiz-cycles.ts
import assert from "node:assert/strict";
import { quizCyclesBetween } from "../src/lib/quiz";
import { buildBiweeklyQuizAnnouncement } from "../src/lib/whatsapp/quiz-announcement";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const row = (sched: string, quiz: string, adHoc: boolean) => ({ scheduledDate: d(sched), quizDate: d(quiz), adHoc });

// Cadence every 14 days from Oct 1 + an ad-hoc midterm on Oct 9 + an ad-hoc row that sits on a cadence date.
const rows = [row("2026-10-09", "2026-10-09", true), row("2026-10-15", "2026-10-15", true), row("2026-10-01", "2026-10-02", false)];
const c = quizCyclesBetween(d("2026-10-01"), rows, d("2026-09-25"), d("2026-10-31"));
assert.deepEqual(
  c.map((x) => [x.quizDate.toISOString().slice(0, 10), x.adHoc]),
  [["2026-10-02", false], ["2026-10-09", true], ["2026-10-15", false], ["2026-10-29", false]],
);

// No cadence: only ad-hoc rows inside the window.
const n = quizCyclesBetween(null, [row("2026-10-09", "2026-10-09", true), row("2026-12-01", "2026-12-01", true)], d("2026-10-01"), d("2026-10-31"));
assert.equal(n.length, 1);

const m = buildBiweeklyQuizAnnouncement({ date: d("2026-10-09"), coverage: "Algebra, Graphs", type: "midterm", time: "16:00", signature: "Team" });
assert.match(m, /^\*Midterm Announcement\*/);
assert.match(m, /having a midterm on Friday – 9\/10\/2026 at 4:00 PM/);
const e = buildBiweeklyQuizAnnouncement({ date: d("2026-10-09"), type: "exam" });
assert.match(e, /having an exam on/);
const q = buildBiweeklyQuizAnnouncement({ date: d("2026-10-09") });
assert.match(q, /^\*Quiz Announcement\*[\s\S]*having a quiz on[\s\S]*short and focused/);
console.log("quiz cycles: all passed");
