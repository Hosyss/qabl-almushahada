import { env } from "cloudflare:workers";

import {
  INTERNAL_ROLES,
  ReviewWorkflowError,
  parseDraftForSubmission,
  type InternalAccountStatus,
  type InternalActor,
  type InternalRole,
} from "@/lib/internal-review-workflow";
import {
  compareReferenceCalibrationCase,
  evaluateReferenceCalibration,
  MIN_REFERENCE_CALIBRATION_CASES,
  type ReferenceCalibrationCaseResult,
} from "@/lib/reviewer-reference-calibration";
import type { ReviewerIdentity } from "@/lib/review-engine";
import { loadReviewBundle } from "./load-review-bundle";

interface ActorRow {
  userId: string;
  authEmail: string;
  role: string;
  accountStatus: string;
  userRevision: number;
  reviewerId: string | null;
  independenceGroupId: string | null;
  reviewerStatus: string | null;
  reviewerUpdatedAt: string | null;
}

interface ReferenceSetRow {
  id: string;
  label: string;
  status: "draft" | "active" | "retired";
  minimumCases: number;
  revision: number;
}

interface AttemptCaseRow {
  attemptId: string;
  reviewerId: string;
  setId: string;
  purpose: "initial" | "reactivation" | "drift";
  attemptStatus: "in_progress" | "passed" | "failed";
  setStatus: "active";
  caseId: string;
  bundleId: string;
  referenceSubmissionId: string;
  sequence: number;
}

interface StoredCaseResultRow {
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

interface TargetReviewerRow {
  userId: string;
  userRevision: number;
  accountStatus: "active" | "suspended";
  role: "reviewer" | "editorial_reviewer";
  reviewerId: string;
  reviewerStatus: "probation" | "suspended" | "active";
  reviewerUpdatedAt: string;
}

export async function createReferenceCalibrationSet(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  assertAdmin(actor);
  const request = requireObject(input.request, "بيانات مجموعة المعايرة غير صالحة.");
  rejectUnknownKeys(request, ["label", "minimumCases"]);
  const label = requireTrimmedString(request.label, "label", 3, 160);
  const minimumCases = requireInteger(request.minimumCases ?? MIN_REFERENCE_CALIBRATION_CASES, "minimumCases", 10, 100);
  const setId = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = requireD1();
  const results = await db.batch([
    db.prepare(
      `INSERT INTO reviewer_reference_sets
         (id, label, status, minimum_cases, revision, created_by_user_id, created_at)
       VALUES (?, ?, 'draft', ?, 0, ?, ?)`,
    ).bind(setId, label, minimumCases, actor.userId, now),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'reference_calibration_set_created', 'reviewer_reference_set', id, ?, ?
       FROM reviewer_reference_sets WHERE id = ? AND status = 'draft'`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ label, minimumCases }),
      now,
      setId,
    ),
  ]);
  assertChanges(results, [0, 1]);
  return { setId, label, minimumCases, status: "draft" as const, revision: 0 };
}

export async function addReferenceCalibrationCase(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  assertAdmin(actor);
  const request = requireObject(input.request, "بيانات حالة المعايرة المرجعية غير صالحة.");
  rejectUnknownKeys(request, ["setId", "bundleId", "referenceSubmissionId", "sequence"]);
  const setId = requireTrimmedString(request.setId, "setId", 1, 160);
  const bundleId = requireTrimmedString(request.bundleId, "bundleId", 1, 160);
  const referenceSubmissionId = requireTrimmedString(
    request.referenceSubmissionId,
    "referenceSubmissionId",
    1,
    160,
  );
  const sequence = requireInteger(request.sequence, "sequence", 1, 1000);
  const caseId = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = requireD1();
  const results = await db.batch([
    db.prepare(
      `INSERT INTO reviewer_reference_cases
         (id, set_id, bundle_id, reference_submission_id, sequence, created_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(caseId, setId, bundleId, referenceSubmissionId, sequence, actor.userId, now),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'reference_calibration_case_added', 'reviewer_reference_case', id, ?, ?
       FROM reviewer_reference_cases WHERE id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ setId, bundleId, referenceSubmissionId, sequence }),
      now,
      caseId,
    ),
  ]);
  assertChanges(results, [0, 1]);
  return { caseId, setId, bundleId, sequence };
}

