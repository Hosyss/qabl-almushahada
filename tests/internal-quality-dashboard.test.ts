import assert from "node:assert/strict";
import test from "node:test";

import {
  assertQualityDashboardAccess,
  buildQualityCalibrationSummary,
  parseSafetyHoldPayload,
  parseSafetyHoldResolutionPayload,
} from "../lib/internal-quality-dashboard.ts";
import { ReviewWorkflowError } from "../lib/internal-review-workflow.ts";

test("quality dashboard allows an active admin", () => {
  assert.doesNotThrow(() =>
    assertQualityDashboardAccess({ role: "admin", accountStatus: "active", reviewerStatus: null }),
  );
});

test("quality dashboard allows an active editorial reviewer with active reviewer identity", () => {
  assert.doesNotThrow(() =>
    assertQualityDashboardAccess({
      role: "editorial_reviewer",
      accountStatus: "active",
      reviewerStatus: "active",
    }),
  );
});

test("quality dashboard rejects suspended accounts", () => {
  assert.throws(
    () =>
      assertQualityDashboardAccess({
        role: "admin",
        accountStatus: "suspended",
        reviewerStatus: null,
      }),
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === "ACCOUNT_SUSPENDED",
  );
});

test("quality dashboard rejects editorial reviewers whose reviewer identity is not active", () => {
  for (const reviewerStatus of ["probation", "suspended"] as const) {
    assert.throws(
      () =>
        assertQualityDashboardAccess({
          role: "editorial_reviewer",
          accountStatus: "active",
          reviewerStatus,
        }),
      (error: unknown) => error instanceof ReviewWorkflowError && error.code === "FORBIDDEN",
    );
  }
});

test("quality dashboard rejects reviewer and coordinator roles", () => {
  assert.throws(() =>
    assertQualityDashboardAccess({
      role: "reviewer",
      accountStatus: "active",
      reviewerStatus: "active",
    }),
  );
  assert.throws(() =>
    assertQualityDashboardAccess({
      role: "review_coordinator",
      accountStatus: "active",
      reviewerStatus: null,
    }),
  );
});

test("automatic safety-hold payload is parsed without inventing evidence", () => {
  const parsed = parseSafetyHoldPayload(
    JSON.stringify({
      source: "automatic_audit_pattern",
      policyVersion: "2026-08-12.v1",
      triggerCodes: ["HIGH_SENSITIVITY_EVENT_MISSED"],
      triggeringOutcomeId: "outcome-1",
      triggeringBundleId: "bundle-1",
      evidence: { currentEpochSampleSize: 1 },
    }),
  );
  assert.equal(parsed.source, "automatic_audit_pattern");
  assert.equal(parsed.policyVersion, "2026-08-12.v1");
  assert.deepEqual(parsed.triggerCodes, ["HIGH_SENSITIVITY_EVENT_MISSED"]);
  assert.equal(parsed.triggeringOutcomeId, "outcome-1");
  assert.equal(parsed.triggeringBundleId, "bundle-1");
});

test("manual safety-hold payload is parsed as investigation evidence", () => {
  const parsed = parseSafetyHoldPayload(
    JSON.stringify({
      source: "manual_collusion_suspicion",
      policyVersion: "2026-08-12.v1",
      triggerCodes: ["COLLUSION_SUSPICION"],
      evidence: { evidenceEventIds: ["audit-1"] },
    }),
  );
  assert.equal(parsed.source, "manual_collusion_suspicion");
  assert.deepEqual(parsed.triggerCodes, ["COLLUSION_SUSPICION"]);
  assert.equal(parsed.triggeringOutcomeId, null);
});

test("unknown safety-hold source and duplicate trigger codes fail closed", () => {
  assert.throws(() =>
    parseSafetyHoldPayload(
      JSON.stringify({
        source: "unknown",
        policyVersion: "v1",
        triggerCodes: ["A"],
      }),
    ),
  );
  assert.throws(() =>
    parseSafetyHoldPayload(
      JSON.stringify({
        source: "automatic_audit_pattern",
        policyVersion: "v1",
        triggerCodes: ["A", "A"],
      }),
    ),
  );
  assert.throws(() =>
    parseSafetyHoldPayload(
      JSON.stringify({
        source: "automatic_audit_pattern",
        policyVersion: "v1",
        triggerCodes: [],
      }),
    ),
  );
});

test("safety-hold resolution parser accepts only stored human resolution states", () => {
  const parsed = parseSafetyHoldResolutionPayload(
    JSON.stringify({
      holdEventId: "hold-1",
      resolution: "remediation_required",
      note: "إعادة المعايرة مطلوبة قبل العودة.",
    }),
  );
  assert.equal(parsed.holdEventId, "hold-1");
  assert.equal(parsed.resolution, "remediation_required");

  assert.throws(() =>
    parseSafetyHoldResolutionPayload(
      JSON.stringify({ holdEventId: "hold-1", resolution: "activate", note: "invalid" }),
    ),
  );
});

test("audit calibration rates remain hidden below twenty completed audits", () => {
  const summary = buildQualityCalibrationSummary({
    sampleSize: 19,
    confirmedAudits: 15,
    correctionRequiredAudits: 4,
    auditsWithMissedEvents: 2,
    auditsWithSeverityDifferences: 3,
    totalMissedEvents: 2,
    totalSeverityDifferences: 3,
    maxObservedSeverityDelta: 2,
  });
  assert.equal(summary.metricsAvailable, false);
  assert.equal(summary.ratesBps, null);
});

test("audit calibration rates appear at exactly twenty completed audits", () => {
  const summary = buildQualityCalibrationSummary({
    sampleSize: 20,
    confirmedAudits: 15,
    correctionRequiredAudits: 5,
    auditsWithMissedEvents: 3,
    auditsWithSeverityDifferences: 4,
    totalMissedEvents: 4,
    totalSeverityDifferences: 5,
    maxObservedSeverityDelta: 2,
  });
  assert.equal(summary.metricsAvailable, true);
  assert.deepEqual(summary.ratesBps, {
    confirmedAudits: 7500,
    correctionRequiredAudits: 2500,
    auditsWithMissedEvents: 1500,
    auditsWithSeverityDifferences: 2000,
  });
  assert.equal("trustScore" in summary, false);
  assert.equal("ranking" in summary, false);
});

test("inconsistent stored calibration aggregates fail closed", () => {
  assert.throws(() =>
    buildQualityCalibrationSummary({
      sampleSize: 20,
      confirmedAudits: 20,
      correctionRequiredAudits: 1,
      auditsWithMissedEvents: 0,
      auditsWithSeverityDifferences: 0,
      totalMissedEvents: 0,
      totalSeverityDifferences: 0,
      maxObservedSeverityDelta: 0,
    }),
  );
  assert.throws(() =>
    buildQualityCalibrationSummary({
      sampleSize: 2,
      confirmedAudits: 1,
      correctionRequiredAudits: 1,
      auditsWithMissedEvents: 3,
      auditsWithSeverityDifferences: 0,
      totalMissedEvents: 3,
      totalSeverityDifferences: 0,
      maxObservedSeverityDelta: 0,
    }),
  );
});
