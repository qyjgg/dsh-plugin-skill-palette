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

  const item4 = { name: "web3-auth-service", description: "Web3 Auth" };
  const res4 = fuzzyMatchSkill(item4, "was");
  assert.ok(res4 !== null);
  assert.ok(res4.score >= 950, `Expected exact acronym score >= 950, got ${res4.score}`);
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

test("fuzzyMatchSkill - exact match bonus higher than prefix", () => {
  const exact = { name: "test", description: "Run test" };
  const prefix = { name: "testing", description: "Run testing" };
  const resExact = fuzzyMatchSkill(exact, "test");
  const resPrefix = fuzzyMatchSkill(prefix, "test");
  assert.ok(resExact !== null && resPrefix !== null);
  assert.ok(resExact.score > resPrefix.score, `Expected exact score (${resExact.score}) > prefix score (${resPrefix.score})`);
});

test("fuzzyMatchSkill - name subsequence match (Tier 2)", () => {
  const item = { name: "code-review", description: "Review code" };
  const res = fuzzyMatchSkill(item, "cdrv");
  assert.ok(res !== null);
  assert.ok(res.score >= 500 && res.score < 800, `Expected Tier 2 score in [500, 800), got ${res.score}`);
  assert.ok(res.nameHighlights.length > 0);
});

test("fuzzyMatchSkill - boundary detection with '/'", () => {
  const item = { name: "vendor/skill-helper", description: "Helper" };
  // Exact acronym match across '/' boundary
  const resExact = fuzzyMatchSkill(item, "vsh");
  assert.ok(resExact !== null);
  assert.ok(resExact.score >= 950, `Expected exact acronym >= 950, got ${resExact.score}`);

  // Prefix acronym match across '/' boundary
  const resPrefix = fuzzyMatchSkill(item, "vs");
  assert.ok(resPrefix !== null);
  assert.ok(resPrefix.score >= 900, `Expected prefix acronym >= 900, got ${resPrefix.score}`);

  // Subsequence match across word boundaries
  const resSub = fuzzyMatchSkill(item, "sh");
  assert.ok(resSub !== null);
  assert.ok(resSub.score >= 500, `Expected subsequence match >= 500, got ${resSub.score}`);
});

test("fuzzyMatchSkill - description subsequence match (Tier 4)", () => {
  const item = { name: "tool", description: "automatic code refactoring engine" };
  const res = fuzzyMatchSkill(item, "acr");
  assert.ok(res !== null);
  assert.ok(res.score >= 100 && res.score < 200, `Expected Tier 4 score in [100, 200), got ${res.score}`);
  assert.ok(res.descHighlights.length > 0);
});

test("fuzzyMatchSkill - non-matching query returns null", () => {
  const item = { name: "tdd", description: "Test-driven development" };
  const res = fuzzyMatchSkill(item, "zzzz");
  assert.equal(res, null);
});

test("fuzzyMatchSkill - Chinese / Unicode support", () => {
  const item = { name: "代码审查", description: "自动检查代码规范与潜在漏洞" };
  const resPrefix = fuzzyMatchSkill(item, "代码");
  assert.ok(resPrefix !== null);
  assert.ok(resPrefix.score >= 1000);

  const resSubstring = fuzzyMatchSkill(item, "审查");
  assert.ok(resSubstring !== null);
  assert.ok(resSubstring.score >= 800);

  const resDesc = fuzzyMatchSkill(item, "漏洞");
  assert.ok(resDesc !== null);
  assert.ok(resDesc.score >= 200);
});

test("fuzzyMatchSkill - null and undefined safety", () => {
  const badItem1 = { name: undefined as any, description: undefined as any };
  const res1 = fuzzyMatchSkill(badItem1, "test");
  assert.equal(res1, null);

  // Empty/bad item with empty query should return null
  const res1Empty = fuzzyMatchSkill(badItem1, "");
  assert.equal(res1Empty, null);

  // rawQuery null or undefined safety
  const goodItem = { name: "code-review", description: "Review" };
  const resNullQuery = fuzzyMatchSkill(goodItem, null as any);
  assert.ok(resNullQuery !== null);
  assert.equal(resNullQuery.score, 0);

  const resUndefinedQuery = fuzzyMatchSkill(goodItem, undefined as any);
  assert.ok(resUndefinedQuery !== null);
  assert.equal(resUndefinedQuery.score, 0);

  const badItem2 = { name: "test", description: undefined as any };
  const res2 = fuzzyMatchSkill(badItem2, "test");
  assert.ok(res2 !== null);
  assert.equal(res2.item.name, "test");

  const badItem3 = { name: undefined as any, description: "testing skills" };
  const res3 = fuzzyMatchSkill(badItem3, "test");
  assert.ok(res3 !== null);
});
