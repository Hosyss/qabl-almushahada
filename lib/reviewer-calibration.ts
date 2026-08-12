export const MIN_REVIEWER_CALIBRATION_SAMPLE = 20;

export interface CompletedAuditCalibrationSample {
  status: "confirmed" | "correction_required";
  missedEventCount: number;
  severityDifferenceCount: number;
  maxSeverityDelta: number;
}

export interface ReviewerCalibrationSummary {
  sampleSize: number;
  minimumSampleSize: number;
  metricsAvailable: boolean;
  rawCounts: {
    confirmedAudits: number;
    correctionRequiredAudits: number;
    auditsWithMissedEvents: number;
    auditsWithSeverityDifferences: number;
    totalMissedEvents: number;
    totalSeverityDifferences: number;
    maxObservedSeverityDelta: number;
  };
  ratesBps: null | {
    confirmedAudits: number;
    correctionRequiredAudits: number;
    auditsWithMissedEvents: number;
    auditsWithSeverityDifferences: number;
  };
}

/**
 * Produces calibration evidence only. It deliberately does not calculate a
 * composite reviewer "trust score" or ranking.
 *
 * Raw counts and sample size are always available for auditability. Normalized
 * rates remain withheld until the reviewer has at least 20 completed,
 * independent audit outcomes. The initial threshold is explicit policy and may
 * be revisited later with evidence; it is never supplied by the client.
 */
export function summarizeReviewerCalibration(
  samples: readonly CompletedAuditCalibrationSample[],
): ReviewerCalibrationSummary {
  for (const sample of samples) validateSample(sample);

  const sampleSize = samples.length;
  const rawCounts = {
    confirmedAudits: 0,
    correctionRequiredAudits: 0,
    auditsWithMissedEvents: 0,
    auditsWithSeverityDifferences: 0,
    totalMissedEvents: 0,
    totalSeverityDifferences: 0,
    maxObservedSeverityDelta: 0,
  };

  for (const sample of samples) {
    if (sample.status === "confirmed") rawCounts.confirmedAudits += 1;
    else rawCounts.correctionRequiredAudits += 1;
    if (sample.missedEventCount > 0) rawCounts.auditsWithMissedEvents += 1;
    if (sample.severityDifferenceCount > 0) rawCounts.auditsWithSeverityDifferences += 1;
    rawCounts.totalMissedEvents += sample.missedEventCount;
    rawCounts.totalSeverityDifferences += sample.severityDifferenceCount;
    rawCounts.maxObservedSeverityDelta = Math.max(
      rawCounts.maxObservedSeverityDelta,
      sample.maxSeverityDelta,
    );
  }

  const metricsAvailable = sampleSize >= MIN_REVIEWER_CALIBRATION_SAMPLE;
  return {
    sampleSize,
    minimumSampleSize: MIN_REVIEWER_CALIBRATION_SAMPLE,
    metricsAvailable,
    rawCounts,
    ratesBps: metricsAvailable
      ? {
          confirmedAudits: toBasisPoints(rawCounts.confirmedAudits, sampleSize),
          correctionRequiredAudits: toBasisPoints(rawCounts.correctionRequiredAudits, sampleSize),
          auditsWithMissedEvents: toBasisPoints(rawCounts.auditsWithMissedEvents, sampleSize),
          auditsWithSeverityDifferences: toBasisPoints(
            rawCounts.auditsWithSeverityDifferences,
            sampleSize,
          ),
        }
      : null,
  };
}

function validateSample(sample: CompletedAuditCalibrationSample): void {
  if (sample.status !== "confirmed" && sample.status !== "correction_required") {
    throw new TypeError("Unknown completed audit status");
  }
  for (const [name, value] of [
    ["missedEventCount", sample.missedEventCount],
    ["severityDifferenceCount", sample.severityDifferenceCount],
    ["maxSeverityDelta", sample.maxSeverityDelta],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative integer`);
    }
  }
  if (sample.maxSeverityDelta > 3) {
    throw new RangeError("maxSeverityDelta cannot exceed 3");
  }
  if (sample.severityDifferenceCount === 0 && sample.maxSeverityDelta !== 0) {
    throw new RangeError("maxSeverityDelta must be zero when there are no severity differences");
  }
  if (
    sample.status === "confirmed" &&
    (sample.missedEventCount !== 0 ||
      sample.severityDifferenceCount !== 0 ||
      sample.maxSeverityDelta !== 0)
  ) {
    throw new RangeError("confirmed audits cannot contain calibration findings");
  }
  if (
    sample.status === "correction_required" &&
    sample.missedEventCount === 0 &&
    sample.severityDifferenceCount === 0
  ) {
    throw new RangeError("correction_required audits must contain at least one finding");
  }
}

function toBasisPoints(count: number, total: number): number {
  return Math.round((count * 10_000) / total);
}
