import assert from "node:assert/strict";
import test from "node:test";

import {
  EVIDENCE_PUBLICATION_GATE_VERSION,
  EVIDENCE_PUBLIC_DISCLOSURE_AR,
  prepareEvidencePublication,
  type EvidencePublicationInput,
} from "../lib/evidence-publication.ts";
import type {
  EvidenceCategoryAssertion,
  EvidenceFact,
  EvidenceSourceRef,
} from "../lib/evidence-review.ts";
import { CONTENT_CATEGORIES, type ContentCategory } from "../lib/review-engine/types.ts";
import { prepareAnalysisEvidenceSourceProvenance } from "../lib/source-provenance.ts";

const VERSION_ID = "version-publication-test";
const SOURCE_ID = "evidence:wikipedia:en:123:456";

function fixture(): EvidencePublicationInput {
  const provenance = prepareAnalysisEvidenceSourceProvenance({
    id: SOURCE_ID,
    versionId: VERSION_ID,
    source: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Example",
    sourceRevision: "456",
    sourceLicense: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attributionText: "Wikipedia contributors, Example, revision 456, CC BY-SA 4.0.",
    retrievedAt: "2026-08-13T08:00:00.000Z",
    contentSha256: "a".repeat(64),
    ingestionMode: "automated",
  });
  const source: EvidenceSourceRef = {
    id: provenance.id,
    versionId: provenance.versionId,
    policySnapshotId: provenance.policySnapshotId,
    sourceKey: "wikipedia",
    sourceUrl: provenance.sourceUrl,
    sourceRevision: provenance.sourceRevision,
    contentSha256: provenance.contentSha256,
  };
  const assertions = CONTENT_CATEGORIES.map((category) => assertion(category, "none"));
  const violenceIndex = assertions.findIndex((item) => item.category === "violence");
  assertions[violenceIndex] = assertion("violence", "present");
  const facts = [fact("violence", assertions[violenceIndex].id, 2)];
  return { versionId: VERSION_ID, sources: [source], provenance: [provenance], assertions, facts };
}

function assertion(
  category: ContentCategory,
  result: EvidenceCategoryAssertion["result"],
): EvidenceCategoryAssertion {
  return {
    id: `assertion:${category}`,
    evidenceSourceId: SOURCE_ID,
    category,
    result,
    extractionMethod: "manual",
    extractorVersion: "fixture-1",
    sourceLocator: `section:${category}`,
    summaryAr: result === "present" ? `يوجد محتوى في محور ${category}.` : `المصدر يحسم عدم وجود ${category}.`,
  };
}

function fact(
  category: ContentCategory,
  assertionId: string,
  severity: 1 | 2 | 3 | 4,
): EvidenceFact {
  return {
    id: `fact:${category}`,
    assertionId,
    category,
    severity,
    frequency: "unknown",
    context: "unknown",
    spoilerLevel: "contextual",
    summaryAr: `واقعة منظمة في محور ${category}.`,
    startSecond: null,
    endSecond: null,
    flags: [],
  };
}

test("ready licensed evidence prepares an independent publication without a human-watch claim", () => {
  const input = fixture();
  const prepared = prepareEvidencePublication(input);
  assert.equal(prepared.allowed, true);
  if (!prepared.allowed) return;

  assert.equal(prepared.publication.reviewMethod, "evidence_based");
  assert.equal(prepared.publication.humanWatchConfirmed, false);
  assert.equal(prepared.publication.publicationGateVersion, EVIDENCE_PUBLICATION_GATE_VERSION);
  assert.equal(prepared.publication.disclosureAr, EVIDENCE_PUBLIC_DISCLOSURE_AR);
  assert.equal(prepared.publication.assessment.status, "ready");
  assert.equal(prepared.publication.sources[0].provenance.id, SOURCE_ID);
});

test("uncertain coverage can never cross the publication gate", () => {
  const input = fixture();
  input.assertions = input.assertions.map((item) =>
    item.category === "substances" ? { ...item, result: "uncertain" as const } : item,
  );

  const prepared = prepareEvidencePublication(input);
  assert.equal(prepared.allowed, false);
  if (prepared.allowed) return;
  assert.ok(prepared.blockers.includes("EVIDENCE_NOT_READY"));
});

test("model-assisted extraction cannot convert silence into an explicit none claim", () => {
  const input = fixture();
  input.assertions = input.assertions.map((item) =>
    item.category === "fear"
      ? { ...item, extractionMethod: "model_assisted" as const, result: "none" as const }
      : item,
  );

  const prepared = prepareEvidencePublication(input);
  assert.equal(prepared.allowed, false);
  if (prepared.allowed) return;
  assert.ok(prepared.blockers.includes("MODEL_ASSISTED_NONE_FORBIDDEN"));
});

test("publication provenance must be the exact evidence identity used by the claims", () => {
  const input = fixture();
  input.provenance[0] = { ...input.provenance[0], contentSha256: "b".repeat(64) };

  const prepared = prepareEvidencePublication(input);
  assert.equal(prepared.allowed, false);
  if (prepared.allowed) return;
  assert.ok(prepared.blockers.includes("PROVENANCE_IDENTITY_MISMATCH"));
});

test("stale or forbidden source policy cannot be published even when the evidence assessment is ready", () => {
  const stale = fixture();
  stale.sources[0] = { ...stale.sources[0], policySnapshotId: "source-policy:wikipedia:old:analysis_evidence" };
  stale.provenance[0] = { ...stale.provenance[0], policySnapshotId: "source-policy:wikipedia:old:analysis_evidence" };
  const stalePrepared = prepareEvidencePublication(stale);
  assert.equal(stalePrepared.allowed, false);
  if (!stalePrepared.allowed) assert.ok(stalePrepared.blockers.includes("SOURCE_POLICY_NOT_CURRENT"));

  const forbidden = fixture();
  forbidden.sources[0] = { ...forbidden.sources[0], sourceKey: "tmdb" };
  const forbiddenPrepared = prepareEvidencePublication(forbidden);
  assert.equal(forbiddenPrepared.allowed, false);
  if (!forbiddenPrepared.allowed) assert.ok(forbiddenPrepared.blockers.includes("SOURCE_POLICY_NOT_CURRENT"));
});

test("publication source refs and persisted provenance must be a one-to-one set", () => {
  const input = fixture();
  input.provenance = [];

  const prepared = prepareEvidencePublication(input);
  assert.equal(prepared.allowed, false);
  if (prepared.allowed) return;
  assert.ok(prepared.blockers.includes("PROVENANCE_SET_MISMATCH"));
});

test("publication input is bounded before any persistence plan is allowed", () => {
  const input = fixture();
  input.sources = Array.from({ length: 9 }, (_, index) => ({
    ...input.sources[0],
    id: `${SOURCE_ID}:${index}`,
  }));

  const prepared = prepareEvidencePublication(input);
  assert.equal(prepared.allowed, false);
  if (prepared.allowed) return;
  assert.ok(prepared.blockers.includes("INPUT_BOUNDS_INVALID"));
});
