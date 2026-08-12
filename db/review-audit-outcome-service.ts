import { env } from "cloudflare:workers";

import {
  INTERNAL_ROLES,
  ReviewWorkflowError,
  type InternalActor,
  type InternalAccountStatus,
  type InternalRole,
} from "@/lib/internal-review-workflow";
import { parseAuditOutcomeRequest, type AuditFindingInput } from "@/lib/review-audit-outcome";
import {
  summarizeReviewerCalibration,
  type CompletedAuditCalibrationSample,
} from "@/lib/reviewer-calibration";
import type { ContentCategory, ObservedSeverity, ReviewerIdentity } from "@/lib/review-engine";

interface ActorRow {
  userId: string;
  authEmail: string;
  role: string;
  accountStatus: string;
  reviewerId: string | null;
  independenceGroupId: string | null;
  reviewerStatus: string | null;
}

interface SelectionContextRow {
  selectionId: string;
  selected: number;
  submissionId: string;
  assignmentId: string;
  bundleId: string;
  versionId: string;
  subjectReviewerId: string;
  subjectIndependenceGroupId: string;
  assignmentState: string;
  assignmentRevision: number;
  currentSubmissionId: string | null;
  bundleStatus: string;
  bundleRevision: number;
  currentApprovalId: string | null;
  runtimeSeconds: number;
}

interface ObservationRow {
  id: string;
  category: ContentCategory;
  severity: ObservedSeverity;
}

interface StoredFinding {
  id: string;
  findingType: "missed_event" | "severity_difference";
  category: ContentCategory;
  targetObservationId: string | null;
  reviewerSeverity: ObservedSeverity | null;
  auditorSeverity: ObservedSeverity;
  startSecond: number | null;
  endSecond: number | null;
  summary: string;
}

interface CalibrationRow {
  status: "confirmed" | "correction_required";
  missedEventCount: number;
  severityDifferenceCount: number;
  maxSeverityDelta: number;
}