export async function activateReferenceCalibrationSet(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  assertAdmin(actor);
  const request = requireObject(input.request, "بيانات تفعيل مجموعة المعايرة غير صالحة.");
  rejectUnknownKeys(request, ["setId", "expectedRevision"]);
  const setId = requireTrimmedString(request.setId, "setId", 1, 160);
  const expectedRevision = requireInteger(request.expectedRevision, "expectedRevision", 0, Number.MAX_SAFE_INTEGER);
  const db = requireD1();
  const set = await db
    .prepare(
      `SELECT id, label, status, minimum_cases AS minimumCases, revision
       FROM reviewer_reference_sets WHERE id = ? LIMIT 1`,
    )
    .bind(setId)
    .first<ReferenceSetRow>();
  if (!set) throw new ReviewWorkflowError("FORBIDDEN", "مجموعة المعايرة غير موجودة.");
  if (set.status !== "draft") throw new ReviewWorkflowError("ASSIGNMENT_LOCKED", "مجموعة المعايرة لم تعد draft.");
  if (set.revision !== expectedRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision مجموعة المعايرة قديم.");
  }

  const caseCount = await db
    .prepare("SELECT COUNT(*) AS count FROM reviewer_reference_cases WHERE set_id = ?")
    .bind(setId)
    .first<{ count: number }>();
  if (Number(caseCount?.count ?? 0) < set.minimumCases) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "عدد الحالات المرجعية أقل من الحد المطلوب.");
  }

  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(
      `UPDATE reviewer_reference_sets
       SET status = 'active', revision = revision + 1, activated_by_user_id = ?, activated_at = ?
       WHERE id = ? AND status = 'draft' AND revision = ?`,
    ).bind(actor.userId, now, setId, expectedRevision),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'reference_calibration_set_activated', 'reviewer_reference_set', id, ?, ?
       FROM reviewer_reference_sets
       WHERE id = ? AND status = 'active' AND revision = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ fromRevision: expectedRevision, toRevision: expectedRevision + 1 }),
      now,
      setId,
      expectedRevision + 1,
    ),
  ]);
  assertChanges(results, [0, 1]);
  return { setId, status: "active" as const, revision: expectedRevision + 1 };
}

