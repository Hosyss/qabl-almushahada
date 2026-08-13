import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicEvidenceReviewGateQuery } from "../db/public-evidence-review-query.ts";
import {
  buildPublicEvidenceReviewHref,
  buildPublicEvidenceReviewView,
  parsePublicEvidenceReviewLocator,
  type PublicEvidenceReviewMetadata,
  type PublicEvidenceReviewSource,
} from "../lib/public-evidence-review.ts";
import type {
  EvidenceCategoryAssertion,
  EvidenceFact,
  EvidenceSourceRef,
} from "../lib/evidence-review.ts";
import { CONTENT_CATEGORIES, type ContentCategory } from "../lib/review-engine/types.ts";

const PUBLICATION_ID = "evpub:test-publication";
const VERSION_ID = "version-public-evidence";
const SOURCE_ID = "evidence:wikipedia:en:123:456";
const POLICY_ID = "source-policy:wikipedia:2026-08-13.1:analysis_evidence";

function metadata(): PublicEvidenceReviewMetadata {
  return {
    publicationId: PUBLICATION_ID,
    headRevision: 1,
    publicationRevision: 1,
    reviewMethod: "evidence_based",
    humanWatchConfirmed: false,
    publicationGateVersion: "2026-08-13.1",
    publishedAt: "2026-08-13T09:00:00.000Z",
    titleId: "title-public-evidence",
    canonicalName: "عنوان تجريبي",
    originalName: "Example title",
    kind: "movie",
    releaseYear: 2026,
    versionId: VERSION_ID,
    editionLabel: "نسخة تجريبية",
    platform: "streaming",
    language: "ar",
    runtimeSeconds: 6000,
  };
}

function source(): EvidenceSourceRef {
  return {
    id: SOURCE_ID,
    versionId: VERSION_ID,
    policySnapshotId: POLICY_ID,
    sourceKey: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Example",
    sourceRevision: "456",
    contentSha256: "a".repeat(64),
  };
}

function publicSource(): PublicEvidenceReviewSource {
  return {
    id: SOURCE_ID,
    sourceKey: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Example",
    sourceRevision: "456",
    sourceLicense: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attributionText: "Wikipedia contributors, Example, revision 456, CC BY-SA 4.0.",
    shareAlike: true,
    retrievedAt: "2026-08-13T08:00:00.000Z",
  };
}

function assertion(
  category: ContentCategory,
  result: EvidenceCategoryAssertion["result"],
): EvidenceCategoryAssertion {
  return {
    id: `pub-assertion:${category}`,
    evidenceSourceId: SOURCE_ID,
    category,
    result,
    extractionMethod: "manual",
    extractorVersion: "fixture-1",
    sourceLocator: `section:${category}`,
    summaryAr: result === "present" ? `يوجد ${category}.` : `لا يوجد ${category}.`,
  };
}

function snapshot() {
  const assertions = CONTENT_CATEGORIES.map((category) => assertion(category, "none"));
  const violenceIndex = assertions.findIndex((item) => item.category === "violence");
  assertions[violenceIndex] = assertion("violence", "present");
  const facts: EvidenceFact[] = [
    {
      id: "pub-fact:violence",
      assertionId: assertions[violenceIndex].id,
      category: "violence",
      severity: 2,
      frequency: "unknown",
      context: "unknown",
      spoilerLevel: "contextual",
      summaryAr: "واقعة عنف موصوفة في الدليل.",
      startSecond: null,
      endSecond: null,
      flags: ["weapon"],
    },
  ];
  return { assertions, facts };
}

test("public evidence locator accepts only one bounded publication id", () => {
  assert.deepEqual(parsePublicEvidenceReviewLocator({ publicationId: PUBLICATION_ID }), {
    publicationId: PUBLICATION_ID,
  });
  assert.throws(() => parsePublicEvidenceReviewLocator({ publicationId: PUBLICATION_ID, bundleId: "x" }));
  assert.throws(() => parsePublicEvidenceReviewLocator({ publicationId: "" }));
  assert.equal(
    buildPublicEvidenceReviewHref("evpub:id with spaces"),
    "/review?publicationId=evpub%3Aid%20with%20spaces",
  );
});

test("ready persisted evidence becomes a public view without inventing a human reviewer", () => {
  const data = snapshot();
  const view = buildPublicEvidenceReviewView({
    metadata: metadata(),
    sources: [publicSource()],
    evidenceSources: [source()],
    assertions: data.assertions,
    facts: data.facts,
  });

  assert.ok(view);
  assert.equal(view.reviewMethod, "evidence_based");
  assert.equal(view.humanWatchConfirmed, false);
  assert.match(view.disclosureAr, /لا تدّعي أن إنسانًا/);
  assert.equal(view.sourceCount, 1);
  assert.equal(view.factCount, 1);
  assert.equal(view.categories.find((item) => item.id === "violence")?.severity, 2);
  assert.equal(view.categories.find((item) => item.id === "fear")?.coverage, "none");
  assert.equal(view.categories.find((item) => item.id === "violence")?.facts[0].startSecond, null);
  assert.equal(view.categories.find((item) => item.id === "violence")?.facts[0].sourceLocator, "section:violence");
  assert.equal(view.sources[0].sourceLicense, "CC BY-SA 4.0");
  assert.equal(view.sources[0].shareAlike, true);
});

test("public evidence view fails closed when human watch is claimed on the evidence path", () => {
  const data = snapshot();
  const invalidMetadata = {
    ...metadata(),
    humanWatchConfirmed: true,
  } as unknown as PublicEvidenceReviewMetadata;
  const view = buildPublicEvidenceReviewView({
    metadata: invalidMetadata,
    sources: [publicSource()],
    evidenceSources: [source()],
    assertions: data.assertions,
    facts: data.facts,
  });
  assert.equal(view, null);
});

test("public evidence view re-runs coverage and refuses uncertain snapshots", () => {
  const data = snapshot();
  data.assertions = data.assertions.map((item) =>
    item.category === "substances" ? { ...item, result: "uncertain" as const } : item,
  );
  const view = buildPublicEvidenceReviewView({
    metadata: metadata(),
    sources: [publicSource()],
    evidenceSources: [source()],
    assertions: data.assertions,
    facts: data.facts,
  });
  assert.equal(view, null);
});

test("public evidence SQL gates the current immutable head and never interpolates the locator", () => {
  const locator = "evpub:' OR 1=1 --";
  const query = buildPublicEvidenceReviewGateQuery(locator, {
    headRevision: 4,
    publicationRevision: 4,
  });
  assert.equal(query.bindings[0], locator);
  assert.equal(query.bindings[1], 4);
  assert.equal(query.bindings[2], 4);
  assert.equal(query.sql.includes(locator), false);
  assert.match(query.sql, /head\.current_publication_id = publication\.id/);
  assert.match(query.sql, /version\.status = 'active'/);
  assert.match(query.sql, /publication\.human_watch_confirmed = 0/);
  assert.match(query.sql, /policy\.use_scope <> 'analysis_evidence'/);
  assert.match(query.sql, /assertion\.result = 'uncertain'/);
});
