import assert from "node:assert/strict";
import test from "node:test";

import {
  assessReviewQuality,
  assessThirdReviewRequirement,
  createVerifiedDemoBundle,
  type ContentCategory,
  type ContentFlag,
  type ObservedSeverity,
  type ReviewBundle,
} from "../lib/review-engine/index.ts";

function cloneBundle(): ReviewBundle {
  return structuredClone(createVerifiedDemoBundle());
}

function addConsistentObservation(
  bundle: ReviewBundle,
  category: ContentCategory,
  severity: ObservedSeverity,
  flags: ContentFlag[] = [],
): void {
  bundle.submissions.forEach((submission, index) => {
    submission.categoryChecks[category] = "present";
    submission.observations.push({
      id: `risk-${category}-${index + 1}`,
      category,
      severity,
      startSecond: 300,
      endSecond: 315,
      frequency: "single",
      context: "distressing",
      spoilerLevel: "none",
      summary: "واقعة اختبار متطابقة لاختبار سياسة المراجعة الثالثة.",
      flags: [...flags],
    });
  });
}

function addThirdIndependentReviewer(bundle: ReviewBundle, independenceGroupId = "independent-group-third"): void {
  const third = structuredClone(bundle.submissions[1]);
  third.id = "submission-reviewer-third";
  third.reviewer = {
    id: "reviewer-third",
    independenceGroupId,
    status: "active",
  };
  third.observations = third.observations.map((observation, index) => ({
    ...observation,
    id: `obs-third-${index + 1}`,
  }));
  bundle.submissions.push(third);

  const approval = bundle.editorialApproval;
  assert.ok(approval);
  approval.reviewedSubmissionIds.push(third.id);
  approval.spotChecks.push({
    observationId: third.observations[0].id,
    result: "confirmed",
  });
}

test("normal demo content keeps the universal two-reviewer floor", () => {
  const bundle = cloneBundle();
  const requirement = assessThirdReviewRequirement(bundle.submissions);
  assert.equal(requirement.required, false);
  assert.equal(requirement.minimumReviewerCount, 2);
  assert.equal(assessReviewQuality(bundle).publishable, true);
});

test("any self-harm observation requires a third independent reviewer", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "selfHarm", 1);

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((issue) => issue.code === "THIRD_REVIEW_REQUIRED"));
  assert.ok(quality.issues.some((issue) => issue.code === "THIRD_INDEPENDENT_REVIEW_REQUIRED"));
});

test("mild sexual content below the explicit threshold does not escalate", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "sexualContent", 1);

  const requirement = assessThirdReviewRequirement(bundle.submissions);
  assert.equal(requirement.required, false);
  assert.equal(assessReviewQuality(bundle).publishable, true);
});

test("sexual content at severity two escalates to three reviewers", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "sexualContent", 2);

  const requirement = assessThirdReviewRequirement(bundle.submissions);
  assert.equal(requirement.required, true);
  assert.ok(requirement.triggers.some((trigger) => trigger.code === "sensitive_category_threshold"));
  assert.equal(assessReviewQuality(bundle).publishable, false);
});

test("a flashing-sequence flag escalates even at severity one", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "flashingLights", 1, ["flashing_sequence"]);

  const requirement = assessThirdReviewRequirement(bundle.submissions);
  assert.equal(requirement.required, true);
  assert.ok(
    requirement.triggers.some(
      (trigger) => trigger.code === "sensitive_flag_threshold" && trigger.flag === "flashing_sequence",
    ),
  );
});

test("severity four in any category always escalates", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "grief", 4);

  const requirement = assessThirdReviewRequirement(bundle.submissions);
  assert.equal(requirement.required, true);
  assert.ok(requirement.triggers.some((trigger) => trigger.code === "severity_4_any_category"));
});

test("three active independent reviewers satisfy the high-risk reviewer-count gate", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "selfHarm", 1);
  addThirdIndependentReviewer(bundle);

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, true);
  assert.equal(quality.issues.some((issue) => issue.code === "THIRD_REVIEW_REQUIRED"), false);
  assert.equal(quality.issues.some((issue) => issue.code === "THIRD_INDEPENDENT_REVIEW_REQUIRED"), false);
  assert.equal(quality.eligibleSubmissionIds.length, 3);
});

test("three reviewers from only two independence groups still fail closed", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "selfHarm", 1);
  addThirdIndependentReviewer(bundle, bundle.submissions[0].reviewer.independenceGroupId);

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.equal(quality.issues.some((issue) => issue.code === "THIRD_REVIEW_REQUIRED"), false);
  assert.ok(quality.issues.some((issue) => issue.code === "THIRD_INDEPENDENT_REVIEW_REQUIRED"));
});

test("a suspended third reviewer never satisfies the high-risk gate", () => {
  const bundle = cloneBundle();
  addConsistentObservation(bundle, "selfHarm", 1);
  addThirdIndependentReviewer(bundle);
  bundle.submissions[2].reviewer.status = "suspended";

  const quality = assessReviewQuality(bundle);
  assert.equal(quality.publishable, false);
  assert.ok(quality.issues.some((issue) => issue.code === "THIRD_REVIEW_REQUIRED"));
});
