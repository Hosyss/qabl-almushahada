import assert from "node:assert/strict";
import test from "node:test";

import {
  assessEvidenceReview,
  type EvidenceCategoryAssertion,
  type EvidenceFact,
  type EvidenceReviewInput,
  type EvidenceSourceRef,
} from "../lib/evidence-review.ts";
import { CONTENT_CATEGORIES, type ContentCategory } from "../lib/review-engine/types.ts";

const VERSION_ID = "version-evidence-test";

function source(id: string): EvidenceSourceRef {
  return {
    id,
    versionId: VERSION_ID,
    policySnapshotId: `policy:${id}`,
    sourceKey: id.startsWith("wiki") ? "wikipedia" : "licensed_fixture",
    sourceUrl: `https://example.com/evidence/${id}`,
    sourceRevision: "r1",
    contentSha256: id === "source-b" ? "b".repeat(64) : "a".repeat(64),
  };
}

function assertion(
  category: ContentCategory,
  result: EvidenceCategoryAssertion["result"],
  evidenceSourceId = "source-a",
  suffix = "1",
): EvidenceCategoryAssertion {
  return {
    id: `assertion:${category}:${evidenceSourceId}:${suffix}`,
    evidenceSourceId,
    category,
    result,
    extractionMethod: "manual",
    extractorVersion: "fixture-1",
    sourceLocator: `section:${category}:${suffix}`,
    summaryAr: result === "present" ? `المصدر يثبت وجود ${category}.` : `المصدر يحسم ${category} كـ${result}.`,
  };
}

function fact(
  category: ContentCategory,
  assertionId: string,
  severity: 1 | 2 | 3 | 4,
  suffix = "1",
): EvidenceFact {
  return {
    id: `fact:${category}:${suffix}`,
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

function fullyCoveredInput(): EvidenceReviewInput {
  const assertions = CONTENT_CATEGORIES.map((category) => assertion(category, "none"));
  const violenceIndex = assertions.findIndex((item) => item.category === "violence");
  assertions[violenceIndex] = assertion("violence", "present");
  return {
    versionId: VERSION_ID,
    sources: [source("source-a")],
    assertions,
    facts: [fact("violence", assertions[violenceIndex].id, 2)],
  };
}

test("explicit complete coverage can become engine-eligible without inventing reviewer identities", () => {
  const assessment = assessEvidenceReview(fullyCoveredInput());

  assert.equal(assessment.status, "ready");
  assert.equal(assessment.engineEligible, true);
  assert.equal(assessment.issues.length, 0);
  assert.equal(assessment.categoryCoverage.violence.status, "covered_present");
  assert.equal(assessment.categoryCoverage.violence.maxSeverity, 2);
  assert.equal(assessment.categoryCoverage.sexualContent.status, "covered_none");
  assert.deepEqual(assessment.resolvedFacts.map((item) => item.id), ["fact:violence:1"]);
});

test("silence about a category is unknown, never equivalent to none", () => {
  const input = fullyCoveredInput();
  input.assertions = input.assertions.filter((item) => item.category !== "sexualContent");

  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.status, "insufficient_data");
  assert.equal(assessment.engineEligible, false);
  assert.equal(assessment.categoryCoverage.sexualContent.status, "unknown");
  assert.ok(
    assessment.issues.some(
      (item) => item.code === "CATEGORY_NOT_COVERED" && item.category === "sexualContent",
    ),
  );
});

test("uncertain evidence does not count as negative coverage", () => {
  const input = fullyCoveredInput();
  input.assertions = input.assertions.map((item) =>
    item.category === "substances" ? assertion("substances", "uncertain") : item,
  );

  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.status, "insufficient_data");
  assert.equal(assessment.categoryCoverage.substances.status, "unknown");
});

test("explicit none versus present across evidence sources is a blocking conflict", () => {
  const input = fullyCoveredInput();
  input.sources.push(source("source-b"));
  const second = assertion("sexualContent", "present", "source-b");
  input.assertions.push(second);
  input.facts.push(fact("sexualContent", second.id, 1, "source-b"));

  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.status, "conflicted");
  assert.equal(assessment.engineEligible, false);
  assert.equal(assessment.categoryCoverage.sexualContent.status, "conflicted");
  assert.ok(assessment.issues.some((item) => item.code === "PRESENCE_CONFLICT"));
});

test("severity delta of two between independent source records blocks the evidence review", () => {
  const input = fullyCoveredInput();
  input.sources.push(source("source-b"));

  const violenceA = input.assertions.find((item) => item.category === "violence")!;
  input.facts = [fact("violence", violenceA.id, 1, "source-a")];

  const violenceB = assertion("violence", "present", "source-b");
  input.assertions.push(violenceB);
  input.facts.push(fact("violence", violenceB.id, 3, "source-b"));

  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.status, "conflicted");
  assert.equal(assessment.categoryCoverage.violence.status, "conflicted");
  assert.ok(assessment.issues.some((item) => item.code === "SEVERITY_CONFLICT"));
});

test("a fact attached to a none assertion fails closed", () => {
  const input = fullyCoveredInput();
  const fearAssertion = input.assertions.find((item) => item.category === "fear")!;
  input.facts.push(fact("fear", fearAssertion.id, 1, "invalid-none"));

  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.engineEligible, false);
  assert.ok(assessment.issues.some((item) => item.code === "FACT_ON_NON_PRESENT_ASSERTION"));
});

test("present assertions require an explanatory fact", () => {
  const input = fullyCoveredInput();
  const griefAssertion = assertion("grief", "present");
  input.assertions = input.assertions.map((item) =>
    item.category === "grief" ? griefAssertion : item,
  );

  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.status, "insufficient_data");
  assert.ok(
    assessment.issues.some(
      (item) => item.code === "PRESENT_WITHOUT_FACT" && item.category === "grief",
    ),
  );
});

test("evidence may omit exact runtime timing rather than fabricate timestamps", () => {
  const input = fullyCoveredInput();
  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.engineEligible, true);
  assert.equal(assessment.resolvedFacts[0].startSecond, null);
  assert.equal(assessment.resolvedFacts[0].endSecond, null);
});

test("cross-version evidence is rejected before coverage can reach the engine", () => {
  const input = fullyCoveredInput();
  input.sources[0] = { ...input.sources[0], versionId: "different-version" };

  const assessment = assessEvidenceReview(input);
  assert.equal(assessment.engineEligible, false);
  assert.ok(assessment.issues.some((item) => item.code === "SOURCE_VERSION_MISMATCH"));
});
