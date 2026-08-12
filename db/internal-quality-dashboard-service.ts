import { env } from "cloudflare:workers";

import {
  assertQualityDashboardAccess,
  buildQualityCalibrationSummary,
  parseSafetyHoldPayload,
  parseSafetyHoldResolutionPayload,
  type QualityCalibrationSummary,
  type QualityReviewerStatus,
  type SafetyHoldResolution,
  type SafetyHoldSource,
} from "@/lib/internal-quality-dashboard";
import {
  INTERNAL_ROLES,
  ReviewWorkflowError,
  type InternalAccountStatus,
  type InternalRole,
} from "@/lib/internal-review-workflow";

interface ActorRow {
  userId: string;
  authEmail: string;
  role: string;
  accountStatus: string;
  reviewerId: string | null;
  reviewerStatus: string | null;
}

interface HoldRow {
  holdEventId: string;
  reviewerId: string;
  reviewerLabel: string;
  reviewerStatus: string;
  reviewerEmail: string | null;
  accountStatus: string | null;
  payloadJson: string;
  createdAt: string;
  resolutionPayloadJson: string | null;
  resolvedAt: string | null;
}

interface ConflictRow {
  bundleId: string;
  versionId: string;
  titleName: string;
  editionLabel: string;
  platform: string;
  language: string;
  bundleRevision: number;
  updatedAt: string;
  openReportCount: number;
  latestReportType: string | null;
  latestReportStatus: string | null;
}

interface CalibrationAggregateRow {
  reviewerId: string;
  reviewerLabel: string;
  reviewerStatus: string;
  accountStatus: string | null;
  sampleSize: number;
  confirmedAudits: number;
  correctionRequiredAudits: number;
  auditsWithMissedEvents: number;
  auditsWithSeverityDifferences: number;
  totalMissedEvents: number;
  totalSeverityDifferences: number;
  maxObservedSeverityDelta: number;
}

interface ReferenceAttemptRow {
  attemptId: string;
  reviewerId: string;
  reviewerLabel: string;
  reviewerStatus: string;
  purpose: string;
  status: string;
  categoryAgreementBps: number | null;
  observationRecallBps: number | null;
  observationPrecisionBps: number | null;
  missedHighSensitivityCount: number | null;
  maxSeverityDelta: number | null;
  blockersJson: string;
  startedAt: string;
  completedAt: string | null;
}

export interface QualitySafetyHoldRow {
  holdEventId: string;
  reviewerId: string;
  reviewerLabel: string;
  reviewerEmail: string | null;
  reviewerStatus: QualityReviewerStatus;
  accountStatus: InternalAccountStatus | null;
  source: SafetyHoldSource;
  policyVersion: string;
  triggerCodes: string[];
  triggeringOutcomeId: string | null;
  triggeringBundleId: string | null;
  createdAt: string;
  resolution: SafetyHoldResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
}

export interface QualityConflictRow {
  bundleId: string;
  versionId: string;
  titleName: string;
  editionLabel: string;
  platform: string;
  language: string;
  bundleRevision: number;
  updatedAt: string;
  openReportCount: number;
  latestReportType: string | null;
  latestReportStatus: string | null;
}

export interface QualityReviewerCalibrationRow {
  reviewerId: string;
  reviewerLabel: string;
  reviewerStatus: QualityReviewerStatus;
  accountStatus: InternalAccountStatus | null;
  calibration: QualityCalibrationSummary;
}

export interface QualityReferenceAttemptRow {
  attemptId: string;
  reviewerId: string;
  reviewerLabel: string;
  reviewerStatus: QualityReviewerStatus;
  purpose: "initial" | "reactivation" | "drift";
  status: "in_progress" | "passed" | "failed";
  categoryAgreementBps: number | null;
  observationRecallBps: number | null;
  observationPrecisionBps: number | null;
  missedHighSensitivityCount: number | null;
  maxSeverityDelta: number | null;
  blockers: string[];
  startedAt: string;
  completedAt: string | null;
}

