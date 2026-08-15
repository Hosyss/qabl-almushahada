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
  getFrozenEditorialReviewById,
  getFrozenEditorialReviewForTitleId,
  listFrozenEditorialReviews,
} from "./editorial-bootstrap-fixtures.ts";

const CARS_ID = "cars-2006-editorial-pilot-v1";
const ET_ID = "et-1982-editorial-batch-v1";
const HARRY_ID = "harry-potter-philosophers-stone-2001-editorial-batch-v1";
const MINIONS_ID = "minions-2015-editorial-batch-v1";
const BARBIE_ID = "barbie-2023-editorial-c1-v1";
const JURASSIC_ID = "jurassic-park-1993-editorial-c1-v1";
const TOTORO_ID = "my-neighbor-totoro-1988-editorial-c1-v1";
const ALICE_ID = "alice-in-wonderland-2010-editorial-c2-v1";
const HUNGER_ID = "the-hunger-games-2012-editorial-c2-v1";
const SPIDER_ID = "spider-man-no-way-home-2021-editorial-c2-v1";
const ALL_IDS = [CARS_ID, ET_ID, HARRY_ID, MINIONS_ID, BARBIE_ID, JURASSIC_ID, TOTORO_ID, ALICE_ID, HUNGER_ID, SPIDER_ID] as const;
const EXPECTED_EVIDENCE = new Map([
  [CARS_ID, { corroborated: 1, singleSource: 3, uncertain: 6 }],
  [ET_ID, { corroborated: 4, singleSource: 1, uncertain: 5 }],
  [HARRY_ID, { corroborated: 3, singleSource: 1, uncertain: 6 }],
  [MINIONS_ID, { corroborated: 1, singleSource: 3, uncertain: 6 }],
  [BARBIE_ID, { corroborated: 2, singleSource: 3, uncertain: 5 }],
  [JURASSIC_ID, { corroborated: 2, singleSource: 3, uncertain: 5 }],
  [TOTORO_ID, { corroborated: 1, singleSource: 3, uncertain: 6 }],
  [ALICE_ID, { corroborated: 2, singleSource: 3, uncertain: 5 }],
  [HUNGER_ID, { corroborated: 2, singleSource: 3, uncertain: 5 }],
  [SPIDER_ID, { corroborated: 1, singleSource: 3, uncertain: 6 }],
]);

test("frozen bootstrap contains exactly the ten current editorial publications", () => {
  const reviews = listFrozenEditorialReviews();
  assert.equal(reviews.length, 10);
  assert.deepEqual(new Set(reviews.map((review) => review.id)), new Set(ALL_IDS));
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q182153")?.id, CARS_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q11621")?.id, ET_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q102438")?.id, HARRY_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q13619743")?.id, MINIONS_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q55436290")?.id, BARBIE_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q167726")?.id, JURASSIC_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q39571")?.id, TOTORO_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q174385")?.id, ALICE_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q212965")?.id, HUNGER_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q68934496")?.id, SPIDER_ID);
  assert.equal(getFrozenEditorialReviewForTitleId("wd:Q44578"), null);
});

