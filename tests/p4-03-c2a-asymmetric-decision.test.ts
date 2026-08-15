import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  decideAsymmetricallyForFamily,
  emptyAsymmetricCategoryEvidence,
} from "../lib/asymmetric-family-decision.ts";
import { buildAsymmetricDecisionPresentation } from "../lib/asymmetric-decision-presentation.ts";
import {
  decideEditorialWorkLevelForFamily,
  summarizeEditorialWorkLevelEvidence,
} from "../lib/editorial-work-level-decision.ts";
import { decidePracticalEditorialVerdict } from "../lib/editorial-practical-verdict.ts";
import { createArabFamilyProfile } from "../lib/arab-family-policy.ts";
import { assessEditorialReviewPublication } from "../lib/editorial-review.ts";
import {
  buildPublicEvidenceReviewView,
  type PublicEvidenceReviewMetadata,
  type PublicEvidenceReviewSource,
} from "../lib/public-evidence-review.ts";
import type {
  EvidenceCategoryAssertion,
  EvidenceFact,
  EvidenceSourceRef,
} from "../lib/evidence-review.ts";
import { CONTENT_CATEGORIES, type ContentCategory } from "../lib/review-engine/types.ts";
import { getFrozenEditorialReviewById } from "./editorial-bootstrap-fixtures.ts";

const JURASSIC_ID = "jurassic-park-1993-editorial-c1-v1";

function fullNoneCoverage() {
  const categories = emptyAsymmetricCategoryEvidence();
  for (const category of CONTENT_CATEGORIES) {
    categories[category] = {
      category,
      status: "none",
      severity: 0,
      decisionEligible: true,
      sourceIds: ["source:full"],
      evidenceIds: [`evidence:${category}`],
      flags: [],
    };
  }
  return categories;
}

function markUnknown(categories: ReturnType<typeof emptyAsymmetricCategoryEvidence>, items: ContentCategory[]) {
  for (const category of items) {
    categories[category] = {
      category,
      status: "unknown",
      severity: null,
      decisionEligible: false,
      sourceIds: [],
      evidenceIds: [],
      flags: [],
    };
  }
}

function markPresent(options: {
  categories: ReturnType<typeof emptyAsymmetricCategoryEvidence>;
  category: ContentCategory;
  severity: 1 | 2 | 3 | 4;
  eligible?: boolean;
  sourceId?: string;
}) {
  options.categories[options.category] = {
    category: options.category,
    status: "present",
    severity: options.severity,
    decisionEligible: options.eligible ?? true,
    sourceIds: [options.sourceId ?? "source:allowed"],
    evidenceIds: [`fact:${options.category}`],
    flags: [],
  };
}

test("1. verified present evidence can exceed family limits while five axes remain unknown", () => {
  const categories = fullNoneCoverage();
  markPresent({ categories, category: "fear", severity: 3, sourceId: "wikipedia" });
  markUnknown(categories, ["bullying", "discrimination", "selfHarm", "grief", "flashingLights"]);

  const decision = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 10, fearLimit: 2, avoidBullying: false }),
    categories,
  });

  assert.equal(decision.outcome, "exceeds_family_limits");
  assert.equal(decision.decisionBasis, "verified_present_evidence");
  assert.deepEqual(decision.determiningCategories, ["fear"]);
  assert.equal(decision.unknownCategories.length, 5);
});

test("2. unknown remains unknown and is never normalized to none", () => {
  const categories = fullNoneCoverage();
  markUnknown(categories, ["selfHarm"]);
  const decision = decideAsymmetricallyForFamily({
    scope: "exact_version",
    exactVersionIdentityEstablished: true,
    fullEvidenceGatePassed: true,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 12, avoidBullying: false }),
    categories,
  });
  assert.equal(categories.selfHarm.status, "unknown");
  assert.deepEqual(decision.unknownCategories, ["selfHarm"]);
  assert.equal(decision.outcome, "insufficient_data");
});

test("3. unknown axes do not erase a separately verified exceedance", () => {
  const categories = fullNoneCoverage();
  markPresent({ categories, category: "violence", severity: 4 });
  markUnknown(categories, ["language", "bullying", "sexualContent", "substances", "grief"]);
  const decision = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: true,
    family: createArabFamilyProfile({ childAge: 9, avoidBullying: false }),
    categories,
  });
  assert.equal(decision.outcome, "exceeds_family_limits");
  assert.ok(decision.unknownCategories.includes("grief"));
  assert.ok(decision.reasons.some((reason) => reason.category === "violence"));
});