export interface InternalQualityDashboardData {
  actor: {
    userId: string;
    email: string;
    role: "admin" | "editorial_reviewer";
  };
  summary: {
    unresolvedSafetyHolds: number;
    conflictedBundles: number;
    reviewersWithCalibrationMetrics: number;
    referenceAttemptsInProgress: number;
  };
  safetyHolds: QualitySafetyHoldRow[];
  conflicts: QualityConflictRow[];
  reviewerCalibration: QualityReviewerCalibrationRow[];
  referenceAttempts: QualityReferenceAttemptRow[];
}

export async function loadInternalQualityDashboard(
  sessionEmail: string,
): Promise<InternalQualityDashboardData> {
  const db = requireD1();
  const actor = await requireQualityActor(sessionEmail);

  const [holdResult, conflictResult, calibrationResult, referenceResult] = await Promise.all([
    db
      .prepare(
        `SELECT
           h.id AS holdEventId,
           h.entity_id AS reviewerId,
           r.display_label AS reviewerLabel,
           r.status AS reviewerStatus,
           (
             SELECT iu.auth_email FROM internal_users iu
             WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
             ORDER BY iu.created_at DESC, iu.id DESC LIMIT 1
           ) AS reviewerEmail,
           (
             SELECT iu.status FROM internal_users iu
             WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
             ORDER BY iu.created_at DESC, iu.id DESC LIMIT 1
           ) AS accountStatus,
           h.payload_json AS payloadJson,
           h.created_at AS createdAt,
           (
             SELECT x.payload_json FROM internal_audit_events x
             WHERE x.event_type = 'reviewer_safety_hold_resolved'
               AND json_extract(x.payload_json, '$.holdEventId') = h.id
             ORDER BY datetime(x.created_at) DESC, x.id DESC LIMIT 1
           ) AS resolutionPayloadJson,
           (
             SELECT x.created_at FROM internal_audit_events x
             WHERE x.event_type = 'reviewer_safety_hold_resolved'
               AND json_extract(x.payload_json, '$.holdEventId') = h.id
             ORDER BY datetime(x.created_at) DESC, x.id DESC LIMIT 1
           ) AS resolvedAt
         FROM internal_audit_events h
         INNER JOIN reviewers r ON r.id = h.entity_id
         WHERE h.event_type = 'reviewer_safety_hold_placed'
           AND h.entity_type = 'reviewer'
         ORDER BY CASE WHEN resolutionPayloadJson IS NULL THEN 0 ELSE 1 END,
                  datetime(h.created_at) DESC, h.id DESC
         LIMIT 50`,
      )
      .all<HoldRow>(),
    db
      .prepare(
        `SELECT
           b.id AS bundleId,
           b.version_id AS versionId,
           t.canonical_name AS titleName,
           v.edition_label AS editionLabel,
           v.platform AS platform,
           v.language AS language,
           b.revision AS bundleRevision,
           b.updated_at AS updatedAt,
           (
             SELECT COUNT(*) FROM review_reports rr
             WHERE rr.bundle_id = b.id AND rr.status IN ('open', 'investigating')
           ) AS openReportCount,
           (
             SELECT rr.report_type FROM review_reports rr
             WHERE rr.bundle_id = b.id
             ORDER BY CASE WHEN rr.status IN ('open', 'investigating') THEN 0 ELSE 1 END,
                      datetime(rr.created_at) DESC, rr.id DESC LIMIT 1
           ) AS latestReportType,
           (
             SELECT rr.status FROM review_reports rr
             WHERE rr.bundle_id = b.id
             ORDER BY CASE WHEN rr.status IN ('open', 'investigating') THEN 0 ELSE 1 END,
                      datetime(rr.created_at) DESC, rr.id DESC LIMIT 1
           ) AS latestReportStatus
         FROM review_bundles b
         INNER JOIN title_versions v ON v.id = b.version_id
         INNER JOIN titles t ON t.id = v.title_id
         WHERE b.status = 'conflicted'
         ORDER BY datetime(b.updated_at) DESC, b.id DESC
         LIMIT 50`,
      )
      .all<ConflictRow>(),
    db
      .prepare(
        `WITH outcome_stats AS (
           SELECT
             o.id AS outcomeId,
             o.subject_reviewer_id AS reviewerId,
             o.status AS status,
             SUM(CASE WHEN f.finding_type = 'missed_event' THEN 1 ELSE 0 END) AS missedEventCount,
             SUM(CASE WHEN f.finding_type = 'severity_difference' THEN 1 ELSE 0 END) AS severityDifferenceCount,
             COALESCE(MAX(CASE
               WHEN f.finding_type = 'severity_difference'
                 THEN abs(f.auditor_severity - f.reviewer_severity)
               ELSE 0
             END), 0) AS maxSeverityDelta
           FROM review_audit_outcomes o
           LEFT JOIN review_audit_findings f ON f.outcome_id = o.id
           WHERE o.status IN ('confirmed', 'correction_required')
           GROUP BY o.id, o.subject_reviewer_id, o.status
         )
         SELECT
           r.id AS reviewerId,
           r.display_label AS reviewerLabel,
           r.status AS reviewerStatus,
           (
             SELECT iu.status FROM internal_users iu
             WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
             ORDER BY iu.created_at DESC, iu.id DESC LIMIT 1
           ) AS accountStatus,
           COUNT(os.outcomeId) AS sampleSize,
           SUM(CASE WHEN os.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedAudits,
           SUM(CASE WHEN os.status = 'correction_required' THEN 1 ELSE 0 END) AS correctionRequiredAudits,
           SUM(CASE WHEN os.missedEventCount > 0 THEN 1 ELSE 0 END) AS auditsWithMissedEvents,
           SUM(CASE WHEN os.severityDifferenceCount > 0 THEN 1 ELSE 0 END) AS auditsWithSeverityDifferences,
           COALESCE(SUM(os.missedEventCount), 0) AS totalMissedEvents,
           COALESCE(SUM(os.severityDifferenceCount), 0) AS totalSeverityDifferences,
           COALESCE(MAX(os.maxSeverityDelta), 0) AS maxObservedSeverityDelta
         FROM reviewers r
         LEFT JOIN outcome_stats os ON os.reviewerId = r.id
         WHERE EXISTS (
           SELECT 1 FROM internal_users iu
           WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
         )
         GROUP BY r.id, r.display_label, r.status
         ORDER BY lower(r.display_label), r.id`,
      )
      .all<CalibrationAggregateRow>(),
    db
      .prepare(
        `SELECT
           a.id AS attemptId,
           a.reviewer_id AS reviewerId,
           r.display_label AS reviewerLabel,
           r.status AS reviewerStatus,
           a.purpose AS purpose,
           a.status AS status,
           a.category_agreement_bps AS categoryAgreementBps,
           a.observation_recall_bps AS observationRecallBps,
           a.observation_precision_bps AS observationPrecisionBps,
           a.missed_high_sensitivity_count AS missedHighSensitivityCount,
           a.max_severity_delta AS maxSeverityDelta,
           a.blockers_json AS blockersJson,
           a.started_at AS startedAt,
           a.completed_at AS completedAt
         FROM reviewer_reference_attempts a
         INNER JOIN reviewers r ON r.id = a.reviewer_id
         WHERE a.id = (
           SELECT a2.id FROM reviewer_reference_attempts a2
           WHERE a2.reviewer_id = a.reviewer_id
           ORDER BY datetime(COALESCE(a2.completed_at, a2.started_at)) DESC, a2.id DESC
           LIMIT 1
         )
         ORDER BY lower(r.display_label), r.id`,
      )
      .all<ReferenceAttemptRow>(),
  ]);

  const safetyHolds = (holdResult.results ?? []).map(toSafetyHoldRow);
  const conflicts = (conflictResult.results ?? []).map(toConflictRow);
  const reviewerCalibration = (calibrationResult.results ?? []).map(toCalibrationRow);
  const referenceAttempts = (referenceResult.results ?? []).map(toReferenceAttemptRow);

  return {
    actor: {
      userId: actor.userId,
      email: actor.authEmail,
      role: actor.role,
    },
    summary: {
      unresolvedSafetyHolds: safetyHolds.filter((item) => item.resolution === null).length,
      conflictedBundles: conflicts.length,
      reviewersWithCalibrationMetrics: reviewerCalibration.filter(
        (item) => item.calibration.metricsAvailable,
      ).length,
      referenceAttemptsInProgress: referenceAttempts.filter((item) => item.status === "in_progress")
        .length,
    },
    safetyHolds,
    conflicts,
    reviewerCalibration,
    referenceAttempts,
  };
}

