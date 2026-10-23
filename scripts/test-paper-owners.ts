import { resolvePaperOwners, papersOf, SHARED } from "../src/lib/paper-owners";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}
const eq = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const students = ["s1", "s2", "s3", "s4"];
const subGroups = new Map([["s1", "A"], ["s2", "A"], ["s3", "B"], ["s4", "B"]]);
const onClass = new Set(["A", "B"]);
const none = new Map<string, string>();

// ── Default: split by sub-group ──
{
  const o = resolvePaperOwners({ studentIds: students, graded: none, claims: none, subGroups, onClass });
  assert(eq(papersOf(o, "A"), ["s1", "s2"]) && eq(papersOf(o, "B"), ["s3", "s4"]), "no claims -> sub-groups");
}

// ── A takes the whole class: B owes nothing ──
{
  const claims = new Map(students.map((s) => [s, "A"]));
  const o = resolvePaperOwners({ studentIds: students, graded: none, claims, subGroups, onClass });
  assert(eq(papersOf(o, "A"), students) && papersOf(o, "B").length === 0, "whole class claimed -> B owns none");
}

// ── Split by who was there: B takes s1, A takes s4 ──
{
  const claims = new Map([["s1", "B"], ["s4", "A"]]);
  const o = resolvePaperOwners({ studentIds: students, graded: none, claims, subGroups, onClass });
  assert(eq(papersOf(o, "A"), ["s2", "s4"]) && eq(papersOf(o, "B"), ["s1", "s3"]), "custom split follows claims");
}

// ── Graded paper belongs to whoever corrected it, whatever the default/claim said ──
{
  const graded = new Map([["s3", "A"]]);
  const claims = new Map([["s3", "B"]]);
  const o = resolvePaperOwners({ studentIds: students, graded, claims, subGroups, onClass });
  assert(o.get("s3") === "A", "graded by A -> A corrected it");
  assert(eq(papersOf(o, "B"), ["s4"]), "B no longer answerable for a paper A corrected");
}

// ── Claim by an assistant who has left the class falls back to the sub-group owner ──
{
  const claims = new Map([["s1", "C"]]);
  const o = resolvePaperOwners({ studentIds: students, graded: none, claims, subGroups, onClass });
  assert(o.get("s1") === "A", "stale claim ignored");
}

// ── No sub-groups (single assistant / undivided) -> shared, unless claimed ──
{
  const claims = new Map([["s2", "B"]]);
  const o = resolvePaperOwners({ studentIds: students, graded: none, claims, subGroups: new Map(), onClass });
  assert(o.get("s1") === SHARED && eq(papersOf(o, "A"), ["s1", "s3", "s4"]), "undivided class -> shared");
  assert(eq(papersOf(o, "B"), students), "B owns shared papers + its claim");
}

// ── Student in no sub-group (while groups exist) is nobody's ──
{
  const o = resolvePaperOwners({ studentIds: [...students, "s5"], graded: none, claims: none, subGroups, onClass });
  assert(!o.has("s5"), "ungrouped student -> no owner, nobody fined");
}

console.log("all paper-owner tests passed");
