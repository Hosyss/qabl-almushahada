import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPublicCatalogCanonicalUrl,
  buildPublicCatalogDescription,
  buildPublicCatalogTitleHref,
  parsePublicCatalogQid,
  publicCatalogTitleIdFromQid,
} from "../lib/public-catalog.ts";
import {
  prepareWikidataCatalogImportPlan,
  type WikidataCatalogTitle,
} from "../lib/wikidata-catalog.ts";

const TITLE: WikidataCatalogTitle = {
  id: "wd:Q12345",
  wikidataEntityId: "Q12345",
  canonicalName: "فيلم قانوني",
  originalName: null,
  kind: "movie",
  releaseYear: 2026,
  sourceUrl: "https://www.wikidata.org/wiki/Q12345",
  sourceLicense: "CC0 1.0",
};

test("P3S-08 production plan couples each catalog title to immutable Wikidata provenance", async () => {
  const plan = await prepareWikidataCatalogImportPlan([TITLE], {
    retrievedAt: "2026-08-13T10:30:00.000Z",
  });

  assert.equal(plan.source, "wikidata");
  assert.equal(plan.license, "CC0 1.0");
  assert.equal(plan.policySnapshot.id, "source-policy:wikidata:2026-08-13.1:catalog_metadata");
  assert.equal(plan.records.length, 1);
  assert.equal(plan.records[0].provenance.titleId, TITLE.id);
  assert.equal(plan.records[0].provenance.sourceEntityId, TITLE.wikidataEntityId);
  assert.equal(plan.records[0].provenance.ingestionMode, "automated");
  assert.match(plan.records[0].provenance.contentSha256, /^[0-9a-f]{64}$/u);
});

test("P3S-08 import SQL writes catalog metadata and provenance but no review state", async () => {
  const plan = await prepareWikidataCatalogImportPlan([TITLE], {
    retrievedAt: "2026-08-13T10:30:00.000Z",
  });

  assert.match(plan.sql, /INSERT INTO titles/u);
  assert.match(plan.sql, /INSERT INTO title_catalog_sources/u);
  assert.match(plan.sql, /ON CONFLICT\(policy_snapshot_id, source_entity_id, content_sha256\) DO NOTHING/u);
  assert.doesNotMatch(
    plan.sql,
    /INSERT INTO (title_versions|review_bundles|review_submissions|editorial_approvals|evidence_review_publications)/u,
  );
});

test("catalog content hash changes when source-backed metadata changes", async () => {
  const first = await prepareWikidataCatalogImportPlan([TITLE], {
    retrievedAt: "2026-08-13T10:30:00.000Z",
  });
  const second = await prepareWikidataCatalogImportPlan(
    [{ ...TITLE, canonicalName: "فيلم قانوني — اسم محدث" }],
    { retrievedAt: "2026-08-13T11:30:00.000Z" },
  );

  assert.notEqual(first.records[0].provenance.contentSha256, second.records[0].provenance.contentSha256);
});

test("public SEO catalog locators accept only bounded Wikidata QIDs", () => {
  assert.equal(parsePublicCatalogQid("Q12345"), "Q12345");
  assert.equal(publicCatalogTitleIdFromQid("Q12345"), "wd:Q12345");
  assert.equal(buildPublicCatalogTitleHref("wd:Q12345"), "/title/Q12345");
  assert.equal(buildPublicCatalogTitleHref("manual-title"), null);
  assert.equal(
    buildPublicCatalogCanonicalUrl("Q12345"),
    "https://qabl-almushahada.buildtools.workers.dev/title/Q12345",
  );
  assert.throws(() => parsePublicCatalogQid("Q0"), /QID/i);
  assert.throws(() => parsePublicCatalogQid("../Q12345"), /QID/i);
});

test("SEO description explicitly separates catalog presence from review publication", () => {
  const description = buildPublicCatalogDescription({
    canonicalName: TITLE.canonicalName,
    kind: TITLE.kind,
    releaseYear: TITLE.releaseYear,
  });
  assert.match(description, /Wikidata/u);
  assert.match(description, /CC0/u);
  assert.match(description, /لا تعني وجود مراجعة/u);
});
