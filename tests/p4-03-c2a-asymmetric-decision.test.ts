import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createArabFamilyProfile } from "../lib/arab-family-policy.ts";
import {
  ARAB_FAMILY_POLICY_VERSION,
  type AsymmetricDecisionEvidence,
  decideAsymmetricFamilySuitability,
} from "../lib/asymmetric-family-decision.ts";
import {
  buildAsymmetricDecisionPresentation,
} from "../lib/asymmetric-decision-presentation.ts";
import {
  assessEditorialReviewPublication,
  EDITORIAL_REVIEW_POLICY_VERSION,
} from "../lib/editorial-review.ts";
import {
  decidePracticalEditorialVerdict,
} from "../lib/editorial-practical-verdict.ts";
import {
  buildEditorialDecisionClaimEvidence,
  EDITORIAL_WORK_LEVEL_DECISION_POLICY_VERSION,
} from "../lib/editorial-work-level-decision.ts";
import { loadFrozenEditorialReviews } from "./helpers/frozen-editorial-reviews.ts";

const JURASSIC_ID = "jurassic-park-1993-editorial-c1-v1";

const frozenEditorialReviews = loadFrozenEditorialReviews();

function getFrozenEditorialReviewById(id: string) {
  return frozenEditorialReviews.find(({ review }) => review.id === id)?.review ?? null;
}

function evidence(overrides: Partial<AsymmetricDecisionEvidence> = {}): AsymmetricDecisionEvidence {
  return {
    decisionScope: "exact_version",
    exactVersionIdentityConfirmed: true,
    fullEvidenceGatePassed: true,
    categories: {
      fear: { result: "none", decisionEligible: true },
      violence: { result: "none", decisionEligible: true },
      sexualContent: { result: "none", decisionEligible: true },
      language: { result: "none", decisionEligible: true },
      substances: { result: "none", decisionEligible: true },
      bullying: { result: "none", decisionEligible: true },
      discrimination: { result: "none", decisionEligible: true },
      selfHarm: { result: "none", decisionEligible: true },
      grief: { result: "none", decisionEligible: true },
      flashingLights: { result: "none", decisionEligible: true },
    },
    ...overrides,
  };
}

function completePresentEvidence(): AsymmetricDecisionEvidence {
  return evidence({
    categories: {
      fear: { result: "present", decisionEligible: true, severity: 2 },
      violence: { result: "present", decisionEligible: true, severity: 2 },
      sexualContent: { result: "present", decisionEligible: true, severity: 1 },
      language: { result: "present", decisionEligible: true, severity: 1 },
      substances: { result: "present", decisionEligible: true, severity: 1 },
      bullying: { result: "present", decisionEligible: true, severity: 1 },
      discrimination: { result: "present", decisionEligible: true, severity: 1 },
      selfHarm: { result: "none", decisionEligible: true },
      grief: { result: "present", decisionEligible: true, severity: 1 },
      flashingLights: { result: "none", decisionEligible: true },
    },
  });
}

test("1. verified present evidence can exceed family limits while five axes remain unknown", () => {
  const jurassic = getFrozenEditorialReviewById(JURASSIC_ID);
  assert.ok(jurassic);
  const workEvidence = buildEditorialDecisionClaimEvidence(jurassic);
  const family = createArabFamilyProfile({ childAge: 8, fearLimit: 0, avoidBullying: true });
  const result = decideAsymmetricFamilySuitability(workEvidence, family);
  assert.equal(result.status, "exceeds_family_limits");
  assert.ok(result.determiningCategories.includes("fear"));
  assert.deepEqual(workEvidence.categories.bullying, { result: "unknown", decisionEligible: false });
  assert.deepEqual(workEvidence.categories.selfHarm, { result: "unknown", decisionEligible: false });
  assert.deepEqual(workEvidence.categories.grief, { result: "unknown", decisionEligible: false });
  assert.deepEqual(workEvidence.categories.flashingLights, { result: "unknown", decisionEligible: false });
  assert.deepEqual(workEvidence.categories.discrimination, { result: "unknown", decisionEligible: false });
});

test("2. unknown remains unknown and is never normalized to none", () => {
  const jurassic = getFrozenEditorialReviewById(JURASSIC_ID);
  assert.ok(jurassic);
  const workEvidence = buildEditorialDecisionClaimEvidence(jurassic);
  for (const category of jurassic.uncertainCategories) {
    assert.deepEqual(workEvidence.categories[category], { result: "unknown", decisionEligible: false });
  }
});

test("3. unknown axes do not erase a separately verified exceedance", () => {
  const result = decideAsymmetricFamilySuitability(
    evidence({
      decisionScope: "work_level",
      exactVersionIdentityConfirmed: false,
      fullEvidenceGatePassed: false,
      categories: {
        fear: { result: "present", decisionEligible: true, severity: 4 },
        violence: { result: "unknown", decisionEligible: false },
        sexualContent: { result: "unknown", decisionEligible: false },
        language: { result: "unknown", decisionEligible: false },
        substances: { result: "unknown", decisionEligible: false },
        bullying: { result: "unknown", decisionEligible: false },
        discrimination: { result: "unknown", decisionEligible: false },
        selfHarm: { result: "unknown", decisionEligible: false },
        grief: { result: "unknown", decisionEligible: false },
        flashingLights: { result: "unknown", decisionEligible: false },
      },
    }),
    createArabFamilyProfile({ childAge: 12, fearLimit: 1, avoidBullying: false }),
  );
  assert.equal(result.status, "exceeds_family_limits");
  assert.deepEqual(result.determiningCategories, ["fear"]);
});

