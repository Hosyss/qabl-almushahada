import assert from "node:assert/strict";
import test from "node:test";

import {
  assessEditorialReviewPublication,
  buildPublicEditorialReviewHref,
  type EditorialReviewPublication,
} from "../lib/editorial-review.ts";
import {
  getEditorialReviewPublicationById,
  getEditorialReviewPublicationForTitleId,
  listEditorialReviewPublications,
} from "../lib/editorial-review-registry.ts";

const CARS_ID = "cars-2006-editorial-pilot-v1";

test("Cars editorial pilot publishes facts but never a suitability verdict", () => {
  const review = getEditorialReviewPublicationById(CARS_ID);
  assert.ok(review);

  const assessment = assessEditorialReviewPublication(review);
  assert.equal(assessment.publishable, true);
  assert.equal(assessment.decisionEligible, false);
  assert.equal(assessment.decisionStatus, "insufficient_data");
  assert.equal(review.decisionEligible, false);
  assert.equal(review.decisionStatus, "insufficient_data");
  assert.equal(assessment.corroboratedClaimCount, 4);
  assert.equal(assessment.singleSourceClaimCount, 0);
  assert.equal(assessment.uncertainCategoryCount, 6);
});

test("every Cars fact marked corroborated has at least two independent source groups", () => {
  const review = getEditorialReviewPublicationById(CARS_ID);
  assert.ok(review);
  const sources = new Map(review.sources.map((source) => [source.id, source]));

  for (const claim of review.claims) {
    assert.equal(claim.verification, "corroborated");
    const groups = new Set(
      claim.sourceIds.map((sourceId) => sources.get(sourceId)?.independenceGroupId),
    );
    groups.delete(undefined);
    assert.ok(groups.size >= 2, `${claim.id} must have two independent source groups`);
  }
});

test("editorial sources persist citation metadata but no source expression", () => {
  const review = getEditorialReviewPublicationById(CARS_ID);
  assert.ok(review);

  for (const source of review.sources) {
    assert.match(source.sourceUrl, /^https:\/\//u);
    assert.match(source.accessedOn, /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(source.supportedClaimIds.length > 0);
    const forbiddenFields = ["text", "content", "excerpt", "quote", "translation", "paraphrase"];
    for (const field of forbiddenFields) {
      assert.equal(Object.hasOwn(source, field), false, `source must not store ${field}`);
    }
  }
});

test("Cars keeps unresolved axes uncertain instead of converting silence to none", () => {
  const review = getEditorialReviewPublicationById(CARS_ID);
  assert.ok(review);
  assert.deepEqual(
    new Set(review.uncertainCategories),
    new Set([
      "bullying",
      "substances",
      "discrimination",
      "selfHarm",
      "grief",
      "flashingLights",
    ]),
  );
});

test("corroborated label fails closed when reduced to one independence group", () => {
  const review = getEditorialReviewPublicationById(CARS_ID);
  assert.ok(review);
  const invalid = structuredClone(review) as EditorialReviewPublication;
  invalid.claims[0] = {
    ...invalid.claims[0],
    sourceIds: [invalid.claims[0].sourceIds[0]],
  };
  for (const source of invalid.sources) {
    source.supportedClaimIds = source.supportedClaimIds.filter(
      (claimId) => claimId !== invalid.claims[0].id || source.id === invalid.claims[0].sourceIds[0],
    );
  }

  const assessment = assessEditorialReviewPublication(invalid);
  assert.equal(assessment.publishable, false);
  assert.ok(assessment.issues.some((issue) => issue.code === "CORROBORATION_INVALID"));
});

test("editorial registry resolves Cars by title id and builds a dedicated locator", () => {
  assert.equal(listEditorialReviewPublications().length, 1);
  assert.equal(getEditorialReviewPublicationForTitleId("wd:Q182153")?.id, CARS_ID);
  assert.equal(getEditorialReviewPublicationForTitleId("wd:Q44578"), null);
  assert.equal(buildPublicEditorialReviewHref(CARS_ID), `/review?editorialId=${CARS_ID}`);
});