export async function recordReviewAuditOutcome(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  assertCanRecordAuditOutcome(actor);
  const request = parseAuditOutcomeRequest(input.request);
  const context = await loadSelectionContext(request.selectionId);

  if (context.selected !== 1) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذه المراجعة لم تُختر للتدقيق العشوائي.");
  }
  if (
    context.assignmentState !== "submitted" ||
    context.currentSubmissionId !== context.submissionId
  ) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "المراجعة المختارة لم تعد هي submission الحالية المرسلة.",
    );
  }
  if (context.bundleStatus !== "under_review" && context.bundleStatus !== "conflicted") {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "حالة الحزمة لا تسمح بتسجيل تدقيق جديد.");
  }
  if (context.currentApprovalId !== null) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "يوجد اعتماد حالي على الحزمة؛ التدقيق المختار يجب أن يسبق الاعتماد.",
    );
  }
  if (!actor.reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "هوية المدقق غير موجودة.");
  }
  if (actor.reviewer.id === context.subjectReviewerId) {
    throw new ReviewWorkflowError("SELF_APPROVAL", "لا يجوز للمراجع تدقيق مراجعته بنفسه.");
  }
  if (actor.reviewer.independenceGroupId === context.subjectIndependenceGroupId) {
    throw new ReviewWorkflowError(
      "EDITOR_NOT_INDEPENDENT",
      "المدقق يجب أن يكون من مجموعة استقلال مختلفة عن المراجع.",
    );
  }

  const findings = await materializeFindings(
    request.findings,
    context.submissionId,
    context.runtimeSeconds,
  );
  const outcomeStatus = findings.length === 0 ? "confirmed" : "correction_required";
  const outcomeId = crypto.randomUUID();
  const transitionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = requireD1();
  const statements = [
    db.prepare(
      `INSERT INTO review_audit_outcomes
         (id, selection_id, submission_id, assignment_id, bundle_id, version_id,
          subject_reviewer_id, auditor_user_id, auditor_reviewer_id, status,
          notes, revision, created_at)
       SELECT ?, selection.id, selection.submission_id, selection.assignment_id,
              selection.bundle_id, selection.version_id, selection.reviewer_id,
              ?, ?, 'pending', ?, 0, ?
       FROM review_audit_selections selection
       INNER JOIN review_assignments assignment ON assignment.id = selection.assignment_id
       INNER JOIN review_bundles bundle ON bundle.id = selection.bundle_id
       WHERE selection.id = ?
         AND selection.selected = 1
         AND assignment.state = 'submitted'
         AND assignment.submission_id = selection.submission_id
         AND assignment.revision = ?
         AND bundle.revision = ?
         AND bundle.status = ?
         AND bundle.current_approval_id IS NULL`,
    ).bind(
      outcomeId,
      actor.userId,
      actor.reviewer.id,
      request.notes,
      now,
      context.selectionId,
      context.assignmentRevision,
      context.bundleRevision,
      context.bundleStatus,
    ),
  ];

  const findingIndexes: number[] = [];
  for (const finding of findings) {
    findingIndexes.push(statements.length);
    statements.push(
      db.prepare(
        `INSERT INTO review_audit_findings
           (id, outcome_id, finding_type, category, target_observation_id,
            reviewer_severity, auditor_severity, start_second, end_second, summary, created_at)
         SELECT ?, id, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM review_audit_outcomes
         WHERE id = ? AND status = 'pending' AND revision = 0`,
      ).bind(
        finding.id,
        finding.findingType,
        finding.category,
        finding.targetObservationId,
        finding.reviewerSeverity,
        finding.auditorSeverity,
        finding.startSecond,
        finding.endSecond,
        finding.summary,
        now,
        outcomeId,
      ),
    );
  }

  const finalizeIndex = statements.length;
  statements.push(
    db.prepare(
      `UPDATE review_audit_outcomes
       SET status = ?, revision = 1, final_transition_id = ?, completed_at = ?
       WHERE id = ? AND status = 'pending' AND revision = 0`,
    ).bind(outcomeStatus, transitionId, now, outcomeId),
  );

  let assignmentIndex: number | null = null;
  let bundleIndex: number | null = null;
  if (outcomeStatus === "correction_required") {
    assignmentIndex = statements.length;
    statements.push(
      db.prepare(
        `UPDATE review_assignments
         SET state = 'changes_requested',
             revision = revision + 1,
             last_transition_id = ?,
             updated_at = ?
         WHERE id = ?
           AND revision = ?
           AND state = 'submitted'
           AND submission_id = ?
           AND EXISTS (
             SELECT 1 FROM review_audit_outcomes
             WHERE id = ?
               AND status = 'correction_required'
               AND final_transition_id = ?
           )`,
      ).bind(
        transitionId,
        now,
        context.assignmentId,
        context.assignmentRevision,
        context.submissionId,
        outcomeId,
        transitionId,
      ),
    );

    bundleIndex = statements.length;
    statements.push(
      db.prepare(
        `UPDATE review_bundles
         SET status = ?,
             revision = revision + 1,
             workflow_transition_id = ?,
             updated_at = ?
         WHERE id = ?
           AND revision = ?
           AND status = ?
           AND current_approval_id IS NULL
           AND EXISTS (
             SELECT 1 FROM review_assignments
             WHERE id = ?
               AND state = 'changes_requested'
               AND last_transition_id = ?
           )`,
      ).bind(
        context.bundleStatus === "conflicted" ? "conflicted" : "under_review",
        transitionId,
        now,
        context.bundleId,
        context.bundleRevision,
        context.bundleStatus,
        context.assignmentId,
        transitionId,
      ),
    );
  }

  const missedEventCount = findings.filter((finding) => finding.findingType === "missed_event").length;
  const severityDifferences = findings.filter(
    (finding) => finding.findingType === "severity_difference",
  );
  const maxSeverityDelta = severityDifferences.reduce(
    (maximum, finding) =>
      Math.max(
        maximum,
        Math.abs((finding.reviewerSeverity ?? finding.auditorSeverity) - finding.auditorSeverity),
      ),
    0,
  );

  const auditIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, bundle_id, ?, ?, 'review_audit_outcome', id, ?, ?
       FROM review_audit_outcomes
       WHERE id = ?
         AND final_transition_id = ?
         AND status = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      outcomeStatus === "confirmed" ? "random_audit_confirmed" : "random_audit_correction_required",
      JSON.stringify({
        selectionId: context.selectionId,
        submissionId: context.submissionId,
        subjectReviewerId: context.subjectReviewerId,
        outcomeStatus,
        findingCount: findings.length,
        missedEventCount,
        severityDifferenceCount: severityDifferences.length,
        maxSeverityDelta,
      }),
      now,
      outcomeId,
      transitionId,
      outcomeStatus,
    ),
  );

  const results = await db.batch(statements);
  const requiredIndexes = [0, ...findingIndexes, finalizeIndex, auditIndex];
  if (assignmentIndex !== null) requiredIndexes.push(assignmentIndex);
  if (bundleIndex !== null) requiredIndexes.push(bundleIndex);
  assertChanges(results, requiredIndexes);

  return {
    outcomeId,
    selectionId: context.selectionId,
    status: outcomeStatus,
    findingCount: findings.length,
    assignmentState:
      outcomeStatus === "correction_required" ? ("changes_requested" as const) : ("submitted" as const),
    assignmentRevision:
      context.assignmentRevision + (outcomeStatus === "correction_required" ? 1 : 0),
    bundleRevision: context.bundleRevision + (outcomeStatus === "correction_required" ? 1 : 0),
  };
}

