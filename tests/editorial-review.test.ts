import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assessEditorialReviewPublication,
  buildEditorialReviewDescription,
  buildPublicEditorialReviewCanonicalUrl,
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
const ALL_IDS = [CARS_ID, ...BATCH_IDS] as const;

const EXPECTED_EVIDENCE = new Map([
  [CARS_ID, { corroborated: 1, singleSource: 3, uncertain: 6 }],
  [ET_ID, { corroborated: 4, singleSource: 1, uncertain: 5 }],
  [HARRY_POTTER_ID, { corroborated: 3, singleSource: 1, uncertain: 6 }],
  [MINIONS_ID, { corroborated: 1, singleSource: 3, uncertain: 6 }],
]);

test("editorial registry contains Cars plus exactly three batch titles", () => {
  const reviews = listEditorialReviewPublications();
  assert.equal(reviews.length, 4);
  assert.deepEqual(new Set(reviews.map((review) => review.id)), new Set(ALL_IDS));

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

test("claim verification exactly matches its independent source-group count", () => {
  for (const review of listEditorialReviewPublications()) {
    const sources = new Map(review.sources.map((source) => [source.id, source]));

    for (const claim of review.claims) {
      const groups = new Set(
        claim.sourceIds.map((sourceId) => sources.get(sourceId)?.independenceGroupId),
      );
      groups.delete(undefined);

      if (claim.verification === "corroborated") {
        assert.ok(groups.size >= 2, `${claim.id} must have two independent source groups`);
      } else {
        assert.equal(groups.size, 1, `${claim.id} single_source must have exactly one group`);
      }
    }
  }
});

test("P4-03B2 persists source rights and usage basis without storing source expression", () => {
  for (const review of listEditorialReviewPublications()) {
    assert.equal(review.sources.length, 2, review.id);
    assert.deepEqual(
      new Set(review.sources.map((source) => source.publisher)),
      new Set(["Kids-In-Mind", "Wikipedia (English)"]),
      review.id,
    );

    for (const source of review.sources) {
      assert.match(source.sourceUrl, /^https:\/\//u);
      assert.match(source.rightsUrl, /^https:\/\//u);
      assert.match(source.accessedOn, /^\d{4}-\d{2}-\d{2}$/u);
      assert.ok(source.rightsLabel.length >= 3);
      assert.ok(source.usageNoteAr.length >= 20);
      assert.ok(source.supportedClaimIds.length > 0);

      if (source.publisher === "Kids-In-Mind") {
        assert.equal(source.usageBasis, "link_only_factual_reference");
        assert.equal(source.sourceVersion, undefined);
      } else {
        assert.equal(source.usageBasis, "open_license");
        assert.equal(source.rightsLabel, "CC BY-SA 4.0");
        assert.match(source.sourceVersion ?? "", /^oldid=\d+$/u);
      }

      const forbiddenFields = [
        "text",
        "content",
        "sourceText",
        "excerpt",
        "quote",
        "translation",
        "paraphrase",
        "rating",
      ];
      for (const field of forbiddenFields) {
        assert.equal(Object.hasOwn(source, field), false, `${review.id} source must not store ${field}`);
      }
    }
  }
});

test("commercially restricted publishers removed by B2 cannot count as published editorial evidence", () => {
  const blockedPublishers = new Set([
    "Common Sense Media",
    "Plugged In",
    "BBFC",
    "Dove.org",
  ]);

  for (const review of listEditorialReviewPublications()) {
    for (const source of review.sources) {
      assert.equal(blockedPublishers.has(source.publisher), false, `${review.id}: ${source.publisher}`);
    }
  }
});

test("P4-03B2 evidence counts and uncertain coverage remain explicit per title", () => {
  for (const editorialId of ALL_IDS) {
    const review = getEditorialReviewPublicationById(editorialId);
    assert.ok(review);
    const assessment = assessEditorialReviewPublication(review);
    const expected = EXPECTED_EVIDENCE.get(editorialId);
    assert.ok(expected);
    assert.equal(assessment.corroboratedClaimCount, expected.corroborated, editorialId);
    assert.equal(assessment.singleSourceClaimCount, expected.singleSource, editorialId);
    assert.equal(assessment.uncertainCategoryCount, expected.uncertain, editorialId);
  }

  const minions = getEditorialReviewPublicationById(MINIONS_ID);
  assert.ok(minions);
  assert.ok(minions.uncertainCategories.includes("fear"));
  assert.equal(minions.claims.some((claim) => claim.category === "fear"), false);
});

test("every unsupported axis is explicitly uncertain and no silence becomes none", () => {
  for (const review of listEditorialReviewPublications()) {
    const present = new Set(review.claims.map((claim) => claim.category));
    const uncertain = new Set(review.uncertainCategories);
    assert.equal(present.size + uncertain.size, 10, review.id);
    for (const category of present) assert.equal(uncertain.has(category), false, review.id);
    assert.equal(JSON.stringify(review).includes('"none"'), false, review.id);
  }
});

test("corroborated label fails closed when reduced to one independence group", () => {
  const review = getEditorialReviewPublicationById(ET_ID);
  assert.ok(review);
  const invalid = structuredClone(review) as EditorialReviewPublication;
  const corroboratedIndex = invalid.claims.findIndex((claim) => claim.verification === "corroborated");
  assert.notEqual(corroboratedIndex, -1);
  const claim = invalid.claims[corroboratedIndex];
  invalid.claims[corroboratedIndex] = { ...claim, sourceIds: [claim.sourceIds[0]] };
  for (const source of invalid.sources) {
    source.supportedClaimIds = source.supportedClaimIds.filter(
      (claimId) => claimId !== claim.id || source.id === claim.sourceIds[0],
    );
  }

  const assessment = assessEditorialReviewPublication(invalid);
  assert.equal(assessment.publishable, false);
  assert.ok(assessment.issues.some((issue) => issue.code === "CORROBORATION_INVALID"));
});

test("single-source label fails closed if a second independent group is added without relabeling", () => {
  const review = getEditorialReviewPublicationById(CARS_ID);
  assert.ok(review);
  const invalid = structuredClone(review) as EditorialReviewPublication;
  const singleIndex = invalid.claims.findIndex((claim) => claim.verification === "single_source");
  assert.notEqual(singleIndex, -1);
  const claim = invalid.claims[singleIndex];
  const extra = invalid.sources.find((source) => !claim.sourceIds.includes(source.id));
  assert.ok(extra);
  invalid.claims[singleIndex] = { ...claim, sourceIds: [...claim.sourceIds, extra.id] };
  extra.supportedClaimIds.push(claim.id);

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

test("editorial metadata helpers produce a canonical production URL and Arabic evidence description", () => {
  for (const editorialId of ALL_IDS) {
    const review = getEditorialReviewPublicationById(editorialId);
    assert.ok(review);
    assert.equal(
      buildPublicEditorialReviewCanonicalUrl(editorialId),
      `https://qabl-almushahada.buildtools.workers.dev/review?editorialId=${encodeURIComponent(editorialId)}`,
    );
    const description = buildEditorialReviewDescription(review);
    assert.match(description, /تحليل عربي/u);
    assert.match(description, /لا يصدر حكم ملاءمة نهائي/u);
    assert.match(description, new RegExp(`${review.uncertainCategories.length} من 10`, "u"));
  }
});

test("review route contains per-editorial canonical metadata and Article structured data", () => {
  const routeSource = readFileSync(new URL("../app/review/page.tsx", import.meta.url), "utf8");
  const viewSource = readFileSync(new URL("../app/review/editorial-review-view.tsx", import.meta.url), "utf8");
  assert.match(routeSource, /export async function generateMetadata/u);
  assert.match(routeSource, /alternates: \{ canonical \}/u);
  assert.match(routeSource, /robots: \{ index: true, follow: true \}/u);
  assert.match(viewSource, /application\/ld\+json/u);
  assert.match(viewSource, /"@type": "Article"/u);
  assert.match(viewSource, /citation: review\.sources\.map/u);
});

test("public review route retains a single-locator fail-closed guard", () => {
  const routeSource = readFileSync(new URL("../app/review/page.tsx", import.meta.url), "utf8");
  assert.match(routeSource, /if \(\[bundleId, publicationId, editorialId\]\.filter\(Boolean\)\.length !== 1\) return <ReviewUnavailable \/>/u);
});

test("all four editorial pages build dedicated locators and sitemap derives from D1 current heads", () => {
  for (const editorialId of ALL_IDS) {
    assert.equal(
      buildPublicEditorialReviewHref(editorialId),
      `/review?editorialId=${encodeURIComponent(editorialId)}`,
    );
  }
  const sitemapSource = readFileSync(new URL("../app/sitemap.xml/route.ts", import.meta.url), "utf8");
  assert.match(sitemapSource, /listEditorialPublications/u);
  assert.doesNotMatch(sitemapSource, /listEditorialReviewPublications|editorial-review-registry/u);
  assert.match(sitemapSource, /buildPublicEditorialReviewCanonicalUrl|buildPublicEditorialReviewHref/u);
});
