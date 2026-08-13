import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const ET_ID = "et-1982-editorial-batch-v1";
const HARRY_POTTER_ID = "harry-potter-philosophers-stone-2001-editorial-batch-v1";
const MINIONS_ID = "minions-2015-editorial-batch-v1";
const BATCH_IDS = [ET_ID, HARRY_POTTER_ID, MINIONS_ID] as const;

test("editorial registry contains Cars plus exactly three batch titles", () => {
  const reviews = listEditorialReviewPublications();
  assert.equal(reviews.length, 4);
  assert.deepEqual(new Set(reviews.map((review) => review.id)), new Set([CARS_ID, ...BATCH_IDS]));

  assert.equal(getEditorialReviewPublicationForTitleId("wd:Q182153")?.id, CARS_ID);
  assert.equal(getEditorialReviewPublicationForTitleId("wd:Q11621")?.id, ET_ID);
  assert.equal(getEditorialReviewPublicationForTitleId("wd:Q102438")?.id, HARRY_POTTER_ID);
  assert.equal(getEditorialReviewPublicationForTitleId("wd:Q13619743")?.id, MINIONS_ID);
  assert.equal(getEditorialReviewPublicationForTitleId("wd:Q44578"), null);
});

test("every editorial page publishes facts but never a suitability verdict", () => {
  for (const review of listEditorialReviewPublications()) {
    const assessment = assessEditorialReviewPublication(review);
    assert.equal(assessment.publishable, true, review.id);
    assert.equal(assessment.decisionEligible, false, review.id);
    assert.equal(assessment.decisionStatus, "insufficient_data", review.id);
    assert.equal(review.decisionEligible, false, review.id);
    assert.equal(review.decisionStatus, "insufficient_data", review.id);
    assert.ok(review.claims.length > 0, review.id);
    assert.ok(review.uncertainCategories.length > 0, review.id);
  }
});

test("every fact marked corroborated has at least two independent source groups", () => {
  for (const review of listEditorialReviewPublications()) {
    const sources = new Map(review.sources.map((source) => [source.id, source]));

    for (const claim of review.claims) {
      assert.equal(claim.verification, "corroborated", claim.id);
      const groups = new Set(
        claim.sourceIds.map((sourceId) => sources.get(sourceId)?.independenceGroupId),
      );
      groups.delete(undefined);
      assert.ok(groups.size >= 2, `${claim.id} must have two independent source groups`);
    }
  }
});

test("editorial sources persist citation metadata but no source expression", () => {
  for (const review of listEditorialReviewPublications()) {
    for (const source of review.sources) {
      assert.match(source.sourceUrl, /^https:\/\//u);
      assert.match(source.accessedOn, /^\d{4}-\d{2}-\d{2}$/u);
      assert.ok(source.supportedClaimIds.length > 0);
      const forbiddenFields = ["text", "content", "excerpt", "quote", "translation", "paraphrase"];
      for (const field of forbiddenFields) {
        assert.equal(Object.hasOwn(source, field), false, `${review.id} source must not store ${field}`);
      }
    }
  }
});

test("three-title batch keeps every unsupported axis explicitly uncertain", () => {
  const expectedUncertain = new Map([
    [ET_ID, new Set(["bullying", "discrimination", "selfHarm", "grief", "flashingLights"])],
    [
      HARRY_POTTER_ID,
      new Set([
        "bullying",
        "sexualContent",
        "substances",
        "discrimination",
        "selfHarm",
        "flashingLights",
      ]),
    ],
    [MINIONS_ID, new Set(["bullying", "discrimination", "selfHarm", "grief", "flashingLights"])],
  ]);

  for (const editorialId of BATCH_IDS) {
    const review = getEditorialReviewPublicationById(editorialId);
    assert.ok(review);
    assert.deepEqual(new Set(review.uncertainCategories), expectedUncertain.get(editorialId));
  }
});

test("corroborated label fails closed when reduced to one independence group", () => {
  const review = getEditorialReviewPublicationById(ET_ID);
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

test("partial editorial data cannot be promoted into a complete decision", () => {
  const review = getEditorialReviewPublicationById(MINIONS_ID);
  assert.ok(review);
  const invalid = structuredClone(review) as EditorialReviewPublication & {
    decisionEligible: boolean;
    decisionStatus: string;
  };
  invalid.decisionEligible = true;
  invalid.decisionStatus = "suitable";

  const assessment = assessEditorialReviewPublication(invalid as EditorialReviewPublication);
  assert.equal(assessment.publishable, false);
  assert.ok(assessment.issues.some((issue) => issue.code === "DECISION_GATE_INVALID"));
});

test("public review route retains a single-locator fail-closed guard", () => {
  const routeSource = readFileSync(new URL("../app/review/page.tsx", import.meta.url), "utf8");
  assert.match(routeSource, /const locatorCount = \[bundleId, publicationId, editorialId\]\.filter\(Boolean\)\.length/u);
  assert.match(routeSource, /if \(locatorCount !== 1\) return <ReviewUnavailable \/>/u);
});

test("each batch title builds its dedicated editorial locator", () => {
  for (const editorialId of BATCH_IDS) {
    assert.equal(
      buildPublicEditorialReviewHref(editorialId),
      `/review?editorialId=${encodeURIComponent(editorialId)}`,
    );
  }
});