export async function getReviewerCalibrationSummary(input: {
  sessionEmail: string;
  reviewerId: string;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  if (actor.status !== "active" || (actor.role !== "admin" && actor.role !== "editorial_reviewer")) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الدور لا يملك صلاحية قراءة سجل المعايرة.");
  }
  const reviewerId = input.reviewerId.trim();
  if (!reviewerId) throw new ReviewWorkflowError("INVALID_DRAFT", "reviewerId مطلوب.");

  const reviewerExists = await requireD1()
    .prepare("SELECT id FROM reviewers WHERE id = ? LIMIT 1")
    .bind(reviewerId)
    .first<{ id: string }>();
  if (!reviewerExists) throw new ReviewWorkflowError("FORBIDDEN", "المراجع غير موجود.");

  const rows = await requireD1()
    .prepare(
      `SELECT
         outcome.status AS status,
         SUM(CASE WHEN finding.finding_type = 'missed_event' THEN 1 ELSE 0 END) AS missedEventCount,
         SUM(CASE WHEN finding.finding_type = 'severity_difference' THEN 1 ELSE 0 END) AS severityDifferenceCount,
         COALESCE(MAX(CASE
           WHEN finding.finding_type = 'severity_difference'
           THEN abs(finding.auditor_severity - finding.reviewer_severity)
           ELSE 0
         END), 0) AS maxSeverityDelta
       FROM review_audit_outcomes outcome
       LEFT JOIN review_audit_findings finding ON finding.outcome_id = outcome.id
       WHERE outcome.subject_reviewer_id = ?
         AND outcome.status IN ('confirmed', 'correction_required')
       GROUP BY outcome.id, outcome.status
       ORDER BY outcome.completed_at ASC, outcome.id ASC`,
    )
    .bind(reviewerId)
    .all<CalibrationRow>();

  const samples: CompletedAuditCalibrationSample[] = (rows.results ?? []).map((row) => ({
    status: row.status,
    missedEventCount: Number(row.missedEventCount ?? 0),
    severityDifferenceCount: Number(row.severityDifferenceCount ?? 0),
    maxSeverityDelta: Number(row.maxSeverityDelta ?? 0),
  }));

  return {
    reviewerId,
    ...summarizeReviewerCalibration(samples),
  };
}

