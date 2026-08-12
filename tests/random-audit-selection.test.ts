import assert from "node:assert/strict";
import test from "node:test";

import {
  BASELINE_AUDIT_RATE_BPS,
  HIGH_RISK_AUDIT_RATE_BPS,
  UINT32_RANGE,
  planPostSubmissionAudit,
} from "../lib/review-audit-selection.ts";
import { CONTENT_CATEGORIES, type ReviewSubmission } from "../lib/review-engine/types.ts";

function submission(overrides: Partial<ReviewSubmission> = {}): ReviewSubmission {
  return {
    id: "submission-audit-fixture",
    versionId: "version-audit-fixture",
    reviewer: {
      id: "reviewer-audit-fixture",
      independenceGroupId: "group-audit-fixture",
      status: "active",
    },
    startedAt: "2026-08-12T10:00:00.000Z",
    completedAt: "2026-08-12T12:00:00.000Z",
    watchedSeconds: 6000,
    declaredComplete: true,
    categoryChecks: Object.fromEntries(CONTENT_CATEGORIES.map((category) => [category, "none"])) as ReviewSubmission["categoryChecks"],
    observations: [],
    ...overrides,
  };
}

test("baseline submissions use an explicit 10% unbiased uint32 threshold", () => {
  const threshold = Math.floor((UINT32_RANGE * BASELINE_AUDIT_RATE_BPS) / 10_000);
  const selected = planPostSubmissionAudit(submission(), threshold - 1);
  const skipped = planPostSubmissionAudit(submission(), threshold);

  assert.equal(selected.riskTier, "baseline");
  assert.equal(selected.sampleRateBps, 1_000);
  assert.equal(selected.thresholdExclusiveU32, threshold);
  assert.equal(selected.selected, true);
  assert.equal(skipped.selected, false);
  assert.deepEqual(selected.riskTriggerCodes, []);
});

test("P2-03 high-sensitivity observations automatically raise audit rate to 50%", () => {
  const highRisk = submission({
    categoryChecks: {
      ...submission().categoryChecks,
      selfHarm: "present",
    },
    observations: [
      {
        id: "self-harm-observation",
        category: "selfHarm",
        severity: 1,
        startSecond: 100,
        endSecond: 120,
        frequency: "single",
        context: "distressing",
        spoilerLevel: "contextual",
        summary: "High-sensitivity fixture",
        flags: [],
      },
    ],
  });
  const threshold = Math.floor((UINT32_RANGE * HIGH_RISK_AUDIT_RATE_BPS) / 10_000);
  const plan = planPostSubmissionAudit(highRisk, threshold - 1);

  assert.equal(plan.riskTier, "high_risk");
  assert.equal(plan.sampleRateBps, 5_000);
  assert.equal(plan.selected, true);
  assert.ok(plan.riskTriggerCodes.includes("sensitive_category_threshold"));
});

test("sensitive flags reuse the same P2-03 risk policy", () => {
  const highRisk = submission({
    categoryChecks: {
      ...submission().categoryChecks,
      violence: "present",
    },
    observations: [
      {
        id: "weapon-observation",
        category: "violence",
        severity: 3,
        startSecond: 200,
        endSecond: 210,
        frequency: "single",
        context: "threatening",
        spoilerLevel: "none",
        summary: "Sensitive flag fixture",
        flags: ["weapon"],
      },
    ],
  });
  const plan = planPostSubmissionAudit(highRisk, 4_000_000_000);

  assert.equal(plan.riskTier, "high_risk");
  assert.equal(plan.sampleRateBps, 5_000);
  assert.ok(plan.riskTriggerCodes.includes("sensitive_flag_threshold"));
});

test("high-risk sampling remains unpredictable rather than selecting every case", () => {
  const highRisk = submission({
    categoryChecks: {
      ...submission().categoryChecks,
      sexualContent: "present",
    },
    observations: [
      {
        id: "sensitive-observation",
        category: "sexualContent",
        severity: 2,
        startSecond: 300,
        endSecond: 320,
        frequency: "single",
        context: "neutral",
        spoilerLevel: "none",
        summary: "High-risk sampling fixture",
        flags: [],
      },
    ],
  });
  const threshold = Math.floor((UINT32_RANGE * HIGH_RISK_AUDIT_RATE_BPS) / 10_000);

  assert.equal(planPostSubmissionAudit(highRisk, threshold - 1).selected, true);
  assert.equal(planPostSubmissionAudit(highRisk, threshold).selected, false);
});

test("invalid or out-of-range random words are rejected", () => {
  for (const draw of [-1, UINT32_RANGE, 1.5, Number.NaN]) {
    assert.throws(() => planPostSubmissionAudit(submission(), draw), RangeError);
  }
});