test("4. unknown axes block within-family-limits", () => {
  const categories = fullNoneCoverage();
  markUnknown(categories, ["flashingLights"]);
  const decision = decideAsymmetricallyForFamily({
    scope: "exact_version",
    exactVersionIdentityEstablished: true,
    fullEvidenceGatePassed: true,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 15, avoidBullying: false }),
    categories,
  });
  assert.equal(decision.outcome, "insufficient_data");
});

test("5. within-family-limits requires exact-version identity and full eligible coverage", () => {
  const categories = fullNoneCoverage();
  markPresent({ categories, category: "fear", severity: 1, sourceId: "source:full" });
  const positive = decideAsymmetricallyForFamily({
    scope: "exact_version",
    exactVersionIdentityEstablished: true,
    fullEvidenceGatePassed: true,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 12, fearLimit: 2, avoidBullying: false }),
    categories,
  });
  assert.equal(positive.outcome, "within_family_limits");
  assert.equal(positive.decisionScope, "exact_version");
  assert.equal(positive.decisionBasis, "full_coverage");

  const gateBlocked = decideAsymmetricallyForFamily({
    scope: "exact_version",
    exactVersionIdentityEstablished: true,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 12, fearLimit: 2, avoidBullying: false }),
    categories,
  });
  assert.equal(gateBlocked.outcome, "insufficient_data");

  categories.grief.decisionEligible = false;
  const ineligibleCoverage = decideAsymmetricallyForFamily({
    scope: "exact_version",
    exactVersionIdentityEstablished: true,
    fullEvidenceGatePassed: true,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 12, fearLimit: 2, avoidBullying: false }),
    categories,
  });
  assert.equal(ineligibleCoverage.outcome, "insufficient_data");
});

test("6. source-ineligible evidence cannot determine a negative result", () => {
  const categories = fullNoneCoverage();
  markPresent({ categories, category: "language", severity: 4, eligible: false, sourceId: "link-only" });
  markUnknown(categories, ["bullying"]);
  const direct = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 9, avoidBullying: false }),
    categories,
  });
  assert.equal(direct.outcome, "insufficient_data");
  assert.deepEqual(direct.ineligiblePresentCategories, ["language"]);

  const review = getFrozenEditorialReviewById(JURASSIC_ID);
  assert.ok(review);
  const result = decideEditorialWorkLevelForFamily({
    review,
    family: createArabFamilyProfile({ childAge: 17, avoidBullying: false }),
    usedDefaultPreferences: false,
    publicationQualityPassed: true,
    severityEvidenceByClaimId: {
      "jurassic-claim-language": {
        severity: 4,
        sourceIds: ["jurassic-source-kids-in-mind"],
        verified: true,
      },
    },
  });
  assert.equal(result.decision.outcome, "insufficient_data");
  assert.ok(result.evidence.referenceOnlyCategories.includes("language"));
  assert.ok(result.evidence.decisionUnknownCategories.includes("language"));

  const qualityBlocked = decideEditorialWorkLevelForFamily({
    review,
    family: createArabFamilyProfile({ childAge: 9, fearLimit: 0, avoidBullying: false }),
    usedDefaultPreferences: false,
    publicationQualityPassed: false,
    severityEvidenceByClaimId: {
      "jurassic-claim-fear": {
        severity: 4,
        sourceIds: ["jurassic-source-wikipedia"],
        verified: true,
      },
    },
  });
  assert.equal(qualityBlocked.decision.outcome, "insufficient_data");
  assert.equal(qualityBlocked.evidence.allowedSourceIds.length, 0);
  assert.equal(qualityBlocked.evidence.publicationQualityPassed, false);
});

test("7. work-level evidence never becomes an exact-version claim", () => {
  const categories = fullNoneCoverage();
  markPresent({ categories, category: "violence", severity: 4 });
  const decision = decideAsymmetricallyForFamily({
    scope: "exact_version",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 9, avoidBullying: false }),
    categories,
  });
  assert.equal(decision.outcome, "exceeds_family_limits");
  assert.equal(decision.decisionScope, "work_level");
  assert.equal(decision.decisionBasis, "verified_present_evidence");
});

