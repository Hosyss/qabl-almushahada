import { ReviewWorkflowError, type InternalAccountStatus, type InternalRole } from "./internal-review-workflow.ts";
import { MIN_REVIEWER_CALIBRATION_SAMPLE } from "./reviewer-calibration.ts";

export type QualityReviewerStatus = "active" | "probation" | "suspended";
export type SafetyHoldSource = "automatic_audit_pattern" | "manual_collusion_suspicion";
export type SafetyHoldResolution = "cleared" | "remediation_required";

export interface QualityAccessContext {
  role: InternalRole;
  accountStatus: InternalAccountStatus;
  reviewerStatus: QualityReviewerStatus | null;
}

export interface SafetyHoldPayload {
  source: SafetyHoldSource;
  policyVersion: string;
  triggerCodes: string[];
  triggeringOutcomeId: string | null;
  triggeringBundleId: string | null;
}

export interface SafetyHoldResolutionPayload {
  holdEventId: string;
  resolution: SafetyHoldResolution;
  note: string;
}

export interface QualityCalibrationAggregate {
  sampleSize: number;
  confirmedAudits: number;
  correctionRequiredAudits: number;
  auditsWithMissedEvents: number;
  auditsWithSeverityDifferences: number;
  totalMissedEvents: number;
  totalSeverityDifferences: number;
  maxObservedSeverityDelta: number;
}

export interface QualityCalibrationSummary extends QualityCalibrationAggregate {
  minimumSampleSize: number;
  metricsAvailable: boolean;
  ratesBps: null | {
    confirmedAudits: number;
    correctionRequiredAudits: number;
    auditsWithMissedEvents: number;
    auditsWithSeverityDifferences: number;
  };
}

/** Quality evidence is restricted to active Admins and active editorial reviewers. */
export function assertQualityDashboardAccess(context: QualityAccessContext): void {
  if (context.accountStatus !== "active") {
    throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");
  }
  if (context.role === "admin") return;
  if (context.role === "editorial_reviewer" && context.reviewerStatus === "active") return;
  throw new ReviewWorkflowError(
    "FORBIDDEN",
    "لوحة الجودة متاحة للمشرف أو المعتمد التحريري النشط فقط.",
  );
}

export function parseSafetyHoldPayload(raw: string): SafetyHoldPayload {
  const value = parseJsonObject(raw, "سجل Safety Hold غير صالح.");
  if (value.source !== "automatic_audit_pattern" && value.source !== "manual_collusion_suspicion") {
    throw invalidStoredEvidence("مصدر Safety Hold المخزن غير معروف.");
  }
  const policyVersion = requireNonEmptyString(value.policyVersion, "policyVersion");
  const triggerCodes = requireStringArray(value.triggerCodes, "triggerCodes", true);
  return {
    source: value.source,
    policyVersion,
    triggerCodes,
    triggeringOutcomeId: optionalString(value.triggeringOutcomeId),
    triggeringBundleId: optionalString(value.triggeringBundleId),
  };
}

export function parseSafetyHoldResolutionPayload(raw: string): SafetyHoldResolutionPayload {
  const value = parseJsonObject(raw, "سجل حسم Safety Hold غير صالح.");
  if (value.resolution !== "cleared" && value.resolution !== "remediation_required") {
    throw invalidStoredEvidence("نوع حسم Safety Hold المخزن غير معروف.");
  }
  return {
    holdEventId: requireNonEmptyString(value.holdEventId, "holdEventId"),
    resolution: value.resolution,
    note: requireNonEmptyString(value.note, "note"),
  };
}

/**
 * Builds dashboard metrics from SQL aggregates while preserving the P2Q-02
 * sample-size rule. This deliberately exposes no composite score or ranking.
 */
export function buildQualityCalibrationSummary(
  aggregate: QualityCalibrationAggregate,
): QualityCalibrationSummary {
  const fields: Array<[keyof QualityCalibrationAggregate, number]> = [
    ["sampleSize", aggregate.sampleSize],
    ["confirmedAudits", aggregate.confirmedAudits],
    ["correctionRequiredAudits", aggregate.correctionRequiredAudits],
    ["auditsWithMissedEvents", aggregate.auditsWithMissedEvents],
    ["auditsWithSeverityDifferences", aggregate.auditsWithSeverityDifferences],
    ["totalMissedEvents", aggregate.totalMissedEvents],
    ["totalSeverityDifferences", aggregate.totalSeverityDifferences],
    ["maxObservedSeverityDelta", aggregate.maxObservedSeverityDelta],
  ];
  for (const [name, value] of fields) {
    if (!Number.isInteger(value) || value < 0) {
      throw invalidStoredEvidence(`قيمة معايرة مخزنة غير صالحة: ${name}.`);
    }
  }
  if (aggregate.maxObservedSeverityDelta > 3) {
    throw invalidStoredEvidence("فرق شدة مخزن خارج النطاق.");
  }
  for (const count of [
    aggregate.confirmedAudits,
    aggregate.correctionRequiredAudits,
    aggregate.auditsWithMissedEvents,
    aggregate.auditsWithSeverityDifferences,
  ]) {
    if (count > aggregate.sampleSize) {
      throw invalidStoredEvidence("عداد معايرة أكبر من حجم العينة.");
    }
  }
  if (aggregate.confirmedAudits + aggregate.correctionRequiredAudits !== aggregate.sampleSize) {
    throw invalidStoredEvidence("حجم عينة المعايرة لا يطابق نتائج التدقيق المكتملة.");
  }

  const metricsAvailable = aggregate.sampleSize >= MIN_REVIEWER_CALIBRATION_SAMPLE;
  return {
    ...aggregate,
    minimumSampleSize: MIN_REVIEWER_CALIBRATION_SAMPLE,
    metricsAvailable,
    ratesBps: metricsAvailable
      ? {
          confirmedAudits: toBasisPoints(aggregate.confirmedAudits, aggregate.sampleSize),
          correctionRequiredAudits: toBasisPoints(
            aggregate.correctionRequiredAudits,
            aggregate.sampleSize,
          ),
          auditsWithMissedEvents: toBasisPoints(
            aggregate.auditsWithMissedEvents,
            aggregate.sampleSize,
          ),
          auditsWithSeverityDifferences: toBasisPoints(
            aggregate.auditsWithSeverityDifferences,
            aggregate.sampleSize,
          ),
        }
      : null,
  };
}

function toBasisPoints(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count * 10_000) / total);
}

function parseJsonObject(raw: string, message: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw invalidStoredEvidence(message);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw invalidStoredEvidence(message);
  }
  return parsed as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidStoredEvidence(`حقل ${field} المخزن غير صالح.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return requireNonEmptyString(value, "optional string");
}

function requireStringArray(value: unknown, field: string, requireNonEmpty: boolean): string[] {
  if (!Array.isArray(value)) throw invalidStoredEvidence(`حقل ${field} المخزن غير صالح.`);
  const items = value.map((item) => requireNonEmptyString(item, field));
  if (requireNonEmpty && items.length === 0) {
    throw invalidStoredEvidence(`حقل ${field} المخزن فارغ.`);
  }
  if (new Set(items).size !== items.length) {
    throw invalidStoredEvidence(`حقل ${field} المخزن يحتوي قيمًا مكررة.`);
  }
  return items;
}

function invalidStoredEvidence(message: string): ReviewWorkflowError {
  return new ReviewWorkflowError("FORBIDDEN", message);
}
