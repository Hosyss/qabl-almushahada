import assert from "node:assert/strict";
import test from "node:test";

import { createArabFamilyProfile } from "../lib/arab-family-policy.ts";
import {
  assessEvidenceReview,
  type EvidenceCategoryAssertion,
  type EvidenceFact,
  type EvidenceSourceRef,
} from "../lib/evidence-review.ts";
import {
  ReviewWorkflowError,
  parseDraftForSubmission,
} from "../lib/internal-review-workflow.ts";
import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  CONTENT_FLAG_DEFINITIONS,
  HIGH_SENSITIVITY_FLAG_THRESHOLDS,
  getContentFlagsForCategory,
  isContentFlagAllowedForCategory,
  type ContentCategory,
  type ContentFlag,
  type ReviewVersion,
} from "../lib/review-engine/index.ts";
import {
  WORKERS_AI_EVIDENCE_RESPONSE_SCHEMA,
  buildWorkersAiEvidenceSystemPrompt,
  extractEvidenceWithWorkersAi,
} from "../lib/workers-ai-evidence-extractor.ts";

const VERSION: ReviewVersion = {
  id: "taxonomy-version",
  titleId: "taxonomy-title",
  editionLabel: "Test edition",
  platform: "test",
  language: "ar",
  releaseYear: 2026,
  runtimeSeconds: 6000,
  contentFingerprint: "taxonomy-fingerprint-2026",
};

const EVIDENCE_SOURCE: EvidenceSourceRef = {
  id: "taxonomy-source",
  versionId: VERSION.id,
  policySnapshotId: "source-policy:wikipedia:2026-08-13.1:analysis_evidence",
  sourceKey: "wikipedia",
  sourceUrl: "https://en.wikipedia.org/wiki/Example",
  sourceRevision: "123",
  contentSha256: "a".repeat(64),
};

const SEXUAL_FLAGS: ContentFlag[] = ["nudity", "kissing", "intimate_touching", "sexual_dialogue"];
const SUBSTANCE_FLAGS: ContentFlag[] = [
  "smoking_or_vaping",
  "alcohol_use",
  "drug_use",
  "gambling_activity",
];

test("taxonomy definitions cover every known flag exactly once", () => {
  assert.deepEqual(
    Object.keys(CONTENT_FLAG_DEFINITIONS).sort(),
    [...CONTENT_FLAGS].sort(),
  );
});

test("sexual and substance subtypes stay in their factual parent categories", () => {
  for (const flag of SEXUAL_FLAGS) {
    assert.equal(isContentFlagAllowedForCategory(flag, "sexualContent"), true, flag);
    assert.equal(isContentFlagAllowedForCategory(flag, "substances"), false, flag);
  }
  for (const flag of SUBSTANCE_FLAGS) {
    assert.equal(isContentFlagAllowedForCategory(flag, "substances"), true, flag);
    assert.equal(isContentFlagAllowedForCategory(flag, "sexualContent"), false, flag);
  }
  assert.deepEqual(
    getContentFlagsForCategory("sexualContent").filter((flag) => SEXUAL_FLAGS.includes(flag)),
    SEXUAL_FLAGS,
  );
});

test("religious marker is cross-cutting descriptive evidence, not a default risk verdict", () => {
  for (const category of CONTENT_CATEGORIES) {
    assert.equal(
      isContentFlagAllowedForCategory("religious_reference_or_practice", category),
      true,
      category,
    );
  }
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      HIGH_SENSITIVITY_FLAG_THRESHOLDS,
      "religious_reference_or_practice",
    ),
    false,
  );
  assert.equal(
    createArabFamilyProfile({ childAge: 12 }).blockedFlags.includes(
      "religious_reference_or_practice",
    ),
    false,
  );
  assert.match(
    CONTENT_FLAG_DEFINITIONS.religious_reference_or_practice.descriptionAr,
    /وصفي|لا يعني بذاته/,
  );
});

test("human review submission accepts a valid objective subtype", () => {
  const draft = completeDraft("sexualContent", "nudity");
  const parsed = parseDraftForSubmission(draft, VERSION);
  assert.deepEqual(parsed.observations[0].flags, ["nudity"]);
});

test("human review submission rejects a subtype attached to the wrong category", () => {
  const draft = completeDraft("violence", "nudity");
  assert.throws(
    () => parseDraftForSubmission(draft, VERSION),
    (error: unknown) => {
      assert.ok(error instanceof ReviewWorkflowError);
      assert.equal(error.code, "INVALID_DRAFT");
      assert.ok(error.details.some((detail) => /nudity.*violence/u.test(detail)));
      return true;
    },
  );
});

