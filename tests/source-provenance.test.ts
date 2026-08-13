import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAnalysisEvidenceSourceReady,
  buildCurrentSourcePolicySnapshot,
  prepareCatalogSourceProvenance,
} from "../lib/source-provenance.ts";

test("current persistable policy snapshot is exactly Wikidata catalog CC0", () => {
  const snapshot = buildCurrentSourcePolicySnapshot("wikidata", "catalog_metadata");
  assert.deepEqual(snapshot, {
    id: "source-policy:wikidata:2026-08-13.1:catalog_metadata",
    sourceKey: "wikidata",
    policyVersion: "2026-08-13.1",
    useScope: "catalog_metadata",
    decision: "allow",
    licenseLabel: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    policyUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
    attributionRequired: false,
    shareAlike: false,
    automatedIngestionAllowed: true,
    commercialUseAllowed: true,
    verifiedOn: "2026-08-13",
  });
});

test("catalog provenance normalizes retrieval time and keeps immutable source identity inputs", () => {
  const record = prepareCatalogSourceProvenance({
    id: "catalog-source:wd:Q123:abc",
    titleId: "wd:Q123",
    source: "wikidata",
    sourceEntityId: "Q123",
    sourceUrl: "https://www.wikidata.org/wiki/Q123",
    sourceRevision: "1234567890",
    retrievedAt: "2026-08-13T04:00:00Z",
    contentSha256: "a".repeat(64),
    ingestionMode: "automated",
  });

  assert.equal(record.policySnapshotId, "source-policy:wikidata:2026-08-13.1:catalog_metadata");
  assert.equal(record.retrievedAt, "2026-08-13T04:00:00.000Z");
  assert.equal(record.sourceRevision, "1234567890");
  assert.equal(record.contentSha256, "a".repeat(64));
});

test("catalog provenance rejects mismatched QID URLs, non-HTTPS and invalid hashes", () => {
  const valid = {
    id: "catalog-source:wd:Q123:abc",
    titleId: "wd:Q123",
    source: "wikidata" as const,
    sourceEntityId: "Q123",
    sourceUrl: "https://www.wikidata.org/wiki/Q123",
    retrievedAt: "2026-08-13T04:00:00Z",
    contentSha256: "b".repeat(64),
    ingestionMode: "automated" as const,
  };

  assert.throws(
    () => prepareCatalogSourceProvenance({ ...valid, sourceUrl: "https://www.wikidata.org/wiki/Q999" }),
    /must match sourceEntityId/,
  );
  assert.throws(
    () => prepareCatalogSourceProvenance({ ...valid, sourceUrl: "http://www.wikidata.org/wiki/Q123" }),
    /HTTPS URL/,
  );
  assert.throws(
    () => prepareCatalogSourceProvenance({ ...valid, contentSha256: "B".repeat(64) }),
    /lowercase SHA-256/,
  );
  assert.throws(
    () => prepareCatalogSourceProvenance({ ...valid, sourceEntityId: "123" }),
    /must be a QID/,
  );
});

test("analysis evidence stays disabled until a source-specific persistable policy is enabled", () => {
  assert.throws(
    () => assertAnalysisEvidenceSourceReady("wikipedia", "manual"),
    /provenance persistence is not allowed/,
  );
  assert.throws(
    () => assertAnalysisEvidenceSourceReady("imdb", "manual"),
    /provenance persistence is not allowed/,
  );
  assert.throws(
    () => assertAnalysisEvidenceSourceReady("tmdb", "automated"),
    /provenance persistence is not allowed/,
  );
});