async function materializeFindings(
  findings: readonly AuditFindingInput[],
  submissionId: string,
  runtimeSeconds: number,
): Promise<StoredFinding[]> {
  const observationRows = await requireD1()
    .prepare(
      `SELECT id, category, severity
       FROM observations
       WHERE submission_id = ?`,
    )
    .bind(submissionId)
    .all<ObservationRow>();
  const observations = new Map((observationRows.results ?? []).map((row) => [row.id, row]));

  return findings.map((finding): StoredFinding => {
    if (finding.type === "missed_event") {
      if (finding.endSecond > runtimeSeconds) {
        throw new ReviewWorkflowError("INVALID_DRAFT", "توقيت الحدث الفائت يتجاوز مدة النسخة.");
      }
      return {
        id: crypto.randomUUID(),
        findingType: finding.type,
        category: finding.category,
        targetObservationId: null,
        reviewerSeverity: null,
        auditorSeverity: finding.auditorSeverity,
        startSecond: finding.startSecond,
        endSecond: finding.endSecond,
        summary: finding.summary,
      };
    }

    const observation = observations.get(finding.observationId);
    if (!observation) {
      throw new ReviewWorkflowError(
        "INVALID_DRAFT",
        "واقعة فرق الشدة ليست جزءًا من submission المختارة.",
      );
    }
    if (observation.severity === finding.auditorSeverity) {
      throw new ReviewWorkflowError("INVALID_DRAFT", "فرق الشدة يجب أن يغير الشدة فعلًا.");
    }
    return {
      id: crypto.randomUUID(),
      findingType: finding.type,
      category: observation.category,
      targetObservationId: observation.id,
      reviewerSeverity: observation.severity,
      auditorSeverity: finding.auditorSeverity,
      startSecond: null,
      endSecond: null,
      summary: finding.summary,
    };
  });
}

async function loadSelectionContext(selectionId: string): Promise<SelectionContextRow> {
  const row = await requireD1()
    .prepare(
      `SELECT
         selection.id AS selectionId,
         selection.selected AS selected,
         selection.submission_id AS submissionId,
         selection.assignment_id AS assignmentId,
         selection.bundle_id AS bundleId,
         selection.version_id AS versionId,
         selection.reviewer_id AS subjectReviewerId,
         subject.independence_group_id AS subjectIndependenceGroupId,
         assignment.state AS assignmentState,
         assignment.revision AS assignmentRevision,
         assignment.submission_id AS currentSubmissionId,
         bundle.status AS bundleStatus,
         bundle.revision AS bundleRevision,
         bundle.current_approval_id AS currentApprovalId,
         version.runtime_seconds AS runtimeSeconds
       FROM review_audit_selections selection
       INNER JOIN review_assignments assignment ON assignment.id = selection.assignment_id
       INNER JOIN review_bundles bundle ON bundle.id = selection.bundle_id
       INNER JOIN title_versions version ON version.id = selection.version_id
       INNER JOIN reviewers subject ON subject.id = selection.reviewer_id
       WHERE selection.id = ?
       LIMIT 1`,
    )
    .bind(selectionId)
    .first<SelectionContextRow>();
  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "قرار التدقيق غير موجود.");
  if (!Number.isInteger(row.assignmentRevision) || row.assignmentRevision < 0) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision المهمة المخزنة غير صالح.");
  }
  if (!Number.isInteger(row.bundleRevision) || row.bundleRevision < 0) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision الحزمة المخزنة غير صالح.");
  }
  if (!Number.isInteger(row.runtimeSeconds) || row.runtimeSeconds <= 0) {
    throw new ReviewWorkflowError("FORBIDDEN", "مدة النسخة المخزنة غير صالحة.");
  }
  return row;
}

function assertCanRecordAuditOutcome(actor: InternalActor): void {
  if (actor.status !== "active") {
    throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");
  }
  if (actor.role !== "editorial_reviewer" || !actor.reviewer || actor.reviewer.status !== "active") {
    throw new ReviewWorkflowError("FORBIDDEN", "تسجيل نتيجة التدقيق يتطلب مدققًا تحريريًا نشطًا.");
  }
}

async function requireInternalActor(sessionEmail: string): Promise<InternalActor> {
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
         r.independence_group_id AS independenceGroupId,
         r.status AS reviewerStatus
       FROM internal_users u
       LEFT JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.auth_email = ?
       LIMIT 1`,
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
  };
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
  if (
    row.reviewerStatus !== "active" &&
    row.reviewerStatus !== "probation" &&
    row.reviewerStatus !== "suspended"
  ) {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة المراجع المخزنة غير معروفة.");
  }
  return {
    id: row.reviewerId,
    independenceGroupId: row.independenceGroupId,
    status: row.reviewerStatus,
  };
}

function assertChanges(
  results: Array<{ meta?: { changes?: number } }>,
  indexes: readonly number[],
): void {
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
