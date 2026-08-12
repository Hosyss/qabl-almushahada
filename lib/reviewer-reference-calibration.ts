import { CONTENT_CATEGORIES, type ContentObservation, type ReviewSubmission } from "./review-engine/types.ts";
import {
  HIGH_SENSITIVITY_CATEGORY_THRESHOLDS,
  HIGH_SENSITIVITY_FLAG_THRESHOLDS,
} from "./review-engine/risk-policy.ts";

export const MIN_REFERENCE_CALIBRATION_CASES = 10;
export const MIN_CATEGORY_AGREEMENT_BPS = 9500;
export const MIN_OBSERVATION_RECALL_BPS = 9000;
export const MIN_OBSERVATION_PRECISION_BPS = 9000;
export const MAX_REFERENCE_SEVERITY_DELTA = 1;
export const OBSERVATION_MATCH_TOLERANCE_SECONDS = 20;

export interface ReferenceCalibrationCaseResult {
  caseId: string;
  categoryMatches: number;
  categoryTotal: number;
  referenceObservationCount: number;
  candidateObservationCount: number;
  matchedObservationCount: number;
  missedObservationCount: number;
  falsePositiveObservationCount: number;
  missedHighSensitivityCount: number;
  maxSeverityDelta: number;
}

export type ReferenceCalibrationBlocker =
  | "MINIMUM_CASES_NOT_MET"
  | "CATEGORY_AGREEMENT_BELOW_THRESHOLD"
  | "OBSERVATION_RECALL_BELOW_THRESHOLD"
  | "OBSERVATION_PRECISION_BELOW_THRESHOLD"
  | "HIGH_SENSITIVITY_EVENT_MISSED"
  | "SEVERITY_DELTA_TOO_LARGE";

export interface ReferenceCalibrationEvaluation {
  passed: boolean;
  blockers: ReferenceCalibrationBlocker[];
  metrics: {
    completedCases: number;
    categoryAgreementBps: number;
    observationRecallBps: number;
    observationPrecisionBps: number;
    missedHighSensitivityCount: number;
    maxSeverityDelta: number;
  };
}

/**
 * Compare one candidate review with one human-approved reference review for the exact same version.
 * Matching is deterministic: same category, then interval overlap or a start-time difference <=20 seconds,
 * choosing the nearest unused candidate observation. This is deliberately not AI/semantic matching.
 */
export function compareReferenceCalibrationCase(input: {
  caseId: string;
  reference: ReviewSubmission;
  candidate: ReviewSubmission;
}): ReferenceCalibrationCaseResult {
  if (input.reference.versionId !== input.candidate.versionId) {
    throw new Error("Reference calibration requires the exact same version.");
  }

  let categoryMatches = 0;
  for (const category of CONTENT_CATEGORIES) {
    if (input.reference.categoryChecks[category] === input.candidate.categoryChecks[category]) {
      categoryMatches += 1;
    }
  }

  const unusedCandidateIndexes = new Set(input.candidate.observations.map((_, index) => index));
  let matchedObservationCount = 0;
  let missedHighSensitivityCount = 0;
  let maxSeverityDelta = 0;

  for (const referenceObservation of input.reference.observations) {
    const candidateIndex = findClosestMatchingObservation(
      referenceObservation,
      input.candidate.observations,
      unusedCandidateIndexes,
    );

    if (candidateIndex === null) {
      if (isHighSensitivityObservation(referenceObservation)) missedHighSensitivityCount += 1;
      continue;
    }

    unusedCandidateIndexes.delete(candidateIndex);
    matchedObservationCount += 1;
    maxSeverityDelta = Math.max(
      maxSeverityDelta,
      Math.abs(referenceObservation.severity - input.candidate.observations[candidateIndex].severity),
    );
  }

  return {
    caseId: input.caseId,
    categoryMatches,
    categoryTotal: CONTENT_CATEGORIES.length,
    referenceObservationCount: input.reference.observations.length,
    candidateObservationCount: input.candidate.observations.length,
    matchedObservationCount,
    missedObservationCount: input.reference.observations.length - matchedObservationCount,
    falsePositiveObservationCount: unusedCandidateIndexes.size,
    missedHighSensitivityCount,
    maxSeverityDelta,
  };
}

