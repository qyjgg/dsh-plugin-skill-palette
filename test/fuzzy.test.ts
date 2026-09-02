import test from "node:test";
import assert from "node:assert/strict";
import { fuzzyMatchSkill } from "../src/client/fuzzy.ts";

test("fuzzyMatchSkill - exact prefix (Tier 1)", () => {
  const item = { name: "code-review", description: "Review code changes" };
  const res = fuzzyMatchSkill(item, "code");
  assert.ok(res !== null);
  assert.ok(res.score >= 1000, `Expected score >= 1000, got ${res.score}`);
  assert.deepEqual(res.nameHighlights, [{ start: 0, end: 4 }]);
});

test("fuzzyMatchSkill - acronym match (Tier 1.8)", () => {
  const item1 = { name: "caveman-commit", description: "Terse commit messages" };
  const res1 = fuzzyMatchSkill(item1, "cc");
  assert.ok(res1 !== null);
  assert.ok(res1.score >= 950, `Expected score >= 950 for exact acronym, got ${res1.score}`);
  assert.deepEqual(res1.nameHighlights, [
    { start: 0, end: 1 },
    { start: 8, end: 9 },
  ]);

  const item2 = { name: "systematic-debugging", description: "Debug systematically" };
  const res2 = fuzzyMatchSkill(item2, "sd");
  assert.ok(res2 !== null);
  assert.ok(res2.score >= 950, `Expected score >= 950, got ${res2.score}`);

  const item3 = { name: "code-review-expert", description: "Review expert" };
  const res3 = fuzzyMatchSkill(item3, "cr");
  assert.ok(res3 !== null);
  assert.ok(res3.score >= 900, `Expected prefix acronym score >= 900, got ${res3.score}`);
});

test("fuzzyMatchSkill - substring match (Tier 1.5)", () => {
  const item = { name: "code-review", description: "Review code changes" };
  const res = fuzzyMatchSkill(item, "review");
  assert.ok(res !== null);
  assert.ok(res.score >= 800 && res.score < 900, `Expected score in [800, 900), got ${res.score}`);
  assert.deepEqual(res.nameHighlights, [{ start: 5, end: 11 }]);
});

test("fuzzyMatchSkill - description keyword match (Tier 3)", () => {
  const item = { name: "tdd", description: "Test-driven development workflow" };
  const res = fuzzyMatchSkill(item, "test");
  assert.ok(res !== null);
  assert.ok(res.score >= 200 && res.score < 300, `Expected score in [200, 300), got ${res.score}`);
  assert.deepEqual(res.descHighlights, [{ start: 0, end: 4 }]);
});

test("fuzzyMatchSkill - empty query returns all with score 0", () => {
  const item = { name: "tdd", description: "Test-driven development" };
  const res = fuzzyMatchSkill(item, "");
  assert.ok(res !== null);
  assert.equal(res.score, 0);
  assert.deepEqual(res.nameHighlights, []);
  assert.deepEqual(res.descHighlights, []);
});

test("fuzzyMatchSkill - null and undefined safety", () => {
  const badItem1 = { name: undefined as any, description: undefined as any };
  const res1 = fuzzyMatchSkill(badItem1, "test");
  assert.equal(res1, null);

  const badItem2 = { name: "test", description: undefined as any };
  const res2 = fuzzyMatchSkill(badItem2, "test");
  assert.ok(res2 !== null);
  assert.equal(res2.item.name, "test");

  const badItem3 = { name: undefined as any, description: "testing skills" };
  const res3 = fuzzyMatchSkill(badItem3, "test");
  assert.ok(res3 !== null);
});