test("every current editorial page publishes facts but never a suitability verdict", () => {
  for (const review of listFrozenEditorialReviews()) {
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

test("claim verification exactly matches independent source-group counts", () => {
  for (const review of listFrozenEditorialReviews()) {
    const sources = new Map(review.sources.map((source) => [source.id, source]));
    for (const claim of review.claims) {
      const groups = new Set(claim.sourceIds.map((sourceId) => sources.get(sourceId)?.independenceGroupId));
      groups.delete(undefined);
      assert.equal(groups.size, claim.verification === "corroborated" ? 2 : 1, `${review.id}:${claim.id}`);
    }
  }
});

test("editorial source records keep rights metadata without storing source expression", () => {
  const forbiddenFields = ["text", "content", "sourceText", "excerpt", "quote", "translation", "paraphrase", "rating"];
  for (const review of listFrozenEditorialReviews()) {
    assert.equal(review.sources.length, 2, review.id);
    assert.deepEqual(new Set(review.sources.map((source) => source.publisher)), new Set(["Kids-In-Mind", "Wikipedia (English)"]), review.id);
    for (const source of review.sources) {
      assert.match(source.sourceUrl, /^https:\/\//u);
      assert.match(source.rightsUrl, /^https:\/\//u);
      assert.match(source.accessedOn, /^\d{4}-\d{2}-\d{2}$/u);
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
      for (const field of forbiddenFields) assert.equal(Object.hasOwn(source, field), false, `${review.id}:${field}`);
    }
  }
});

test("restricted publishers cannot count as editorial evidence", () => {
  const blocked = new Set(["Common Sense Media", "Plugged In", "BBFC", "Dove", "Dove.org"]);
  for (const review of listFrozenEditorialReviews()) {
    for (const source of review.sources) assert.equal(blocked.has(source.publisher), false, `${review.id}:${source.publisher}`);
  }
});

test("evidence counts and unresolved coverage are preserved exactly", () => {
  for (const editorialId of ALL_IDS) {
    const review = getFrozenEditorialReviewById(editorialId);
    assert.ok(review);
    const assessment = assessEditorialReviewPublication(review);
    const expected = EXPECTED_EVIDENCE.get(editorialId);
    assert.ok(expected);
    assert.equal(assessment.corroboratedClaimCount, expected.corroborated, editorialId);
    assert.equal(assessment.singleSourceClaimCount, expected.singleSource, editorialId);
    assert.equal(assessment.uncertainCategoryCount, expected.uncertain, editorialId);
    const present = new Set(review.claims.map((claim) => claim.category));
    const uncertain = new Set(review.uncertainCategories);
    assert.equal(present.size + uncertain.size, 10, editorialId);
    for (const category of present) assert.equal(uncertain.has(category), false, editorialId);
    assert.equal(JSON.stringify(review).includes('"none"'), false, editorialId);
  }
});

test("corroboration and decision gates still fail closed", () => {
  const review = getFrozenEditorialReviewById(ET_ID);
  assert.ok(review);
  const brokenCorroboration = structuredClone(review) as EditorialReviewPublication;
  const index = brokenCorroboration.claims.findIndex((claim) => claim.verification === "corroborated");
  assert.notEqual(index, -1);
  const claim = brokenCorroboration.claims[index];
  brokenCorroboration.claims[index] = { ...claim, sourceIds: [claim.sourceIds[0]] };
  for (const source of brokenCorroboration.sources) {
    source.supportedClaimIds = source.supportedClaimIds.filter((claimId) => claimId !== claim.id || source.id === claim.sourceIds[0]);
  }
  assert.equal(assessEditorialReviewPublication(brokenCorroboration).publishable, false);

  const promoted = structuredClone(review) as EditorialReviewPublication & { decisionEligible: boolean; decisionStatus: string };
  promoted.decisionEligible = true;
  promoted.decisionStatus = "suitable";
  const assessment = assessEditorialReviewPublication(promoted as EditorialReviewPublication);
  assert.equal(assessment.publishable, false);
  assert.ok(assessment.issues.some((issue) => issue.code === "DECISION_GATE_INVALID"));
});

test("editorial metadata helpers preserve canonical URLs and insufficient-data descriptions", () => {
  for (const editorialId of ALL_IDS) {
    const review = getFrozenEditorialReviewById(editorialId);
    assert.ok(review);
    assert.equal(buildPublicEditorialReviewCanonicalUrl(editorialId), `https://qabl-almushahada.buildtools.workers.dev/review?editorialId=${encodeURIComponent(editorialId)}`);
    assert.equal(buildPublicEditorialReviewHref(editorialId), `/review?editorialId=${encodeURIComponent(editorialId)}`);
    const description = buildEditorialReviewDescription(review);
    assert.match(description, /تحليل عربي/u);
    assert.match(description, /لا يصدر حكم ملاءمة نهائي/u);
    assert.match(description, new RegExp(`${review.uncertainCategories.length} من 10`, "u"));
  }
});

test("public routes stay D1-only, canonical, structured and fail closed", () => {
  const routeSource = readFileSync(new URL("../app/review/page.tsx", import.meta.url), "utf8");
  const viewSource = readFileSync(new URL("../app/review/editorial-review-view.tsx", import.meta.url), "utf8");
  const sitemapSource = readFileSync(new URL("../app/sitemap.xml/route.ts", import.meta.url), "utf8");
  assert.match(routeSource, /export async function generateMetadata/u);
  assert.match(routeSource, /alternates: \{ canonical \}/u);
  assert.match(routeSource, /robots: \{ index: true, follow: true \}/u);
  assert.match(routeSource, /loadEditorialPublicationById/u);
  assert.match(routeSource, /if \(\[bundleId, publicationId, editorialId\]\.filter\(Boolean\)\.length !== 1\) return <ReviewUnavailable \/>/u);
  assert.doesNotMatch(routeSource, /editorial-review-registry/u);
  assert.match(viewSource, /application\/ld\+json/u);
  assert.match(viewSource, /"@type": "Article"/u);
  assert.match(viewSource, /citation: review\.sources\.map/u);
  assert.match(sitemapSource, /listEditorialPublications/u);
  assert.doesNotMatch(sitemapSource, /listEditorialReviewPublications|editorial-review-registry/u);
});
