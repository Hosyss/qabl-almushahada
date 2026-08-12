import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_REVIEWER_CALIBRATION_SAMPLE,
  summarizeReviewerCalibration,
  type CompletedAuditCalibrationSample,
} from "../lib/reviewer-calibration.ts";

const confirmed: CompletedAuditCalibrationSample = {
  status: "confirmed",
  missedEventCount: 0,
  severityDifferenceCount: 0,
  maxSeverityDelta: 0,
};

const corrected: CompletedAuditCalibrationSample = {
  status: "correction_required",
  missedEventCount: 1,
  severityDifferenceCount: 1,
  maxSeverityDelta: 2,
};

test("normalized reviewer rates remain hidden below the 20-audit minimum", () => {
  const summary = summarizeReviewerCalibration(Array.from({ length: 19 }, () => confirmed));
  assert.equal(MIN_REVIEWER_CALIBRATION_SAMPLE, 20);
  assert.equal(summary.sampleSize, 19);
  assert.equal(summary.metricsAvailable, false);
  assert.equal(summary.ratesBps, null);
  assert.equal(summary.rawCounts.confirmedAudits, 19);
});

test("rates become available exactly at 20 completed independent audits", () => {
  const samples = [
    ...Array.from({ length: 15 }, () => confirmed),
    ...Array.from({ length: 5 }, () => corrected),
  ];
  const summary = summarizeReviewerCalibration(samples);

  assert.equal(summary.sampleSize, 20);
  assert.equal(summary.metricsAvailable, true);
  assert.deepEqual(summary.rawCounts, {
    confirmedAudits: 15,
    correctionRequiredAudits: 5,
    auditsWithMissedEvents: 5,
    auditsWithSeverityDifferences: 5,
    totalMissedEvents: 5,
    totalSeverityDifferences: 5,
    maxObservedSeverityDelta: 2,
  });
  assert.deepEqual(summary.ratesBps, {
    confirmedAudits: 7500,
    correctionRequiredAudits: 2500,
    auditsWithMissedEvents: 2500,
    auditsWithSeverityDifferences: 2500,
  });
});

test("calibration summary deliberately has no composite trust score or ranking", () => {
  const summary = summarizeReviewerCalibration(Array.from({ length: 20 }, () => confirmed));
  assert.equal("trustScore" in summary, false);
  assert.equal("rank" in summary, false);
  assert.equal("score" in summary, false);
});

test("confirmed audit samples cannot carry findings", () => {
  assert.throws(
    () =>
      summarizeReviewerCalibration([
        {
          status: "confirmed",
          missedEventCount: 1,
          severityDifferenceCount: 0,
          maxSeverityDelta: 0,
        },
      ]),
    RangeError,
  );
});

test("correction-required audit samples must carry at least one finding", () => {
  assert.throws(
    () =>
      summarizeReviewerCalibration([
        {
          status: "correction_required",
          missedEventCount: 0,
          severityDifferenceCount: 0,
          maxSeverityDelta: 0,
        },
      ]),
    RangeError,
  );
});

test("severity delta is bounded and must match the presence of severity findings", () => {
  assert.throws(
    () =>
      summarizeReviewerCalibration([
        {
          status: "correction_required",
          missedEventCount: 0,
          severityDifferenceCount: 1,
          maxSeverityDelta: 4,
        },
      ]),
    RangeError,
  );
  assert.throws(
    () =>
      summarizeReviewerCalibration([
        {
          status: "correction_required",
          missedEventCount: 1,
          severityDifferenceCount: 0,
          maxSeverityDelta: 1,
        },
      ]),
    RangeError,
  );
});
