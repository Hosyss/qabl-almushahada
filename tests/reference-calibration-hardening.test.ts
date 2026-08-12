import assert from "node:assert/strict";
import test from "node:test";

import { createVerifiedDemoBundle } from "../lib/review-engine/index.ts";
import { compareReferenceCalibrationCase } from "../lib/reviewer-reference-calibration.ts";

test("a broad distant interval cannot match a reference event merely because it overlaps", () => {
  const reference = structuredClone(createVerifiedDemoBundle().submissions[0]);
  reference.observations = [structuredClone(reference.observations[0])];

  const candidate = structuredClone(reference);
  candidate.id = "candidate-broad-distant-interval";
  candidate.observations = [
    {
      ...structuredClone(reference.observations[0]),
      id: "candidate-broad-fear",
      startSecond: 0,
      endSecond: reference.observations[0].endSecond,
    },
  ];

  const comparison = compareReferenceCalibrationCase({
    caseId: "broad-distant-overlap",
    reference,
    candidate,
  });

  assert.equal(comparison.matchedObservationCount, 0);
  assert.equal(comparison.missedObservationCount, 1);
  assert.equal(comparison.falsePositiveObservationCount, 1);
});