test("8. default preferences are explicit in decision presentation and not described as an official rating", () => {
  const categories = fullNoneCoverage();
  markPresent({ categories, category: "fear", severity: 3 });
  const decision = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: true,
    family: createArabFamilyProfile({ childAge: 9, fearLimit: 2, avoidBullying: false }),
    categories,
  });
  const presentation = buildAsymmetricDecisionPresentation(decision);
  assert.equal(presentation.outcomeLabelAr, "يتجاوز حدودك");
  assert.equal(presentation.scopeLabelAr, "على مستوى العمل");
  assert.equal(presentation.basisLabelAr, "دليل موثّق على محتوى موجود");
  assert.match(presentation.preferencesLabelAr, /افتراضية.*قابلة.*للتعديل/u);

  const mixed = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: true,
    preferenceMode: "defaults_with_overrides",
    family: createArabFamilyProfile({ childAge: 9, fearLimit: 2, avoidBullying: false }),
    categories,
  });
  assert.equal(mixed.preferenceMode, "defaults_with_overrides");
  assert.match(buildAsymmetricDecisionPresentation(mixed).preferencesLabelAr, /تعديلاتك المحفوظة/u);

  const policyDoc = readFileSync(new URL("../docs/ARAB_FAMILY_POLICY.md", import.meta.url), "utf8");
  assert.match(policyDoc, /ليست تصنيفًا عمريًا رسميًا/u);
  assert.doesNotMatch(policyDoc, /مناسب من عمر/u);
});

test("9. customized family limits determine the negative result using the user's selected threshold", () => {
  const categories = fullNoneCoverage();
  markPresent({ categories, category: "fear", severity: 2 });
  markUnknown(categories, ["grief"]);

  const strict = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 12, fearLimit: 1, avoidBullying: false }),
    categories,
  });
  const permissive = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    fullEvidenceGatePassed: false,
    usedDefaultPreferences: false,
    family: createArabFamilyProfile({ childAge: 12, fearLimit: 3, avoidBullying: false }),
    categories,
  });

  assert.equal(strict.outcome, "exceeds_family_limits");
  assert.equal(permissive.outcome, "insufficient_data");
  assert.match(buildAsymmetricDecisionPresentation(strict).preferencesLabelAr, /مخصصة بالكامل/u);
});

test("10. Jurassic strict evidence remains source-safe while practical verdict is non-synthetic", () => {
  const review = getFrozenEditorialReviewById(JURASSIC_ID);
  assert.ok(review);
  const { summary } = summarizeEditorialWorkLevelEvidence(review, {}, true);
  assert.deepEqual(new Set(summary.verifiedPresentCategories), new Set(["fear", "violence"]));
  assert.deepEqual(
    new Set(summary.editorialUncertainCategories),
    new Set(["bullying", "discrimination", "selfHarm", "grief", "flashingLights"]),
  );
  assert.deepEqual(
    new Set(summary.referenceOnlyCategories),
    new Set(["language", "substances", "sexualContent"]),
  );
  assert.deepEqual(new Set(summary.severityMissingCategories), new Set(["fear", "violence"]));
  assert.equal(summary.allowedSourceIds.length, 1);
  assert.equal(summary.excludedReferenceOnlySourceIds.length, 1);

  const strictResult = decideEditorialWorkLevelForFamily({
    review,
    family: createArabFamilyProfile({ childAge: 10, fearLimit: 1, avoidBullying: false }),
    usedDefaultPreferences: false,
    publicationQualityPassed: true,
  });
  assert.equal(strictResult.decision.outcome, "insufficient_data");
  assert.equal(strictResult.decision.decisionScope, "work_level");
  assert.equal(strictResult.decision.decisionBasis, "incomplete_evidence");
  assert.deepEqual(new Set(strictResult.decision.severityMissingCategories), new Set(["fear", "violence"]));

  const practical = decidePracticalEditorialVerdict({
    review,
    publicationQualityPassed: true,
    now: new Date("2026-08-15T12:00:00Z"),
  });
  assert.equal(practical.outcome, "watch_with_guidance");
  assert.deepEqual(new Set(practical.unknownCategories), new Set(review.uncertainCategories));
  assert.equal(Object.hasOwn(practical, "severity"), false);
  assert.ok(practical.referenceOnlyCategories.includes("language"));

  const parentUi = readFileSync(new URL("../app/review/editorial-review-view.tsx", import.meta.url), "utf8");
  assert.match(parentUi, /EditorialPracticalVerdict/u);
  assert.match(parentUi, /حكم عملي على مستوى العمل/u);
  assert.match(parentUi, /المحاور غير المحسومة/u);
});

