import assert from "node:assert/strict";
import test from "node:test";

import { createVerifiedDemoBundle, type ReviewSubmission } from "../lib/review-engine/index.ts";
import {
  compareReferenceCalibrationCase,
  evaluateReferenceCalibration,
  type ReferenceCalibrationCaseResult,
} from "../lib/reviewer-reference-calibration.ts";

function result(overrides: Partial<ReferenceCalibrationCaseResult> = {}): ReferenceCalibrationCaseResult {
  return {
    caseId: "case",
    categoryMatches: 10,
    categoryTotal: 10,
    referenceObservationCount: 1,
    candidateObservationCount: 1,
    matchedObservationCount: 1,
    missedObservationCount: 0,
    falsePositiveObservationCount: 0,
    missedHighSensitivityCount: 0,
    maxSeverityDelta: 0,
    ...overrides,
  };
}

function tenPerfectCases(): ReferenceCalibrationCaseResult[] {
  return Array.from({ length: 10 }, (_, index) => result({ caseId: `case-${index + 1}` }));
}

function clonedSubmission(): ReviewSubmission {
  return structuredClone(createVerifiedDemoBundle().submissions[0]);
}

test("reference calibration refuses fewer than ten completed cases", () => {
  const evaluation = evaluateReferenceCalibration(tenPerfectCases().slice(0, 9));
  assert.equal(evaluation.passed, false);
  assert.ok(evaluation.blockers.includes("MINIMUM_CASES_NOT_MET"));
});

test("exact published thresholds pass without producing a trust score", () => {
  const cases = tenPerfectCases();
  cases[0] = result({
    caseId: "case-1",
    categoryMatches: 5,
    categoryTotal: 10,
    referenceObservationCount: 10,
    candidateObservationCount: 10,
    matchedObservationCount: 9,
    missedObservationCount: 1,
    falsePositiveObservationCount: 1,
    maxSeverityDelta: 1,
  });
  for (let index = 1; index < 10; index += 1) {
    cases[index] = result({
      caseId: `case-${index + 1}`,
      categoryMatches: 10,
      categoryTotal: 10,
      referenceObservationCount: 0,
      candidateObservationCount: 0,
      matchedObservationCount: 0,
    });
  }

  const evaluation = evaluateReferenceCalibration(cases);
  assert.equal(evaluation.metrics.categoryAgreementBps, 9500);
  assert.equal(evaluation.metrics.observationRecallBps, 9000);
  assert.equal(evaluation.metrics.observationPrecisionBps, 9000);
  assert.equal(evaluation.metrics.maxSeverityDelta, 1);
  assert.equal(evaluation.passed, true);
  assert.equal("trustScore" in evaluation, false);
});

test("category agreement below 95 percent fails closed", () => {
  const cases = tenPerfectCases();
  cases[0] = result({ caseId: "case-1", categoryMatches: 4 });
  const evaluation = evaluateReferenceCalibration(cases);
  assert.equal(evaluation.metrics.categoryAgreementBps, 9400);
  assert.ok(evaluation.blockers.includes("CATEGORY_AGREEMENT_BELOW_THRESHOLD"));
});

test("observation recall below 90 percent fails closed", () => {
  const cases = tenPerfectCases().map((item, index) =>
    result({
      ...item,
      caseId: `case-${index + 1}`,
      referenceObservationCount: 1,
      candidateObservationCount: index < 8 ? 1 : 0,
      matchedObservationCount: index < 8 ? 1 : 0,
      missedObservationCount: index < 8 ? 0 : 1,
    }),
  );
  const evaluation = evaluateReferenceCalibration(cases);
  assert.equal(evaluation.metrics.observationRecallBps, 8000);
  assert.ok(evaluation.blockers.includes("OBSERVATION_RECALL_BELOW_THRESHOLD"));
});

test("observation precision below 90 percent fails closed", () => {
  const cases = tenPerfectCases().map((item, index) =>
    result({
      ...item,
      caseId: `case-${index + 1}`,
      referenceObservationCount: 1,
      candidateObservationCount: 2,
      matchedObservationCount: 1,
      falsePositiveObservationCount: 1,
    }),
  );
  const evaluation = evaluateReferenceCalibration(cases);
  assert.equal(evaluation.metrics.observationPrecisionBps, 5000);
  assert.ok(evaluation.blockers.includes("OBSERVATION_PRECISION_BELOW_THRESHOLD"));
});

test("one missed high-sensitivity event blocks even perfect aggregate rates", () => {
  const cases = tenPerfectCases();
  cases[3] = result({ caseId: "case-4", missedHighSensitivityCount: 1 });
  const evaluation = evaluateReferenceCalibration(cases);
  assert.equal(evaluation.metrics.categoryAgreementBps, 10_000);
  assert.equal(evaluation.metrics.observationRecallBps, 10_000);
  assert.ok(evaluation.blockers.includes("HIGH_SENSITIVITY_EVENT_MISSED"));
  assert.equal(evaluation.passed, false);
});

test("severity delta of two blocks calibration", () => {
  const cases = tenPerfectCases();
  cases[5] = result({ caseId: "case-6", maxSeverityDelta: 2 });
  const evaluation = evaluateReferenceCalibration(cases);
  assert.ok(evaluation.blockers.includes("SEVERITY_DELTA_TOO_LARGE"));
  assert.equal(evaluation.passed, false);
});

test("observation matching is deterministic by category and time tolerance", () => {
  const reference = clonedSubmission();
  const candidate = structuredClone(reference);
  candidate.id = "candidate";
  candidate.observations = candidate.observations.map((observation, index) => ({
    ...observation,
    id: `candidate-observation-${index + 1}`,
    startSecond: observation.startSecond + 10,
    endSecond: observation.endSecond + 10,
  }));

  const comparison = compareReferenceCalibrationCase({ caseId: "match", reference, candidate });
  assert.equal(comparison.categoryMatches, 10);
  assert.equal(comparison.matchedObservationCount, reference.observations.length);
  assert.equal(comparison.missedObservationCount, 0);
  assert.equal(comparison.falsePositiveObservationCount, 0);
});

test("a missing sensitive reference observation is counted explicitly", () => {
  const reference = clonedSubmission();
  reference.categoryChecks.selfHarm = "present";
  reference.observations.push({
    id: "reference-self-harm",
    category: "selfHarm",
    severity: 1,
    startSecond: 1000,
    endSecond: 1010,
    frequency: "single",
    context: "distressing",
    spoilerLevel: "none",
    summary: "واقعة حساسة مرجعية لا يجوز تفويتها في اختبار المعايرة.",
    flags: [],
  });
  const candidate = clonedSubmission();

  const comparison = compareReferenceCalibrationCase({ caseId: "sensitive", reference, candidate });
  assert.equal(comparison.missedHighSensitivityCount, 1);
  assert.equal(comparison.missedObservationCount, 1);
});

test("reference calibration rejects cross-version comparison", () => {
  const reference = clonedSubmission();
  const candidate = clonedSubmission();
  candidate.versionId = "other-version";
  assert.throws(
    () => compareReferenceCalibrationCase({ caseId: "wrong-version", reference, candidate }),
    /exact same version/i,
  );
});
