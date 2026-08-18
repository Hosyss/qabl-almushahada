import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createArabFamilyProfile } from "../lib/arab-family-policy.ts";
import {
  decidePracticalEditorialVerdict,
  isEditorialWorkEstablished,
} from "../lib/editorial-practical-verdict.ts";
import type { EditorialReviewPublication } from "../lib/editorial-review.ts";
import { CONTENT_CATEGORIES, type FamilyProfile } from "../lib/review-engine/types.ts";

const FIXTURES = [
  "cars-2006-editorial-pilot-v1.json",
  "et-1982-editorial-batch-v1.json",
  "harry-potter-philosophers-stone-2001-editorial-batch-v1.json",
  "minions-2015-editorial-batch-v1.json",
  "barbie-2023-editorial-c1-v1.json",
  "jurassic-park-1993-editorial-c1-v1.json",
  "my-neighbor-totoro-1988-editorial-c1-v1.json",
  "alice-in-wonderland-2010-editorial-c2-v1.json",
  "the-hunger-games-2012-editorial-c2-v1.json",
  "spider-man-no-way-home-2021-editorial-c2-v1.json",
] as const;

const NOW = new Date("2026-08-15T12:00:00Z");

function loadFixture(name: string): EditorialReviewPublication {
  const parsed = JSON.parse(
    readFileSync(new URL(`../data/editorial-bootstrap/${name}`, import.meta.url), "utf8"),
  ) as { review: EditorialReviewPublication };
  return parsed.review;
}

function allMaxFamily(age = 17): FamilyProfile {
  return {
    id: "test:all-max",
    childAge: age,
    maxSeverity: Object.fromEntries(CONTENT_CATEGORIES.map((category) => [category, 4])) as FamilyProfile["maxSeverity"],
    blockedFlags: [],
  };
}

test("all ten current editorial publications are mature and no longer fail for evidence incompleteness", () => {
  for (const name of FIXTURES) {
    const review = loadFixture(name);
    const verdict = decidePracticalEditorialVerdict({ review, now: NOW });
    assert.equal(verdict.establishedWork, true, review.id);
    assert.equal(verdict.outcome, "watch_with_guidance", review.id);
    assert.equal(verdict.reasonCode, "family_profile_required", review.id);
    assert.notEqual(verdict.reasonCode, "editorial_corpus_too_thin", review.id);
  }
});

test("E.T. asks for family settings instead of claiming the evidence is incomplete", () => {
  const review = loadFixture("et-1982-editorial-batch-v1.json");
  const verdict = decidePracticalEditorialVerdict({ review, now: NOW });

  assert.equal(verdict.outcome, "watch_with_guidance");
  assert.equal(verdict.reasonCode, "family_profile_required");
  assert.equal(verdict.confidence, "medium");
  assert.deepEqual(verdict.unknownCategories, review.uncertainCategories);
  assert.equal(verdict.unknownCategories.length, 5);
  assert.ok(verdict.corroboratedClaimCount >= 1);
  assert.ok(verdict.independentSourceGroupCount >= 2);
});

test("verified presence exceeds a zero family limit without inventing numeric severity", () => {
  const review = loadFixture("et-1982-editorial-batch-v1.json");
  const verdict = decidePracticalEditorialVerdict({
    review,
    now: NOW,
    family: createArabFamilyProfile({ childAge: 8, fearLimit: 1, avoidBullying: false }),
  });

  assert.equal(verdict.outcome, "not_recommended");
  assert.ok(verdict.determiningCategories.includes("substances"));
  assert.ok(verdict.determiningCategories.includes("sexualContent"));
  assert.equal(Object.hasOwn(verdict, "severity"), false);
  assert.deepEqual(verdict.unknownCategories, review.uncertainCategories);
});

test("a mature title becomes needs-attention when family limits cannot be proven from missing severity", () => {
  const review = loadFixture("my-neighbor-totoro-1988-editorial-c1-v1.json");
  const verdict = decidePracticalEditorialVerdict({
    review,
    now: NOW,
    family: createArabFamilyProfile({ childAge: 16, fearLimit: 3, avoidBullying: false }),
  });

  assert.equal(verdict.outcome, "needs_attention");
  assert.equal(verdict.reasonCode, "attention_required_for_unbounded_or_unknown_content");
  assert.deepEqual(verdict.unknownCategories, review.uncertainCategories);
  assert.ok(verdict.attentionCategories.length > 0);
  assert.ok(verdict.unknownCategories.length > 0);
});

test("a provably permissive family profile can receive a positive practical verdict without fabricated severity", () => {
  const review = loadFixture("et-1982-editorial-batch-v1.json");
  const verdict = decidePracticalEditorialVerdict({
    review,
    now: NOW,
    family: allMaxFamily(),
  });

  assert.equal(verdict.outcome, "watch");
  assert.equal(verdict.reasonCode, "within_provable_family_bounds");
  assert.equal(verdict.attentionCategories.length, 0);
  assert.equal(Object.hasOwn(verdict, "severity"), false);
});

test("link-only facts can inform attention but cannot alone prove a zero-limit exceedance", () => {
  const review = loadFixture("et-1982-editorial-batch-v1.json");
  const verdict = decidePracticalEditorialVerdict({ review, now: NOW });

  assert.ok(verdict.referenceOnlyCategories.includes("language"));
  assert.equal(verdict.decisionSupportedPresentCategories.includes("language"), false);
});

test("a failed publication quality gate still blocks the practical verdict", () => {
  const review = loadFixture("et-1982-editorial-batch-v1.json");
  const verdict = decidePracticalEditorialVerdict({
    review,
    now: NOW,
    publicationQualityPassed: false,
  });

  assert.equal(verdict.outcome, "not_ready");
  assert.equal(verdict.reasonCode, "publication_quality_failed");
});

test("the 90-day rule never guesses a same-year release date", () => {
  assert.equal(isEditorialWorkEstablished({ releaseYear: 2026, now: NOW }), false);
  assert.equal(
    isEditorialWorkEstablished({ releaseYear: 2026, releaseDate: "2026-04-01", now: NOW }),
    true,
  );
  assert.equal(
    isEditorialWorkEstablished({ releaseYear: 2026, releaseDate: "2026-07-01", now: NOW }),
    false,
  );
});

test("previous-year year-only data becomes guaranteed mature only after the safe calendar point", () => {
  assert.equal(
    isEditorialWorkEstablished({ releaseYear: 2025, now: new Date("2026-02-01T00:00:00Z") }),
    false,
  );
  assert.equal(
    isEditorialWorkEstablished({ releaseYear: 2025, now: new Date("2026-04-01T00:00:00Z") }),
    true,
  );
});