test("11. existing Full Evidence public view still requires complete coverage and remains unchanged", () => {
  const publicationId = "evpub:c2a-full-regression";
  const versionId = "version:c2a-full-regression";
  const sourceId = "evidence:wikipedia:c2a";
  const policyId = "source-policy:wikipedia:2026-08-13.1:analysis_evidence";

  const metadata: PublicEvidenceReviewMetadata = {
    publicationId,
    headRevision: 1,
    publicationRevision: 1,
    reviewMethod: "evidence_based",
    humanWatchConfirmed: false,
    publicationGateVersion: "2026-08-13.1",
    publishedAt: "2026-08-14T00:00:00.000Z",
    titleId: "title:c2a-full-regression",
    canonicalName: "عنوان اختبار",
    originalName: "Regression title",
    kind: "movie",
    releaseYear: 2026,
    versionId,
    editionLabel: "نسخة اختبار",
    platform: "streaming",
    language: "ar",
    runtimeSeconds: 6000,
  };
  const evidenceSource: EvidenceSourceRef = {
    id: sourceId,
    versionId,
    policySnapshotId: policyId,
    sourceKey: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Example",
    sourceRevision: "123",
    contentSha256: "a".repeat(64),
  };
  const publicSource: PublicEvidenceReviewSource = {
    id: sourceId,
    sourceKey: "wikipedia",
    sourceUrl: "https://en.wikipedia.org/wiki/Example",
    sourceRevision: "123",
    sourceLicense: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attributionText: "Wikipedia contributors, Example, revision 123, CC BY-SA 4.0.",
    shareAlike: true,
    retrievedAt: "2026-08-14T00:00:00.000Z",
  };
  const assertions: EvidenceCategoryAssertion[] = CONTENT_CATEGORIES.map((category) => ({
    id: `assertion:${category}`,
    evidenceSourceId: sourceId,
    category,
    result: category === "violence" ? "present" : "none",
    extractionMethod: "manual",
    extractorVersion: "c2a-regression",
    sourceLocator: `section:${category}`,
    summaryAr: category === "violence" ? "توجد واقعة عنف." : `لا يوجد ${category}.`,
  }));
  const facts: EvidenceFact[] = [{
    id: "fact:violence",
    assertionId: "assertion:violence",
    category: "violence",
    severity: 2,
    frequency: "single",
    context: "threatening",
    spoilerLevel: "contextual",
    summaryAr: "واقعة عنف منظمة لاختبار عدم كسر Full Evidence.",
    startSecond: null,
    endSecond: null,
    flags: [],
  }];

  const view = buildPublicEvidenceReviewView({
    metadata,
    sources: [publicSource],
    evidenceSources: [evidenceSource],
    assertions,
    facts,
  });
  assert.ok(view);
  assert.equal(view.categories.length, 10);
  assert.equal(view.categories.find((item) => item.id === "violence")?.severity, 2);
});

test("12. persisted editorial authority stays strict while practical UI applies to mature titles", () => {
  const review = getFrozenEditorialReviewById(JURASSIC_ID);
  assert.ok(review);
  const assessment = assessEditorialReviewPublication(review);
  assert.equal(assessment.publishable, true);
  assert.equal(assessment.decisionEligible, false);
  assert.equal(assessment.decisionStatus, "insufficient_data");

  const reviewPage = readFileSync(new URL("../app/review/page.tsx", import.meta.url), "utf8");
  assert.match(reviewPage, /loadEditorialPublicationById/u);
  assert.match(reviewPage, /EditorialReviewView review=\{persisted\.review\}/u);

  const editorialView = readFileSync(new URL("../app/review/editorial-review-view.tsx", import.meta.url), "utf8");
  assert.match(editorialView, /<EditorialPracticalVerdict review=\{review\}/u);
  assert.doesNotMatch(editorialView, /JURASSIC_C2A_EDITORIAL_ID/u);

  const practicalUi = readFileSync(new URL("../app/review/editorial-practical-verdict.tsx", import.meta.url), "utf8");
  assert.match(practicalUi, /ينفع للمشاهدة/u);
  assert.match(practicalUi, /لا أنصح به وفق حدود أسرتك/u);
  assert.match(practicalUi, /لا يحوّل المحاور غير المحسومة إلى «لا يوجد»/u);
});