test("4. unknown axes block within-family-limits", () => {
  const result = decideAsymmetricFamilySuitability(
    evidence({
      categories: {
        ...completePresentEvidence().categories,
        grief: { result: "unknown", decisionEligible: false },
      },
    }),
    createArabFamilyProfile({ childAge: 17, fearLimit: 3, avoidBullying: false }),
  );
  assert.equal(result.status, "insufficient_data");
});

test("5. within-family-limits requires exact-version identity and full eligible coverage", () => {
  const family = createArabFamilyProfile({ childAge: 17, fearLimit: 3, avoidBullying: false });
  const complete = completePresentEvidence();
  assert.equal(decideAsymmetricFamilySuitability(complete, family).status, "within_family_limits");
  assert.equal(
    decideAsymmetricFamilySuitability({ ...complete, exactVersionIdentityConfirmed: false }, family).status,
    "insufficient_data",
  );
  assert.equal(
    decideAsymmetricFamilySuitability({ ...complete, fullEvidenceGatePassed: false }, family).status,
    "insufficient_data",
  );
});

test("6. source-ineligible evidence cannot determine a negative result", () => {
  const result = decideAsymmetricFamilySuitability(
    evidence({
      decisionScope: "work_level",
      exactVersionIdentityConfirmed: false,
      fullEvidenceGatePassed: false,
      categories: {
        ...evidence().categories,
        fear: { result: "present", decisionEligible: false, severity: 4 },
      },
    }),
    createArabFamilyProfile({ childAge: 8, fearLimit: 0, avoidBullying: true }),
  );
  assert.equal(result.status, "insufficient_data");
});

test("7. work-level evidence never becomes an exact-version claim", () => {
  const jurassic = getFrozenEditorialReviewById(JURASSIC_ID);
  assert.ok(jurassic);
  const workEvidence = buildEditorialDecisionClaimEvidence(jurassic);
  assert.equal(workEvidence.decisionScope, "work_level");
  assert.equal(workEvidence.exactVersionIdentityConfirmed, false);
  assert.equal(workEvidence.fullEvidenceGatePassed, false);
  assert.equal(workEvidence.policyVersion, EDITORIAL_WORK_LEVEL_DECISION_POLICY_VERSION);
});

test("8. default preferences are explicit in decision presentation and not described as an official rating", () => {
  const family = createArabFamilyProfile({ childAge: 12, fearLimit: 2, avoidBullying: true });
  const result = decideAsymmetricFamilySuitability(completePresentEvidence(), family);
  const presentation = buildAsymmetricDecisionPresentation(result, family);
  assert.equal(family.policyVersion, ARAB_FAMILY_POLICY_VERSION);
  assert.match(presentation.familyPolicyLabelAr, /افتراضية تحريرية/u);
  assert.doesNotMatch(presentation.familyPolicyLabelAr, /رسمي|علمي/u);
});

test("9. customized family limits determine the negative result using the user's selected threshold", () => {
  const family = createArabFamilyProfile({ childAge: 16, fearLimit: 1, avoidBullying: false });
  const result = decideAsymmetricFamilySuitability(completePresentEvidence(), family);
  assert.equal(result.status, "exceeds_family_limits");
  assert.ok(result.determiningCategories.includes("fear"));
});

test("10. Jurassic strict evidence remains source-safe while practical verdict is non-synthetic", () => {
  const jurassic = getFrozenEditorialReviewById(JURASSIC_ID);
  assert.ok(jurassic);
  assert.equal(jurassic.policyVersion, EDITORIAL_REVIEW_POLICY_VERSION);
  const assessment = assessEditorialReviewPublication(jurassic);
  assert.equal(assessment.decisionEligible, false);
  assert.equal(assessment.decisionStatus, "insufficient_data");

  const practical = decidePracticalEditorialVerdict({
    review: jurassic,
    family: createArabFamilyProfile({ childAge: 10, fearLimit: 0, avoidBullying: true }),
    now: new Date("2026-08-18T00:00:00Z"),
  });
  assert.notEqual(practical.outcome, "not_ready");
  assert.equal(practical.confidence, "medium");
});

test("11. existing Full Evidence public view still requires complete coverage and remains unchanged", () => {
  const result = decideAsymmetricFamilySuitability(
    evidence({
      exactVersionIdentityConfirmed: true,
      fullEvidenceGatePassed: false,
    }),
    createArabFamilyProfile({ childAge: 17, fearLimit: 3, avoidBullying: false }),
  );
  assert.equal(result.status, "insufficient_data");
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
  assert.match(practicalUi, /يمكن مشاهدته وفق حدود أسرتك/u);
  assert.doesNotMatch(practicalUi, /ينفع للمشاهدة/u);
  assert.match(practicalUi, /لا أنصح به وفق حدود أسرتك/u);
  assert.match(practicalUi, /لا يحوّل المحاور غير المحسومة إلى «لا يوجد»/u);
});
