export const REVIEWER_SAFETY_HOLD_POLICY_VERSION = "2026-08-12.v1";
export const REVIEWER_SAFETY_HOLD_WINDOW = 20;
export const MIN_REVIEWER_SAFETY_HOLD_AGGREGATE_SAMPLE = 20;
export const MAX_CORRECTION_REQUIRED_IN_WINDOW = 4;
export const MAX_MISSED_EVENT_AUDITS_IN_WINDOW = 2;
export const MAX_LARGE_SEVERITY_GAP_AUDITS_IN_WINDOW = 2;

export type ReviewerSafetyHoldTriggerCode =
  | "HIGH_SENSITIVITY_EVENT_MISSED"
  | "EXTREME_SEVERITY_GAP"
  | "REPEATED_CORRECTIONS"
  | "REPEATED_MISSED_EVENTS"
  | "REPEATED_LARGE_SEVERITY_GAPS";

export interface ReviewerSafetyHoldSample {
  status: "confirmed" | "correction_required";
  missedEventCount: number;
  highSensitivityMissedEventCount: number;
  severityDifferenceCount: number;
  maxSeverityDelta: number;
}

export interface ReviewerSafetyHoldEvaluation {
  holdRequired: boolean;
  policyVersion: typeof REVIEWER_SAFETY_HOLD_POLICY_VERSION;
  triggerCodes: ReviewerSafetyHoldTriggerCode[];
  evidence: {
    currentEpochSampleSize: number;
    evaluatedWindowSize: number;
    correctionRequiredAudits: number;
    auditsWithMissedEvents: number;
    auditsWithLargeSeverityGaps: number;
    latestHighSensitivityMissedEvents: number;
    latestMaxSeverityDelta: number;
  };
}

/**
 * Evaluates whether a reviewer needs a temporary safety hold for human review.
 *
 * Callers must provide completed independent audit outcomes from the reviewer's
 * current active epoch only (that is, after the most recent activation or
 * reactivation). Historical outcomes remain auditable but must not repeatedly
 * re-trigger a remediated reviewer.
 *
 * The policy deliberately produces trigger codes and evidence, never a
 * composite trust score or ranking.
 */
export function evaluateReviewerSafetyHold(
  samples: readonly ReviewerSafetyHoldSample[],
): ReviewerSafetyHoldEvaluation {
  for (const sample of samples) validateSample(sample);

  const recent = samples.slice(-REVIEWER_SAFETY_HOLD_WINDOW);
  const latest = samples.at(-1) ?? null;
  const evidence = {
    currentEpochSampleSize: samples.length,
    evaluatedWindowSize: recent.length,
    correctionRequiredAudits: recent.filter((sample) => sample.status === "correction_required").length,
    auditsWithMissedEvents: recent.filter((sample) => sample.missedEventCount > 0).length,
    auditsWithLargeSeverityGaps: recent.filter(
      (sample) => sample.severityDifferenceCount > 0 && sample.maxSeverityDelta >= 2,
    ).length,
    latestHighSensitivityMissedEvents: latest?.highSensitivityMissedEventCount ?? 0,
    latestMaxSeverityDelta: latest?.maxSeverityDelta ?? 0,
  };

  const triggerCodes: ReviewerSafetyHoldTriggerCode[] = [];

  // Immediate safety triggers apply only to the newest completed audit. Older
  // findings remain history, but a reviewer who completed remediation must not
  // be re-held forever by the same historical event.
  if ((latest?.highSensitivityMissedEventCount ?? 0) > 0) {
    triggerCodes.push("HIGH_SENSITIVITY_EVENT_MISSED");
  }
  if ((latest?.maxSeverityDelta ?? 0) === 3) {
    triggerCodes.push("EXTREME_SEVERITY_GAP");
  }

  if (recent.length >= MIN_REVIEWER_SAFETY_HOLD_AGGREGATE_SAMPLE) {
    if (evidence.correctionRequiredAudits > MAX_CORRECTION_REQUIRED_IN_WINDOW) {
      triggerCodes.push("REPEATED_CORRECTIONS");
    }
    if (evidence.auditsWithMissedEvents > MAX_MISSED_EVENT_AUDITS_IN_WINDOW) {
      triggerCodes.push("REPEATED_MISSED_EVENTS");
    }
    if (evidence.auditsWithLargeSeverityGaps > MAX_LARGE_SEVERITY_GAP_AUDITS_IN_WINDOW) {
      triggerCodes.push("REPEATED_LARGE_SEVERITY_GAPS");
    }
  }

  return {
    holdRequired: triggerCodes.length > 0,
    policyVersion: REVIEWER_SAFETY_HOLD_POLICY_VERSION,
    triggerCodes,
    evidence,
  };
}

function validateSample(sample: ReviewerSafetyHoldSample): void {
  if (sample.status !== "confirmed" && sample.status !== "correction_required") {
    throw new TypeError("Unknown reviewer safety-hold audit status");
  }
  for (const [name, value] of [
    ["missedEventCount", sample.missedEventCount],
    ["highSensitivityMissedEventCount", sample.highSensitivityMissedEventCount],
    ["severityDifferenceCount", sample.severityDifferenceCount],
    ["maxSeverityDelta", sample.maxSeverityDelta],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer`);
    }
  }
  if (sample.highSensitivityMissedEventCount > sample.missedEventCount) {
    throw new RangeError("highSensitivityMissedEventCount cannot exceed missedEventCount");
  }
  if (sample.maxSeverityDelta > 3) {
    throw new RangeError("maxSeverityDelta cannot exceed 3");
  }
  if (sample.severityDifferenceCount === 0 && sample.maxSeverityDelta !== 0) {
    throw new RangeError("maxSeverityDelta must be zero when there are no severity differences");
  }
  if (
    sample.status === "confirmed" &&
    (sample.missedEventCount !== 0 || sample.severityDifferenceCount !== 0 || sample.maxSeverityDelta !== 0)
  ) {
    throw new RangeError("confirmed audits cannot contain safety-hold findings");
  }
  if (
    sample.status === "correction_required" &&
    sample.missedEventCount === 0 &&
    sample.severityDifferenceCount === 0
  ) {
    throw new RangeError("correction_required audits must contain at least one finding");
  }
}