async function requireQualityActor(sessionEmail: string): Promise<{
  userId: string;
  authEmail: string;
  role: "admin" | "editorial_reviewer";
}> {
  const normalizedEmail = sessionEmail.trim().toLowerCase();
  if (!normalizedEmail) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  const row = await requireD1()
    .prepare(
      `SELECT
         u.id AS userId,
         u.auth_email AS authEmail,
         u.role AS role,
         u.status AS accountStatus,
         r.id AS reviewerId,
         r.status AS reviewerStatus
       FROM internal_users u
       LEFT JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.auth_email = ? LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first<ActorRow>();
  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "الحساب غير مضاف إلى النظام الداخلي.");

  const role = parseRole(row.role);
  const accountStatus = parseAccountStatus(row.accountStatus);
  const reviewerStatus = parseOptionalReviewerStatus(row.reviewerStatus);
  assertQualityDashboardAccess({ role, accountStatus, reviewerStatus });
  if (role !== "admin" && role !== "editorial_reviewer") {
    throw new ReviewWorkflowError("FORBIDDEN", "الدور الحالي لا يملك صلاحية لوحة الجودة.");
  }
  return { userId: row.userId, authEmail: row.authEmail, role };
}

function toSafetyHoldRow(row: HoldRow): QualitySafetyHoldRow {
  const payload = parseSafetyHoldPayload(row.payloadJson);
  const resolution = row.resolutionPayloadJson
    ? parseSafetyHoldResolutionPayload(row.resolutionPayloadJson)
    : null;
  if (resolution && resolution.holdEventId !== row.holdEventId) {
    throw new ReviewWorkflowError("FORBIDDEN", "سجل حسم Safety Hold لا يطابق التعليق الأصلي.");
  }
  return {
    holdEventId: row.holdEventId,
    reviewerId: row.reviewerId,
    reviewerLabel: row.reviewerLabel,
    reviewerEmail: row.reviewerEmail,
    reviewerStatus: parseReviewerStatus(row.reviewerStatus),
    accountStatus: row.accountStatus ? parseAccountStatus(row.accountStatus) : null,
    source: payload.source,
    policyVersion: payload.policyVersion,
    triggerCodes: payload.triggerCodes,
    triggeringOutcomeId: payload.triggeringOutcomeId,
    triggeringBundleId: payload.triggeringBundleId,
    createdAt: row.createdAt,
    resolution: resolution?.resolution ?? null,
    resolutionNote: resolution?.note ?? null,
    resolvedAt: row.resolvedAt,
  };
}

function toConflictRow(row: ConflictRow): QualityConflictRow {
  return {
    bundleId: row.bundleId,
    versionId: row.versionId,
    titleName: row.titleName,
    editionLabel: row.editionLabel,
    platform: row.platform,
    language: row.language,
    bundleRevision: requireNonNegativeInteger(row.bundleRevision, "bundleRevision"),
    updatedAt: row.updatedAt,
    openReportCount: requireNonNegativeInteger(row.openReportCount, "openReportCount"),
    latestReportType: row.latestReportType,
    latestReportStatus: row.latestReportStatus,
  };
}

function toCalibrationRow(row: CalibrationAggregateRow): QualityReviewerCalibrationRow {
  return {
    reviewerId: row.reviewerId,
    reviewerLabel: row.reviewerLabel,
    reviewerStatus: parseReviewerStatus(row.reviewerStatus),
    accountStatus: row.accountStatus ? parseAccountStatus(row.accountStatus) : null,
    calibration: buildQualityCalibrationSummary({
      sampleSize: requireNonNegativeInteger(row.sampleSize, "sampleSize"),
      confirmedAudits: requireNonNegativeInteger(row.confirmedAudits, "confirmedAudits"),
      correctionRequiredAudits: requireNonNegativeInteger(
        row.correctionRequiredAudits,
        "correctionRequiredAudits",
      ),
      auditsWithMissedEvents: requireNonNegativeInteger(
        row.auditsWithMissedEvents,
        "auditsWithMissedEvents",
      ),
      auditsWithSeverityDifferences: requireNonNegativeInteger(
        row.auditsWithSeverityDifferences,
        "auditsWithSeverityDifferences",
      ),
      totalMissedEvents: requireNonNegativeInteger(row.totalMissedEvents, "totalMissedEvents"),
      totalSeverityDifferences: requireNonNegativeInteger(
        row.totalSeverityDifferences,
        "totalSeverityDifferences",
      ),
      maxObservedSeverityDelta: requireNonNegativeInteger(
        row.maxObservedSeverityDelta,
        "maxObservedSeverityDelta",
      ),
    }),
  };
}

function toReferenceAttemptRow(row: ReferenceAttemptRow): QualityReferenceAttemptRow {
  if (row.purpose !== "initial" && row.purpose !== "reactivation" && row.purpose !== "drift") {
    throw new ReviewWorkflowError("FORBIDDEN", "غرض معايرة مرجعية مخزن غير معروف.");
  }
  if (row.status !== "in_progress" && row.status !== "passed" && row.status !== "failed") {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة معايرة مرجعية مخزنة غير معروفة.");
  }
  return {
    attemptId: row.attemptId,
    reviewerId: row.reviewerId,
    reviewerLabel: row.reviewerLabel,
    reviewerStatus: parseReviewerStatus(row.reviewerStatus),
    purpose: row.purpose,
    status: row.status,
    categoryAgreementBps: optionalBasisPoints(row.categoryAgreementBps),
    observationRecallBps: optionalBasisPoints(row.observationRecallBps),
    observationPrecisionBps: optionalBasisPoints(row.observationPrecisionBps),
    missedHighSensitivityCount: optionalNonNegativeInteger(row.missedHighSensitivityCount),
    maxSeverityDelta: optionalSeverityDelta(row.maxSeverityDelta),
    blockers: parseStoredStringArray(row.blockersJson, "blockers_json"),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function parseRole(value: string): InternalRole {
  if ((INTERNAL_ROLES as readonly string[]).includes(value)) return value as InternalRole;
  throw new ReviewWorkflowError("FORBIDDEN", "دور داخلي مخزن غير معروف.");
}

function parseAccountStatus(value: string): InternalAccountStatus {
  if (value === "active" || value === "suspended") return value;
  throw new ReviewWorkflowError("FORBIDDEN", "حالة حساب داخلية مخزنة غير معروفة.");
}

function parseOptionalReviewerStatus(value: string | null): QualityReviewerStatus | null {
  return value === null ? null : parseReviewerStatus(value);
}

function parseReviewerStatus(value: string): QualityReviewerStatus {
  if (value === "active" || value === "probation" || value === "suspended") return value;
  throw new ReviewWorkflowError("FORBIDDEN", "حالة مراجع مخزنة غير معروفة.");
}

function parseStoredStringArray(raw: string, field: string): string[] {
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new ReviewWorkflowError("FORBIDDEN", `حقل ${field} المخزن ليس JSON صالحًا.`);
  }
  if (!Array.isArray(value)) {
    throw new ReviewWorkflowError("FORBIDDEN", `حقل ${field} المخزن ليس قائمة.`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new ReviewWorkflowError("FORBIDDEN", `حقل ${field} يحتوي قيمة غير صالحة.`);
    }
    return item.trim();
  });
}

function requireNonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ReviewWorkflowError("FORBIDDEN", `قيمة ${field} المخزنة غير صالحة.`);
  }
  return value;
}

function optionalNonNegativeInteger(value: number | null): number | null {
  return value === null ? null : requireNonNegativeInteger(value, "optional integer");
}

function optionalBasisPoints(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new ReviewWorkflowError("FORBIDDEN", "قيمة basis-points مخزنة غير صالحة.");
  }
  return value;
}

function optionalSeverityDelta(value: number | null): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new ReviewWorkflowError("FORBIDDEN", "فرق شدة مخزن غير صالح.");
  }
  return value;
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
