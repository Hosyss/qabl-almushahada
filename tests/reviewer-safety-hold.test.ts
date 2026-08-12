import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateReviewerSafetyHold,
  MIN_REVIEWER_SAFETY_HOLD_AGGREGATE_SAMPLE,
  REVIEWER_SAFETY_HOLD_POLICY_VERSION,
  REVIEWER_SAFETY_HOLD_WINDOW,
  type ReviewerSafetyHoldSample,
} from "../lib/reviewer-safety-hold.ts";

function confirmed(): ReviewerSafetyHoldSample {
  return {
    status: "confirmed",
    missedEventCount: 0,
    highSensitivityMissedEventCount: 0,
    severityDifferenceCount: 0,
    maxSeverityDelta: 0,
  };
}

function correction(
  overrides: Partial<ReviewerSafetyHoldSample> = {},
): ReviewerSafetyHoldSample {
  return {
    status: "correction_required",
    missedEventCount: 1,
    highSensitivityMissedEventCount: 0,
    severityDifferenceCount: 0,
    maxSeverityDelta: 0,
    ...overrides,
  };
}

function windowWith(overrides: Map<number, ReviewerSafetyHoldSample>): ReviewerSafetyHoldSample[] {
  return Array.from({ length: REVIEWER_SAFETY_HOLD_WINDOW }, (_, index) =>
    overrides.get(index) ?? confirmed(),
  );
}

test("empty evidence never places a safety hold", () => {
  const result = evaluateReviewerSafetyHold([]);
  assert.equal(result.holdRequired, false);
  assert.deepEqual(result.triggerCodes, []);
  assert.equal(result.policyVersion, REVIEWER_SAFETY_HOLD_POLICY_VERSION);
});

test("a newly audited high-sensitivity missed event places an immediate temporary hold", () => {
  const result = evaluateReviewerSafetyHold([
    correction({ missedEventCount: 1, highSensitivityMissedEventCount: 1 }),
  ]);
  assert.equal(result.holdRequired, true);
  assert.deepEqual(result.triggerCodes, ["HIGH_SENSITIVITY_EVENT_MISSED"]);
});

test("an extreme severity gap of three places an immediate temporary hold", () => {
  const result = evaluateReviewerSafetyHold([
    correction({ missedEventCount: 0, severityDifferenceCount: 1, maxSeverityDelta: 3 }),
  ]);
  assert.equal(result.holdRequired, true);
  assert.deepEqual(result.triggerCodes, ["EXTREME_SEVERITY_GAP"]);
});

test("an old immediate finding does not re-trigger forever after remediation", () => {
  const result = evaluateReviewerSafetyHold([
    correction({ missedEventCount: 1, highSensitivityMissedEventCount: 1 }),
    confirmed(),
  ]);
  assert.equal(result.holdRequired, false);
  assert.equal(result.evidence.latestHighSensitivityMissedEvents, 0);
});

test("aggregate patterns stay disabled below twenty completed audits", () => {
  const samples = Array.from({ length: MIN_REVIEWER_SAFETY_HOLD_AGGREGATE_SAMPLE - 1 }, (_, index) =>
    index < 5 ? correction() : confirmed(),
  );
  const result = evaluateReviewerSafetyHold(samples);
  assert.equal(result.holdRequired, false);
  assert.equal(result.evidence.currentEpochSampleSize, 19);
});

test("five correction-required audits in the latest twenty trigger a hold at the exact boundary", () => {
  const overrides = new Map<number, ReviewerSafetyHoldSample>();
  for (let index = 0; index < 5; index += 1) overrides.set(index, correction());
  const result = evaluateReviewerSafetyHold(windowWith(overrides));
  assert.equal(result.holdRequired, true);
  assert.ok(result.triggerCodes.includes("REPEATED_CORRECTIONS"));
  assert.equal(result.evidence.correctionRequiredAudits, 5);
});

test("four correction-required audits in twenty do not trigger the aggregate correction rule", () => {
  const overrides = new Map<number, ReviewerSafetyHoldSample>();
  for (let index = 0; index < 4; index += 1) overrides.set(index, correction());
  const result = evaluateReviewerSafetyHold(windowWith(overrides));
  assert.equal(result.triggerCodes.includes("REPEATED_CORRECTIONS"), false);
});

test("three audits with missed events in twenty trigger a hold", () => {
  const overrides = new Map<number, ReviewerSafetyHoldSample>();
  for (let index = 0; index < 3; index += 1) overrides.set(index, correction());
  const result = evaluateReviewerSafetyHold(windowWith(overrides));
  assert.ok(result.triggerCodes.includes("REPEATED_MISSED_EVENTS"));
});

test("three large severity-gap audits in twenty trigger a hold", () => {
  const overrides = new Map<number, ReviewerSafetyHoldSample>();
  for (let index = 0; index < 3; index += 1) {
    overrides.set(
      index,
      correction({ missedEventCount: 0, severityDifferenceCount: 1, maxSeverityDelta: 2 }),
    );
  }
  const result = evaluateReviewerSafetyHold(windowWith(overrides));
  assert.ok(result.triggerCodes.includes("REPEATED_LARGE_SEVERITY_GAPS"));
});

test("only the latest twenty audits are used for aggregate rules", () => {
  const oldCorrections = Array.from({ length: 5 }, () => correction());
  const recentClean = Array.from({ length: REVIEWER_SAFETY_HOLD_WINDOW }, () => confirmed());
  const result = evaluateReviewerSafetyHold([...oldCorrections, ...recentClean]);
  assert.equal(result.holdRequired, false);
  assert.equal(result.evidence.currentEpochSampleSize, 25);
  assert.equal(result.evidence.evaluatedWindowSize, 20);
  assert.equal(result.evidence.correctionRequiredAudits, 0);
});

test("the safety policy exposes evidence and trigger codes, never a trust score or ranking", () => {
  const result = evaluateReviewerSafetyHold(Array.from({ length: 20 }, () => confirmed()));
  assert.equal("trustScore" in result, false);
  assert.equal("ranking" in result, false);
});

test("malformed evidence fails closed instead of being normalized silently", () => {
  assert.throws(
    () =>
      evaluateReviewerSafetyHold([
        correction({ missedEventCount: 0, highSensitivityMissedEventCount: 1 }),
      ]),
    /cannot exceed/i,
  );
  assert.throws(
    () =>
      evaluateReviewerSafetyHold([
        correction({ missedEventCount: 0, severityDifferenceCount: 0, maxSeverityDelta: 2 }),
      ]),
    /must be zero/i,
  );
});