test("evidence assessment accepts valid objective subtypes and rejects mismatches", () => {
  const valid = completeEvidence("sexualContent", "nudity");
  const validAssessment = assessEvidenceReview(valid);
  assert.equal(validAssessment.status, "ready");
  assert.equal(validAssessment.engineEligible, true);
  assert.deepEqual(validAssessment.resolvedFacts[0].flags, ["nudity"]);

  const invalid = completeEvidence("sexualContent", "alcohol_use");
  const invalidAssessment = assessEvidenceReview(invalid);
  assert.equal(invalidAssessment.status, "insufficient_data");
  assert.equal(invalidAssessment.engineEligible, false);
  assert.ok(invalidAssessment.issues.some((issue) => issue.code === "FACT_INVALID"));
});

test("Workers AI schema and prompt expose objective subtypes without turning them into judgments", () => {
  const schema = WORKERS_AI_EVIDENCE_RESPONSE_SCHEMA as unknown as {
    properties: {
      claims: {
        items: {
          properties: {
            facts: {
              items: { properties: { flags: { items: { enum: string[] } } } };
            };
          };
        };
      };
    };
  };
  const flagEnum = schema.properties.claims.items.properties.facts.items.properties.flags.items.enum;
  for (const flag of ["nudity", "gambling_activity", "religious_reference_or_practice"]) {
    assert.ok(flagEnum.includes(flag));
  }

  const prompt = buildWorkersAiEvidenceSystemPrompt();
  assert.match(prompt, /nudity/u);
  assert.match(prompt, /gambling_activity/u);
  assert.match(prompt, /religious_reference_or_practice/u);
  assert.match(prompt, /وصفي|لا يعني بذاته/u);
});

test("Workers AI parser refuses a model subtype/category mismatch before assessment", async () => {
  const claims = CONTENT_CATEGORIES.map((category) => ({
    category,
    result: category === "sexualContent" ? "present" : "uncertain",
    summaryAr: category === "sexualContent" ? "المصدر يذكر واقعة حميمية." : "لا يوجد دليل كاف في هذا الجزء.",
    sourceLocators: category === "sexualContent" ? ["P0001"] : [],
    facts: category === "sexualContent"
      ? [
          {
            severity: 1,
            frequency: "single",
            context: "neutral",
            spoilerLevel: "contextual",
            summaryAr: "واقعة موصوفة في النص.",
            sourceLocator: "P0001",
            flags: ["alcohol_use"],
          },
        ]
      : [],
  }));

  await assert.rejects(
    () =>
      extractEvidenceWithWorkersAi({
        ai: {
          async run() {
            return { response: { claims } };
          },
        },
        source: EVIDENCE_SOURCE,
        articleText: "Paragraph with explicit evidence.",
      }),
    /alcohol_use.*sexualContent/u,
  );
});

function completeDraft(category: ContentCategory, flag: ContentFlag) {
  const categoryChecks = Object.fromEntries(
    CONTENT_CATEGORIES.map((item) => [item, item === category ? "present" : "none"]),
  );
  return {
    startedAt: "2026-08-13T08:00:00.000Z",
    completedAt: "2026-08-13T09:40:00.000Z",
    watchedSeconds: 5900,
    declaredComplete: true,
    categoryChecks,
    observations: [
      {
        id: "taxonomy-observation",
        category,
        severity: 1,
        startSecond: 10,
        endSecond: 20,
        frequency: "single",
        context: "neutral",
        spoilerLevel: "contextual",
        summary: "واقعة موضوعية مختصرة.",
        flags: [flag],
      },
    ],
  };
}

function completeEvidence(category: ContentCategory, flag: ContentFlag) {
  const assertions: EvidenceCategoryAssertion[] = CONTENT_CATEGORIES.map((item) => ({
    id: `taxonomy-assertion:${item}`,
    evidenceSourceId: EVIDENCE_SOURCE.id,
    category: item,
    result: item === category ? "present" : "none",
    extractionMethod: "manual",
    extractorVersion: "taxonomy-fixture-1",
    sourceLocator: `section:${item}`,
    summaryAr: item === category ? "المصدر يثبت وجود واقعة." : "المصدر يحسم عدم وجود هذا المحور.",
  }));
  const target = assertions.find((assertion) => assertion.category === category);
  assert.ok(target);
  const facts: EvidenceFact[] = [
    {
      id: "taxonomy-fact",
      assertionId: target.id,
      category,
      severity: 1,
      frequency: "single",
      context: "neutral",
      spoilerLevel: "contextual",
      summaryAr: "واقعة موضوعية مختصرة.",
      startSecond: null,
      endSecond: null,
      flags: [flag],
    },
  ];
  return {
    versionId: VERSION.id,
    sources: [EVIDENCE_SOURCE],
    assertions,
    facts,
  };
}
