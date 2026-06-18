import { divideAlphabetically, assignToSmallerGroup } from "../src/lib/divide";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("ok: " + msg);
}

// Odd count -> first assistant gets the extra; alphabetical.
const five = [
  { id: "e", name: "Eve" },
  { id: "a", name: "Aaron" },
  { id: "c", name: "Carol" },
  { id: "b", name: "bob" },
  { id: "d", name: "Dan" },
];
const m = divideAlphabetically(five, "A1", "A2");
// sorted: Aaron(a),bob(b),Carol(c),Dan(d),Eve(e); first 3 -> A1, last 2 -> A2
assert(m.a === "A1" && m.b === "A1" && m.c === "A1", "first 3 alphabetical -> A1");
assert(m.d === "A2" && m.e === "A2", "last 2 -> A2");
const a1 = Object.values(m).filter((x) => x === "A1").length;
const a2 = Object.values(m).filter((x) => x === "A2").length;
assert(a1 === 3 && a2 === 2, "odd split 3/2 (first gets extra)");

// Even count -> equal halves.
const four = [
  { id: "1", name: "Anna" },
  { id: "2", name: "Bill" },
  { id: "3", name: "Cara" },
  { id: "4", name: "Dina" },
];
const m2 = divideAlphabetically(four, "A1", "A2");
assert(
  Object.values(m2).filter((x) => x === "A1").length === 2 &&
    Object.values(m2).filter((x) => x === "A2").length === 2,
  "even split 2/2",
);

// Late imports -> smaller group; tie -> first.
const r = assignToSmallerGroup(["s1", "s2"], [
  { assistantId: "A1", count: 3 },
  { assistantId: "A2", count: 2 },
]);
assert(r.s1 === "A2", "first new student -> smaller group (A2)");
assert(r.s2 === "A1", "after tie 3/3 -> first assistant (A1)");

console.log("\nALL DIVIDE TESTS PASSED");