/**
 * Explicit pass/fail gate. It returns metrics and blocker codes, never a composite trust score.
 */
export function evaluateReferenceCalibration(
  cases: readonly ReferenceCalibrationCaseResult[],
): ReferenceCalibrationEvaluation {
  const totals = cases.reduce(
    (acc, item) => {
      acc.categoryMatches += item.categoryMatches;
      acc.categoryTotal += item.categoryTotal;
      acc.referenceObservationCount += item.referenceObservationCount;
      acc.candidateObservationCount += item.candidateObservationCount;
      acc.matchedObservationCount += item.matchedObservationCount;
      acc.missedHighSensitivityCount += item.missedHighSensitivityCount;
      acc.maxSeverityDelta = Math.max(acc.maxSeverityDelta, item.maxSeverityDelta);
      return acc;
    },
    {
      categoryMatches: 0,
      categoryTotal: 0,
      referenceObservationCount: 0,
      candidateObservationCount: 0,
      matchedObservationCount: 0,
      missedHighSensitivityCount: 0,
      maxSeverityDelta: 0,
    },
  );

  const categoryAgreementBps = ratioBps(totals.categoryMatches, totals.categoryTotal);
  const observationRecallBps = ratioBps(
    totals.matchedObservationCount,
    totals.referenceObservationCount,
  );
  const observationPrecisionBps = ratioBps(
    totals.matchedObservationCount,
    totals.candidateObservationCount,
  );

  const blockers: ReferenceCalibrationBlocker[] = [];
  if (cases.length < MIN_REFERENCE_CALIBRATION_CASES) blockers.push("MINIMUM_CASES_NOT_MET");
  if (categoryAgreementBps < MIN_CATEGORY_AGREEMENT_BPS) {
    blockers.push("CATEGORY_AGREEMENT_BELOW_THRESHOLD");
  }
  if (observationRecallBps < MIN_OBSERVATION_RECALL_BPS) {
    blockers.push("OBSERVATION_RECALL_BELOW_THRESHOLD");
  }
  if (observationPrecisionBps < MIN_OBSERVATION_PRECISION_BPS) {
    blockers.push("OBSERVATION_PRECISION_BELOW_THRESHOLD");
  }
  if (totals.missedHighSensitivityCount > 0) blockers.push("HIGH_SENSITIVITY_EVENT_MISSED");
  if (totals.maxSeverityDelta > MAX_REFERENCE_SEVERITY_DELTA) {
    blockers.push("SEVERITY_DELTA_TOO_LARGE");
  }

  return {
    passed: blockers.length === 0,
    blockers,
    metrics: {
      completedCases: cases.length,
      categoryAgreementBps,
      observationRecallBps,
      observationPrecisionBps,
      missedHighSensitivityCount: totals.missedHighSensitivityCount,
      maxSeverityDelta: totals.maxSeverityDelta,
    },
  };
}

function findClosestMatchingObservation(
  reference: ContentObservation,
  candidates: readonly ContentObservation[],
  unusedCandidateIndexes: ReadonlySet<number>,
): number | null {
  let bestIndex: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const index of unusedCandidateIndexes) {
    const candidate = candidates[index];
    if (candidate.category !== reference.category) continue;

    const overlaps =
      candidate.startSecond <= reference.endSecond && candidate.endSecond >= reference.startSecond;
    const startDistance = Math.abs(candidate.startSecond - reference.startSecond);
    if (!overlaps && startDistance > OBSERVATION_MATCH_TOLERANCE_SECONDS) continue;

    if (startDistance < bestDistance || (startDistance === bestDistance && index < (bestIndex ?? Infinity))) {
      bestDistance = startDistance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function isHighSensitivityObservation(observation: ContentObservation): boolean {
  if (observation.severity === 4) return true;

  const categoryThreshold = HIGH_SENSITIVITY_CATEGORY_THRESHOLDS[observation.category];
  if (categoryThreshold !== undefined && observation.severity >= categoryThreshold) return true;

  return observation.flags.some((flag) => {
    const threshold = HIGH_SENSITIVITY_FLAG_THRESHOLDS[flag];
    return threshold !== undefined && observation.severity >= threshold;
  });
}

function ratioBps(numerator: number, denominator: number): number {
  if (denominator === 0) return 10_000;
  return Math.floor((numerator * 10_000) / denominator);
}