export async function startOwnReferenceCalibrationAttempt(input: {
  sessionEmail: string;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  if ((actor.role !== "reviewer" && actor.role !== "editorial_reviewer") || !actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الحساب ليس له هوية مراجع للمعايرة.");
  }
  if (actor.reviewer.status !== "probation" && actor.reviewer.status !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "المعايرة المرجعية مطلوبة فقط قبل التفعيل أو بعد الإيقاف.");
  }
  if (actor.reviewer.status === "probation" && actor.status !== "active") {
    throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "حساب المراجع الجديد غير متاح لبدء المعايرة.");
  }
  if (actor.reviewer.status === "suspended" && actor.status !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة الحساب لا تطابق حالة المراجع الموقوف.");
  }

  const db = requireD1();
  const activeSets = await db
    .prepare(
      `SELECT id, label, status, minimum_cases AS minimumCases, revision
       FROM reviewer_reference_sets WHERE status = 'active' ORDER BY activated_at DESC, id DESC`,
    )
    .all<ReferenceSetRow>();
  if ((activeSets.results ?? []).length !== 1) {
    throw new ReviewWorkflowError("FORBIDDEN", "يجب وجود مجموعة معايرة مرجعية نشطة واحدة بالضبط.");
  }
  const set = activeSets.results![0];
  const existing = await db
    .prepare(
      `SELECT id FROM reviewer_reference_attempts
       WHERE reviewer_id = ? AND status = 'in_progress' LIMIT 1`,
    )
    .bind(actor.reviewer.id)
    .first<{ id: string }>();
  if (existing) {
    throw new ReviewWorkflowError("ASSIGNMENT_LOCKED", "يوجد اختبار معايرة مفتوح بالفعل لهذا المراجع.");
  }

  const cases = await loadSafeCaseMetadata(set.id);
  if (cases.length < set.minimumCases) {
    throw new ReviewWorkflowError("FORBIDDEN", "مجموعة المعايرة النشطة لم تعد تحتوي العدد المطلوب من الحالات.");
  }
  const purpose = actor.reviewer.status === "probation" ? ("initial" as const) : ("reactivation" as const);
  const attemptId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(
      `INSERT INTO reviewer_reference_attempts
         (id, reviewer_id, set_id, purpose, status, blockers_json, started_at)
       VALUES (?, ?, ?, ?, 'in_progress', '[]', ?)`,
    ).bind(attemptId, actor.reviewer.id, set.id, purpose, now),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'reference_calibration_attempt_started', 'reviewer_reference_attempt', id, ?, ?
       FROM reviewer_reference_attempts WHERE id = ? AND status = 'in_progress'`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ reviewerId: actor.reviewer.id, setId: set.id, purpose, caseCount: cases.length }),
      now,
      attemptId,
    ),
  ]);
  assertChanges(results, [0, 1]);
  return { attemptId, purpose, setLabel: set.label, cases };
}

export async function submitOwnReferenceCalibrationCase(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  if ((actor.role !== "reviewer" && actor.role !== "editorial_reviewer") || !actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الحساب ليس له هوية مراجع للمعايرة.");
  }
  if (actor.reviewer.status !== "probation" && actor.reviewer.status !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "المراجع النشط لا يرسل إجابات اختبار مرجعي.");
  }
  const request = requireObject(input.request, "إجابة المعايرة غير صالحة.");
  rejectUnknownKeys(request, ["attemptId", "caseId", "candidateDraft"]);
  const attemptId = requireTrimmedString(request.attemptId, "attemptId", 1, 160);
  const caseId = requireTrimmedString(request.caseId, "caseId", 1, 160);
  const context = await loadAttemptCase(attemptId, caseId);
  if (context.reviewerId !== actor.reviewer.id) {
    throw new ReviewWorkflowError("ASSIGNMENT_OWNERSHIP", "اختبار المعايرة لا يخص هذا المراجع.");
  }
  if (context.attemptStatus !== "in_progress") {
    throw new ReviewWorkflowError("ASSIGNMENT_LOCKED", "اختبار المعايرة مقفل.");
  }

  const referenceBundle = await loadCurrentReferenceBundle(context);
  const reference = referenceBundle.bundle.submissions.find(
    (submission) => submission.id === context.referenceSubmissionId,
  );
  if (!reference) {
    throw new ReviewWorkflowError("FORBIDDEN", "الإجابة المرجعية لم تعد جزءًا من الحزمة المعتمدة الحالية.");
  }
  const parsedCandidate = parseDraftForSubmission(request.candidateDraft, referenceBundle.bundle.version);
  const candidate = {
    id: `calibration:${attemptId}:${caseId}`,
    versionId: referenceBundle.bundle.version.id,
    reviewer: actor.reviewer,
    ...parsedCandidate,
  };
  const result = compareReferenceCalibrationCase({ caseId, reference, candidate });

  const db = requireD1();
  const existingResults = await db
    .prepare(
      `SELECT
         case_id AS caseId,
         category_matches AS categoryMatches,
         category_total AS categoryTotal,
         reference_observation_count AS referenceObservationCount,
         candidate_observation_count AS candidateObservationCount,
         matched_observation_count AS matchedObservationCount,
         missed_observation_count AS missedObservationCount,
         false_positive_observation_count AS falsePositiveObservationCount,
         missed_high_sensitivity_count AS missedHighSensitivityCount,
         max_severity_delta AS maxSeverityDelta
       FROM reviewer_reference_case_results
       WHERE attempt_id = ? ORDER BY created_at ASC, case_id ASC`,
    )
    .bind(attemptId)
    .all<StoredCaseResultRow>();
  if ((existingResults.results ?? []).some((row) => row.caseId === caseId)) {
    throw new ReviewWorkflowError("ASSIGNMENT_LOCKED", "تم إرسال هذه الحالة المرجعية من قبل.");
  }

  const totalCasesRow = await db
    .prepare("SELECT COUNT(*) AS count FROM reviewer_reference_cases WHERE set_id = ?")
    .bind(context.setId)
    .first<{ count: number }>();
  const totalCases = Number(totalCasesRow?.count ?? 0);
  const priorResults = (existingResults.results ?? []).map(toCaseResult);
  const combined = [...priorResults, result];
  const finalEvaluation = combined.length === totalCases ? evaluateReferenceCalibration(combined) : null;
  const now = new Date().toISOString();
  const statements = [
    db.prepare(
      `INSERT INTO reviewer_reference_case_results
         (attempt_id, case_id, candidate_payload_json, category_matches, category_total,
          reference_observation_count, candidate_observation_count, matched_observation_count,
          missed_observation_count, false_positive_observation_count,
          missed_high_sensitivity_count, max_severity_delta, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       WHERE EXISTS (
         SELECT 1 FROM reviewer_reference_attempts
         WHERE id = ? AND reviewer_id = ? AND status = 'in_progress'
       )`,
    ).bind(
      attemptId,
      caseId,
      JSON.stringify(parsedCandidate),
      result.categoryMatches,
      result.categoryTotal,
      result.referenceObservationCount,
      result.candidateObservationCount,
      result.matchedObservationCount,
      result.missedObservationCount,
      result.falsePositiveObservationCount,
      result.missedHighSensitivityCount,
      result.maxSeverityDelta,
      now,
      attemptId,
      actor.reviewer.id,
    ),
  ];

  let finalizeIndex: number | null = null;
  if (finalEvaluation) {
    finalizeIndex = statements.length;
    statements.push(
      db.prepare(
        `UPDATE reviewer_reference_attempts
         SET status = ?,
             category_agreement_bps = ?,
             observation_recall_bps = ?,
             observation_precision_bps = ?,
             missed_high_sensitivity_count = ?,
             max_severity_delta = ?,
             blockers_json = ?,
             completed_at = ?
         WHERE id = ?
           AND reviewer_id = ?
           AND status = 'in_progress'
           AND (SELECT COUNT(*) FROM reviewer_reference_case_results WHERE attempt_id = ?) = ?`,
      ).bind(
        finalEvaluation.passed ? "passed" : "failed",
        finalEvaluation.metrics.categoryAgreementBps,
        finalEvaluation.metrics.observationRecallBps,
        finalEvaluation.metrics.observationPrecisionBps,
        finalEvaluation.metrics.missedHighSensitivityCount,
        finalEvaluation.metrics.maxSeverityDelta,
        JSON.stringify(finalEvaluation.blockers),
        now,
        attemptId,
        actor.reviewer.id,
        attemptId,
        totalCases,
      ),
    );
  }

  const auditIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, ?, 'reviewer_reference_attempt', id, ?, ?
       FROM reviewer_reference_attempts
       WHERE id = ? AND reviewer_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      finalEvaluation ? "reference_calibration_attempt_completed" : "reference_calibration_case_submitted",
      JSON.stringify(
        finalEvaluation
          ? { reviewerId: actor.reviewer.id, status: finalEvaluation.passed ? "passed" : "failed", metrics: finalEvaluation.metrics, blockers: finalEvaluation.blockers }
          : { reviewerId: actor.reviewer.id, completedCases: combined.length, totalCases },
      ),
      now,
      attemptId,
      actor.reviewer.id,
    ),
  );

  const batchResults = await db.batch(statements);
  const required = [0, auditIndex];
  if (finalizeIndex !== null) required.push(finalizeIndex);
  assertChanges(batchResults, required);

  if (!finalEvaluation) {
    return { attemptId, status: "in_progress" as const, completedCases: combined.length, totalCases };
  }
  return {
    attemptId,
    status: finalEvaluation.passed ? ("passed" as const) : ("failed" as const),
    completedCases: combined.length,
    totalCases,
    metrics: finalEvaluation.metrics,
    blockers: finalEvaluation.blockers,
  };
}

export async function activateCalibratedReviewer(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  assertAdmin(actor);
  const request = requireObject(input.request, "بيانات تفعيل المراجع غير صالحة.");
  rejectUnknownKeys(request, ["targetUserId", "expectedRevision"]);
  const targetUserId = requireTrimmedString(request.targetUserId, "targetUserId", 1, 160);
  const expectedRevision = requireInteger(request.expectedRevision, "expectedRevision", 0, Number.MAX_SAFE_INTEGER);
  if (targetUserId === actor.userId) {
    throw new ReviewWorkflowError("FORBIDDEN", "لا يمكن للمشرف تفعيل نفسه عبر مسار المراجعين.");
  }

  const db = requireD1();
  const target = await db
    .prepare(
      `SELECT
         u.id AS userId,
         u.revision AS userRevision,
         u.status AS accountStatus,
         u.role AS role,
         r.id AS reviewerId,
         r.status AS reviewerStatus,
         r.updated_at AS reviewerUpdatedAt
       FROM internal_users u
       INNER JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.id = ? AND u.role IN ('reviewer', 'editorial_reviewer')
       LIMIT 1`,
    )
    .bind(targetUserId)
    .first<TargetReviewerRow>();
  if (!target) throw new ReviewWorkflowError("FORBIDDEN", "حساب المراجع المطلوب غير موجود.");
  if (target.userRevision !== expectedRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision حساب المراجع قديم.");
  }
  if (target.reviewerStatus !== "probation" && target.reviewerStatus !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "المراجع ليس في حالة تسمح بالتفعيل عبر المعايرة.");
  }
  if (target.reviewerStatus === "probation" && target.accountStatus !== "active") {
    throw new ReviewWorkflowError("FORBIDDEN", "حساب probation يجب أن يبقى نشطًا فقط لمسار المعايرة.");
  }
  if (target.reviewerStatus === "suspended" && target.accountStatus !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة الحساب لا تطابق حالة المراجع الموقوف.");
  }

  const purpose = target.reviewerStatus === "probation" ? "initial" : "reactivation";
  const passed = await db
    .prepare(
      `SELECT a.id
       FROM reviewer_reference_attempts a
       INNER JOIN reviewer_reference_sets s ON s.id = a.set_id
       WHERE a.reviewer_id = ?
         AND a.status = 'passed'
         AND a.purpose = ?
         AND s.status = 'active'
         AND (? = 'probation' OR datetime(a.completed_at) >= datetime(?))
       ORDER BY a.completed_at DESC, a.id DESC
       LIMIT 1`,
    )
    .bind(target.reviewerId, purpose, target.reviewerStatus, target.reviewerUpdatedAt)
    .first<{ id: string }>();
  if (!passed) {
    throw new ReviewWorkflowError("FORBIDDEN", "لا توجد معايرة مرجعية ناجحة وحديثة تسمح بالتفعيل.");
  }

  const transitionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(
      `UPDATE internal_users
       SET status = 'active', revision = revision + 1, last_transition_id = ?, updated_at = ?
       WHERE id = ? AND revision = ? AND status = ?`,
    ).bind(
      transitionId,
      now,
      target.userId,
      expectedRevision,
      target.accountStatus,
    ),
    db.prepare(
      `UPDATE reviewers
       SET status = 'active', updated_at = ?
       WHERE id = ? AND status = ?
         AND EXISTS (
           SELECT 1 FROM internal_users
           WHERE id = ? AND last_transition_id = ? AND revision = ?
         )`,
    ).bind(
      now,
      target.reviewerId,
      target.reviewerStatus,
      target.userId,
      transitionId,
      expectedRevision + 1,
    ),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'calibrated_reviewer_activated', 'internal_user', id, ?, ?
       FROM internal_users
       WHERE id = ? AND last_transition_id = ? AND revision = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ reviewerId: target.reviewerId, previousReviewerStatus: target.reviewerStatus, calibrationAttemptId: passed.id }),
      now,
      target.userId,
      transitionId,
      expectedRevision + 1,
    ),
  ]);
  assertChanges(results, [0, 1, 2]);
  return {
    userId: target.userId,
    reviewerId: target.reviewerId,
    status: "active" as const,
    revision: expectedRevision + 1,
  };
}

async function loadSafeCaseMetadata(setId: string) {
  const rows = await requireD1()
    .prepare(
      `SELECT
         c.id AS caseId,
         c.sequence AS sequence,
         t.canonical_name AS titleName,
         v.edition_label AS editionLabel,
         v.platform AS platform,
         v.language AS language,
         v.runtime_seconds AS runtimeSeconds,
         v.content_fingerprint AS contentFingerprint
       FROM reviewer_reference_cases c
       INNER JOIN review_bundles b ON b.id = c.bundle_id
       INNER JOIN title_versions v ON v.id = b.version_id
       INNER JOIN titles t ON t.id = v.title_id
       INNER JOIN review_assignments a ON a.bundle_id = b.id AND a.submission_id = c.reference_submission_id
       INNER JOIN editorial_approval_submissions eas
         ON eas.approval_id = b.current_approval_id AND eas.submission_id = c.reference_submission_id
       WHERE c.set_id = ?
         AND b.status = 'verified'
         AND b.current_approval_id IS NOT NULL
         AND a.state = 'approved'
       ORDER BY c.sequence ASC, c.id ASC`,
    )
    .bind(setId)
    .all<{
      caseId: string;
      sequence: number;
      titleName: string;
      editionLabel: string;
      platform: string;
      language: string;
      runtimeSeconds: number;
      contentFingerprint: string;
    }>();
  return rows.results ?? [];
}

async function loadAttemptCase(attemptId: string, caseId: string): Promise<AttemptCaseRow> {
  const row = await requireD1()
    .prepare(
      `SELECT
         a.id AS attemptId,
         a.reviewer_id AS reviewerId,
         a.set_id AS setId,
         a.purpose AS purpose,
         a.status AS attemptStatus,
         s.status AS setStatus,
         c.id AS caseId,
         c.bundle_id AS bundleId,
         c.reference_submission_id AS referenceSubmissionId,
         c.sequence AS sequence
       FROM reviewer_reference_attempts a
       INNER JOIN reviewer_reference_sets s ON s.id = a.set_id
       INNER JOIN reviewer_reference_cases c ON c.set_id = a.set_id
       WHERE a.id = ? AND c.id = ? AND s.status = 'active'
       LIMIT 1`,
    )
    .bind(attemptId, caseId)
    .first<AttemptCaseRow>();
  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "حالة المعايرة أو الاختبار المرجعي غير موجودة.");
  return row;
}

async function loadCurrentReferenceBundle(context: AttemptCaseRow) {
  const valid = await requireD1()
    .prepare(
      `SELECT b.id
       FROM review_bundles b
       INNER JOIN review_assignments a ON a.bundle_id = b.id
       INNER JOIN editorial_approval_submissions eas ON eas.approval_id = b.current_approval_id
       WHERE b.id = ?
         AND b.status = 'verified'
         AND b.current_approval_id IS NOT NULL
         AND a.submission_id = ?
         AND a.state = 'approved'
         AND eas.submission_id = ?
       LIMIT 1`,
    )
    .bind(context.bundleId, context.referenceSubmissionId, context.referenceSubmissionId)
    .first<{ id: string }>();
  if (!valid) {
    throw new ReviewWorkflowError(
      "FORBIDDEN",
      "إحدى الحالات المرجعية لم تعد معتمدة حاليًا؛ يجب إيقاف المجموعة واستبدالها.",
    );
  }
  const loaded = await loadReviewBundle(context.bundleId);
  if (!loaded) throw new ReviewWorkflowError("FORBIDDEN", "الحزمة المرجعية غير موجودة.");
  return loaded;
}

function toCaseResult(row: StoredCaseResultRow): ReferenceCalibrationCaseResult {
  return {
    caseId: row.caseId,
    categoryMatches: Number(row.categoryMatches),
    categoryTotal: Number(row.categoryTotal),
    referenceObservationCount: Number(row.referenceObservationCount),
    candidateObservationCount: Number(row.candidateObservationCount),
    matchedObservationCount: Number(row.matchedObservationCount),
    missedObservationCount: Number(row.missedObservationCount),
    falsePositiveObservationCount: Number(row.falsePositiveObservationCount),
    missedHighSensitivityCount: Number(row.missedHighSensitivityCount),
    maxSeverityDelta: Number(row.maxSeverityDelta),
  };
}

async function requireInternalActor(sessionEmail: string): Promise<InternalActor & { revision: number }> {
  const normalizedEmail = sessionEmail.trim().toLowerCase();
  if (!normalizedEmail) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  const row = await requireD1()
    .prepare(
      `SELECT
         u.id AS userId,
         u.auth_email AS authEmail,
         u.role AS role,
         u.status AS accountStatus,
         u.revision AS userRevision,
         r.id AS reviewerId,
         r.independence_group_id AS independenceGroupId,
         r.status AS reviewerStatus,
         r.updated_at AS reviewerUpdatedAt
       FROM internal_users u
       LEFT JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.auth_email = ? LIMIT 1`,
    )
    .bind(normalizedEmail)
    .first<ActorRow>();
  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "الحساب غير مضاف إلى النظام الداخلي.");
  return {
    userId: row.userId,
    email: row.authEmail,
    role: parseRole(row.role),
    status: parseAccountStatus(row.accountStatus),
    reviewer: parseOptionalReviewer(row),
    revision: Number(row.userRevision),
  };
}

function assertAdmin(actor: InternalActor): void {
  if (actor.status !== "active") throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");
  if (actor.role !== "admin") throw new ReviewWorkflowError("FORBIDDEN", "هذه العملية تتطلب Admin نشطًا.");
}

function parseRole(value: string): InternalRole {
  if ((INTERNAL_ROLES as readonly string[]).includes(value)) return value as InternalRole;
  throw new ReviewWorkflowError("FORBIDDEN", "دور داخلي مخزن غير معروف.");
}

function parseAccountStatus(value: string): InternalAccountStatus {
  if (value === "active" || value === "suspended") return value;
  throw new ReviewWorkflowError("FORBIDDEN", "حالة الحساب الداخلي غير معروفة.");
}

function parseOptionalReviewer(row: ActorRow): ReviewerIdentity | null {
  if (!row.reviewerId || !row.independenceGroupId || !row.reviewerStatus) return null;
  if (row.reviewerStatus !== "active" && row.reviewerStatus !== "probation" && row.reviewerStatus !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة المراجع المخزنة غير معروفة.");
  }
  return {
    id: row.reviewerId,
    independenceGroupId: row.independenceGroupId,
    status: row.reviewerStatus,
  };
}

function requireObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", message);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "الطلب يحتوي حقولًا غير مسموح بها.",
      unknown.map((key) => `unknown field: ${key}`),
    );
  }
}

function requireTrimmedString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== "string") throw new ReviewWorkflowError("INVALID_DRAFT", `${field} غير صالح.`);
  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} خارج الطول المسموح.`);
  }
  return trimmed;
}

function requireInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} غير صالح.`);
  }
  return value as number;
}

function assertChanges(results: Array<{ meta?: { changes?: number } }>, indexes: readonly number[]): void {
  for (const index of indexes) {
    if ((results[index]?.meta?.changes ?? 0) !== 1) {
      throw new ReviewWorkflowError(
        "REVISION_CONFLICT",
        "تعارض تعديل متزامن أو فشل قيد أمني؛ أعد تحميل البيانات.",
      );
    }
  }
}

function requireD1() {
  if (!env.DB) throw new Error("D1 binding `DB` is unavailable.");
  return env.DB;
}
