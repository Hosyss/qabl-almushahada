import { env } from "cloudflare:workers";

import {
  INTERNAL_ROLES,
  REVIEW_ASSIGNMENT_STATES,
  ReviewWorkflowError,
  type InternalActor,
  type InternalAccountStatus,
  type InternalRole,
  type ReviewAssignmentScope,
  type ReviewAssignmentState,
} from "@/lib/internal-review-workflow";
import {
  prepareEditorialApproval,
  prepareEditorialTransition,
  prepareInternalUserProvisioning,
  prepareInternalUserStatusChange,
  prepareReviewAssignmentCreation,
} from "@/lib/internal-review-management";
import { assessReviewQuality, type EditorialApproval, type ReviewerIdentity } from "@/lib/review-engine";
import { loadReviewBundle } from "./load-review-bundle";

interface ActorRow {
  userId: string;
  authEmail: string;
  role: string;
  accountStatus: string;
  reviewerId: string | null;
  independenceGroupId: string | null;
  reviewerStatus: string | null;
}

interface AssignmentRow {
  id: string;
  bundleId: string;
  versionId: string;
  titleId: string;
  editionLabel: string;
  platform: string;
  language: string;
  releaseYear: number;
  runtimeSeconds: number;
  contentFingerprint: string;
  reviewerId: string;
  reviewerIndependenceGroupId: string;
  reviewerStatus: string;
  state: string;
  revision: number;
  submissionId: string | null;
  bundleRevision: number;
}

interface ReviewerAccountRow {
  userId: string;
  reviewerId: string;
  reviewerStatus: string;
}

interface InternalUserTargetRow {
  id: string;
  reviewerId: string | null;
  revision: number;
}

interface ApprovalLineageRow {
  latestApprovalId: string | null;
  nextRevision: number;
}

export async function bootstrapInitialAdmin(sessionEmail: string) {
  const normalizedEmail = normalizeSessionEmail(sessionEmail);
  const configuredEmail = getBootstrapAdminEmail();
  if (!configuredEmail) {
    throw new ReviewWorkflowError(
      "FORBIDDEN",
      "لم يتم ضبط INTERNAL_BOOTSTRAP_ADMIN_EMAIL في بيئة التشغيل.",
    );
  }
  if (normalizedEmail !== configuredEmail) {
    throw new ReviewWorkflowError("FORBIDDEN", "هذا الحساب غير مصرح له بتهيئة المشرف الأول.");
  }

  const db = requireD1();
  const existing = await db.prepare("SELECT COUNT(*) AS count FROM internal_users").first<{ count: number }>();
  if ((existing?.count ?? 0) !== 0) {
    throw new ReviewWorkflowError("FORBIDDEN", "تمت تهيئة النظام الداخلي بالفعل.");
  }

  const userId = crypto.randomUUID();
  const transitionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(
      `INSERT INTO internal_users
         (id, auth_email, role, reviewer_id, status, revision, last_transition_id, created_at, updated_at)
       SELECT ?, ?, 'admin', NULL, 'active', 0, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM internal_users)`,
    ).bind(userId, normalizedEmail, transitionId, now, now),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, id, 'initial_admin_bootstrapped', 'internal_user', id, ?, ?
       FROM internal_users
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      JSON.stringify({ authEmail: normalizedEmail, role: "admin" }),
      now,
      userId,
      transitionId,
    ),
  ]);
  assertChanges(results, [0, 1]);
  return { userId, authEmail: normalizedEmail, role: "admin" as const, revision: 0 };
}

export async function provisionInternalUser(input: { sessionEmail: string; request: unknown }) {
  const actor = await requireInternalActor(input.sessionEmail);
  const plan = prepareInternalUserProvisioning(actor, input.request);
  const db = requireD1();
  const userId = crypto.randomUUID();
  const reviewerId = plan.reviewerProfile ? crypto.randomUUID() : null;
  const transitionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [];

  if (plan.reviewerProfile && reviewerId) {
    statements.push(
      db.prepare(
        `INSERT INTO reviewers
           (id, display_label, independence_group_id, status, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`,
      ).bind(
        reviewerId,
        plan.reviewerProfile.displayLabel,
        plan.reviewerProfile.independenceGroupId,
        now,
        now,
      ),
    );
  }

  const userInsertIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO internal_users
         (id, auth_email, role, reviewer_id, status, revision, last_transition_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?)`,
    ).bind(userId, plan.authEmail, plan.role, reviewerId, transitionId, now, now),
  );
  const auditIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'internal_user_provisioned', 'internal_user', id, ?, ?
       FROM internal_users
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ authEmail: plan.authEmail, role: plan.role, reviewerId }),
      now,
      userId,
      transitionId,
    ),
  );

  const results = await db.batch(statements);
  assertChanges(results, [userInsertIndex, auditIndex]);
  return { userId, reviewerId, authEmail: plan.authEmail, role: plan.role, revision: 0 };
}

export async function setInternalUserStatus(input: { sessionEmail: string; request: unknown }) {
  const actor = await requireInternalActor(input.sessionEmail);
  const plan = prepareInternalUserStatusChange(actor, input.request);
  const db = requireD1();
  const target = await db
    .prepare("SELECT id, reviewer_id AS reviewerId, revision FROM internal_users WHERE id = ? LIMIT 1")
    .bind(plan.targetUserId)
    .first<InternalUserTargetRow>();
  if (!target) throw new ReviewWorkflowError("FORBIDDEN", "الحساب الداخلي المطلوب غير موجود.");
  if (target.revision !== plan.expectedRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision الحساب قديم؛ أعد تحميل القائمة.");
  }

  const transitionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements = [
    db.prepare(
      `UPDATE internal_users
       SET status = ?, revision = revision + 1, last_transition_id = ?, updated_at = ?
       WHERE id = ? AND revision = ?`,
    ).bind(plan.status, transitionId, now, plan.targetUserId, plan.expectedRevision),
  ];

  if (target.reviewerId) {
    statements.push(
      db.prepare(
        `UPDATE reviewers
         SET status = ?, updated_at = ?
         WHERE id = ?
           AND EXISTS (
             SELECT 1 FROM internal_users
             WHERE id = ? AND last_transition_id = ?
           )`,
      ).bind(plan.status === "suspended" ? "suspended" : "active", now, target.reviewerId, target.id, transitionId),
    );
    if (plan.status === "suspended") {
      statements.push(
        db.prepare(
          `UPDATE review_bundles
           SET status = 'conflicted', revision = revision + 1, updated_at = ?
           WHERE status <> 'withdrawn'
             AND id IN (
               SELECT DISTINCT bundle_id FROM review_submissions WHERE reviewer_id = ?
             )`,
        ).bind(now, target.reviewerId),
      );
    }
  }

  const auditIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'internal_user_status_changed', 'internal_user', id, ?, ?
       FROM internal_users
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ status: plan.status, fromRevision: plan.expectedRevision, toRevision: plan.expectedRevision + 1 }),
      now,
      target.id,
      transitionId,
    ),
  );

  const results = await db.batch(statements);
  assertChanges(results, [0, auditIndex]);
  return { userId: target.id, status: plan.status, revision: plan.expectedRevision + 1 };
}

export async function createReviewAssignment(input: { sessionEmail: string; request: unknown }) {
  const actor = await requireInternalActor(input.sessionEmail);
  const plan = prepareReviewAssignmentCreation(actor, input.request);
  const db = requireD1();
  const reviewerAccount = await db
    .prepare(
      `SELECT u.id AS userId, r.id AS reviewerId, r.status AS reviewerStatus
       FROM internal_users u
       INNER JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.auth_email = ?
         AND u.role = 'reviewer'
         AND u.status = 'active'
       LIMIT 1`,
    )
    .bind(plan.reviewerEmail)
    .first<ReviewerAccountRow>();
  if (!reviewerAccount || reviewerAccount.reviewerStatus !== "active") {
    throw new ReviewWorkflowError("FORBIDDEN", "المراجع المطلوب غير مفعّل كمراجع نشط.");
  }

  const assignmentId = crypto.randomUUID();
  const transitionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(
      `UPDATE review_bundles
       SET status = 'under_review', revision = revision + 1, workflow_transition_id = ?, updated_at = ?
       WHERE id = ?
         AND revision = ?
         AND status IN ('draft', 'under_review', 'conflicted')`,
    ).bind(transitionId, now, plan.bundleId, plan.expectedBundleRevision),
    db.prepare(
      `INSERT INTO review_assignments
         (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision,
          last_transition_id, assigned_at, created_at, updated_at)
       SELECT ?, id, version_id, ?, ?, 'assigned', 0, ?, ?, ?, ?
       FROM review_bundles
       WHERE id = ? AND workflow_transition_id = ?`,
    ).bind(
      assignmentId,
      reviewerAccount.reviewerId,
      actor.userId,
      transitionId,
      now,
      now,
      now,
      plan.bundleId,
      transitionId,
    ),
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, bundle_id, ?, 'review_assignment_created', 'review_assignment', id, ?, ?
       FROM review_assignments
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({ reviewerUserId: reviewerAccount.userId, reviewerId: reviewerAccount.reviewerId }),
      now,
      assignmentId,
      transitionId,
    ),
  ]);
  assertChanges(results, [0, 1, 2]);
  return {
    assignmentId,
    bundleId: plan.bundleId,
    reviewerEmail: plan.reviewerEmail,
    state: "assigned" as const,
    revision: 0,
    bundleRevision: plan.expectedBundleRevision + 1,
  };
}

export async function requestReviewChanges(input: { sessionEmail: string; request: unknown }) {
  return transitionAssignmentEditorially(input, "changes_requested", ["submitted", "conflicted"]);
}

export async function flagReviewConflict(input: { sessionEmail: string; request: unknown }) {
  return transitionAssignmentEditorially(input, "conflicted", ["submitted"]);
}

export async function approveReviewBundleEditorially(input: { sessionEmail: string; request: unknown }) {
  const actor = await requireInternalActor(input.sessionEmail);
  const raw = requireObject(input.request);
  const bundleId = requireString(raw.bundleId, "bundleId");
  const assignmentRows = await loadAssignmentsForBundle(bundleId);
  const submittedRows = assignmentRows.filter((row) => row.state === "submitted");
  if (submittedRows.length !== assignmentRows.length || submittedRows.length === 0) {
    throw new ReviewWorkflowError(
      "ASSIGNMENT_LOCKED",
      "يجب أن تكون كل مهام الحزمة مرسلة ومقفلة قبل الاعتماد.",
    );
  }
  const scopes = submittedRows.map(toScope);
  const plan = prepareEditorialApproval(actor, scopes, input.request);

  const loaded = await loadReviewBundle(bundleId);
  if (!loaded) throw new ReviewWorkflowError("FORBIDDEN", "حزمة المراجعة غير موجودة.");
  if (loaded.revision !== plan.expectedBundleRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision الحزمة قديم؛ أعد تحميلها.");
  }
  if (!actor.reviewer) throw new ReviewWorkflowError("FORBIDDEN", "هوية المعتمد غير موجودة.");

  const submissionIds = submittedRows.map((row) => {
    if (!row.submissionId) {
      throw new ReviewWorkflowError("INVALID_DRAFT", "مهمة submitted بلا submission مرتبط.");
    }
    return row.submissionId;
  });
  const now = new Date().toISOString();
  const candidateApproval: EditorialApproval = {
    status: "approved",
    approverId: actor.reviewer.id,
    approverIndependenceGroupId: actor.reviewer.independenceGroupId,
    approverStatus: actor.reviewer.status,
    approvedAt: now,
    versionFingerprintConfirmed: true,
    reviewedSubmissionIds: submissionIds,
    spotChecks: plan.spotChecks,
  };
  const candidate = structuredClone(loaded.bundle);
  candidate.editorialApproval = candidateApproval;
  const quality = assessReviewQuality(candidate);
  if (!quality.publishable) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "بوابات الجودة لا تسمح بالاعتماد التحريري.",
      quality.issues.map((issue) => issue.code),
    );
  }

  const db = requireD1();
  const lineage = await db
    .prepare(
      `SELECT
         (
           SELECT id FROM editorial_approvals
           WHERE bundle_id = ?
           ORDER BY revision DESC, created_at DESC, id DESC
           LIMIT 1
         ) AS latestApprovalId,
         COALESCE((SELECT MAX(revision) FROM editorial_approvals WHERE bundle_id = ?), 0) + 1 AS nextRevision`,
    )
    .bind(bundleId, bundleId)
    .first<ApprovalLineageRow>();
  const approvalRevision = lineage?.nextRevision;
  if (!Number.isInteger(approvalRevision) || approvalRevision < 1) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "تعذر تحديد revision الاعتماد التالي بأمان.");
  }
  const supersedesApprovalId = lineage?.latestApprovalId ?? null;

  const transitionId = crypto.randomUUID();
  const approvalId = crypto.randomUUID();
  const assignmentPredicate = plan.assignments.map(() => "(id = ? AND revision = ? AND state = 'submitted')").join(" OR ");
  const assignmentBinds = plan.assignments.flatMap((item) => [item.assignmentId, item.expectedRevision]);
  const statements = [
    db.prepare(
      `UPDATE review_bundles
       SET revision = revision + 1, workflow_transition_id = ?, updated_at = ?
       WHERE id = ?
         AND revision = ?
         AND status IN ('draft', 'under_review', 'conflicted')
         AND (SELECT COUNT(*) FROM review_assignments WHERE bundle_id = ? AND (${assignmentPredicate})) = ?
         AND (SELECT COUNT(*) FROM review_assignments WHERE bundle_id = ? AND state = 'submitted') = ?`,
    ).bind(
      transitionId,
      now,
      bundleId,
      plan.expectedBundleRevision,
      bundleId,
      ...assignmentBinds,
      plan.assignments.length,
      bundleId,
      plan.assignments.length,
    ),
    db.prepare(
      `INSERT INTO editorial_approvals
         (id, bundle_id, approver_id, status, revision, supersedes_approval_id,
          version_fingerprint_confirmed, notes, approved_at, created_at)
       SELECT ?, id, ?, 'approved', ?, ?, 1, ?, ?, ?
       FROM review_bundles
       WHERE id = ? AND workflow_transition_id = ?`,
    ).bind(
      approvalId,
      actor.reviewer.id,
      approvalRevision,
      supersedesApprovalId,
      plan.notes,
      now,
      now,
      bundleId,
      transitionId,
    ),
  ];

  const currentApprovalPointerIndex = statements.length;
  statements.push(
    db.prepare(
      `UPDATE review_bundles
       SET current_approval_id = ?
       WHERE id = ?
         AND workflow_transition_id = ?
         AND EXISTS (
           SELECT 1 FROM editorial_approvals
           WHERE id = ? AND bundle_id = ? AND revision = ?
         )`,
    ).bind(approvalId, bundleId, transitionId, approvalId, bundleId, approvalRevision),
  );

  const assignmentStartIndex = statements.length;
  for (const row of submittedRows) {
    const expectedRevision = plan.assignments.find((item) => item.assignmentId === row.id)!.expectedRevision;
    statements.push(
      db.prepare(
        `UPDATE review_assignments
         SET state = 'approved', revision = revision + 1, last_transition_id = ?, updated_at = ?
         WHERE id = ? AND revision = ? AND state = 'submitted'
           AND EXISTS (
             SELECT 1 FROM review_bundles WHERE id = ? AND workflow_transition_id = ?
           )`,
      ).bind(transitionId, now, row.id, expectedRevision, bundleId, transitionId),
    );
  }
  for (const submissionId of submissionIds) {
    statements.push(
      db.prepare(
        `INSERT INTO editorial_approval_submissions (approval_id, submission_id)
         SELECT ?, ? FROM review_bundles WHERE id = ? AND workflow_transition_id = ?`,
      ).bind(approvalId, submissionId, bundleId, transitionId),
    );
  }
  for (const spotCheck of plan.spotChecks) {
    statements.push(
      db.prepare(
        `INSERT INTO editorial_spot_checks
           (approval_id, observation_id, result, notes, checked_at)
         SELECT ?, ?, ?, '', ? FROM review_bundles WHERE id = ? AND workflow_transition_id = ?`,
      ).bind(approvalId, spotCheck.observationId, spotCheck.result, now, bundleId, transitionId),
    );
  }
  const auditIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, id, ?, 'editorial_approval_revision_created', 'editorial_approval', ?, ?, ?
       FROM review_bundles
       WHERE id = ? AND workflow_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      approvalId,
      JSON.stringify({
        approvalId,
        approvalRevision,
        supersedesApprovalId,
        submissionIds,
        qualityStatus: quality.status,
      }),
      now,
      bundleId,
      transitionId,
    ),
  );

  const results = await db.batch(statements);
  const requiredIndexes = [0, 1, currentApprovalPointerIndex, auditIndex];
  for (let index = 0; index < submittedRows.length; index += 1) {
    requiredIndexes.push(assignmentStartIndex + index);
  }
  assertChanges(results, requiredIndexes);
  return {
    bundleId,
    approvalId,
    approvalRevision,
    supersedesApprovalId,
    bundleRevision: plan.expectedBundleRevision + 1,
    approvedAssignmentIds: submittedRows.map((row) => row.id),
    quality,
  };
}

async function transitionAssignmentEditorially(
  input: { sessionEmail: string; request: unknown },
  nextState: "changes_requested" | "conflicted",
  allowedStates: readonly ReviewAssignmentState[],
) {
  const actor = await requireInternalActor(input.sessionEmail);
  const raw = requireObject(input.request);
  const assignmentId = requireString(raw.assignmentId, "assignmentId");
  const row = await loadAssignment(assignmentId);
  const scope = toScope(row);
  const plan = prepareEditorialTransition(actor, scope, input.request, allowedStates);
  if (row.bundleRevision !== plan.expectedBundleRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision الحزمة قديم؛ أعد تحميلها.");
  }

  const transitionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const bundleStatus = nextState === "conflicted" ? "conflicted" : "under_review";
  const db = requireD1();
  const allowedSql = allowedStates.map(() => "?").join(", ");
  const results = await db.batch([
    db.prepare(
      `UPDATE review_assignments
       SET state = ?, revision = revision + 1, last_transition_id = ?, updated_at = ?
       WHERE id = ?
         AND revision = ?
         AND state IN (${allowedSql})
         AND EXISTS (
           SELECT 1 FROM review_bundles WHERE id = ? AND revision = ?
         )`,
    ).bind(
      nextState,
      transitionId,
      now,
      plan.assignmentId,
      plan.expectedAssignmentRevision,
      ...allowedStates,
      row.bundleId,
      plan.expectedBundleRevision,
    ),
    db.prepare(
      `UPDATE review_bundles
       SET status = ?, revision = revision + 1, workflow_transition_id = ?, updated_at = ?
       WHERE id = ? AND revision = ?
         AND EXISTS (
           SELECT 1 FROM review_assignments WHERE id = ? AND last_transition_id = ?
         )`,
    ).bind(
      bundleStatus,
      transitionId,
      now,
      row.bundleId,
      plan.expectedBundleRevision,
      row.id,
      transitionId,
    ),
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, bundle_id, ?, ?, 'review_assignment', id, ?, ?
       FROM review_assignments
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      nextState === "conflicted" ? "review_assignment_conflicted" : "review_changes_requested",
      JSON.stringify({ note: plan.note, fromRevision: plan.expectedAssignmentRevision, toRevision: plan.expectedAssignmentRevision + 1 }),
      now,
      row.id,
      transitionId,
    ),
  ]);
  assertChanges(results, [0, 1, 2]);
  return {
    assignmentId: row.id,
    state: nextState,
    assignmentRevision: plan.expectedAssignmentRevision + 1,
    bundleRevision: plan.expectedBundleRevision + 1,
  };
}

async function requireInternalActor(sessionEmail: string): Promise<InternalActor> {
  const normalizedEmail = normalizeSessionEmail(sessionEmail);
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
  const role = parseRole(row.role);
  const status = parseAccountStatus(row.accountStatus);
  const reviewer = parseOptionalReviewer(row);
  if ((role === "reviewer" || role === "editorial_reviewer") && !reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "الحساب الداخلي غير مربوط بهوية مراجع.");
  }
  return { userId: row.userId, email: row.authEmail, role, status, reviewer };
}

async function loadAssignment(assignmentId: string): Promise<AssignmentRow> {
  const row = await requireD1()
    .prepare(
      `SELECT
         a.id AS id,
         a.bundle_id AS bundleId,
         a.version_id AS versionId,
         v.title_id AS titleId,
         v.edition_label AS editionLabel,
         v.platform AS platform,
         v.language AS language,
         t.release_year AS releaseYear,
         v.runtime_seconds AS runtimeSeconds,
         v.content_fingerprint AS contentFingerprint,
         a.reviewer_id AS reviewerId,
         r.independence_group_id AS reviewerIndependenceGroupId,
         r.status AS reviewerStatus,
         a.state AS state,
         a.revision AS revision,
         a.submission_id AS submissionId,
         b.revision AS bundleRevision
       FROM review_assignments a
       INNER JOIN review_bundles b ON b.id = a.bundle_id AND b.version_id = a.version_id
       INNER JOIN title_versions v ON v.id = a.version_id
       INNER JOIN titles t ON t.id = v.title_id
       INNER JOIN reviewers r ON r.id = a.reviewer_id
       WHERE a.id = ?
       LIMIT 1`,
    )
    .bind(assignmentId)
    .first<AssignmentRow>();
  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "مهمة المراجعة غير موجودة.");
  validateAssignmentRow(row);
  return row;
}

async function loadAssignmentsForBundle(bundleId: string): Promise<AssignmentRow[]> {
  const rows = await requireD1()
    .prepare(
      `SELECT
         a.id AS id,
         a.bundle_id AS bundleId,
         a.version_id AS versionId,
         v.title_id AS titleId,
         v.edition_label AS editionLabel,
         v.platform AS platform,
         v.language AS language,
         t.release_year AS releaseYear,
         v.runtime_seconds AS runtimeSeconds,
         v.content_fingerprint AS contentFingerprint,
         a.reviewer_id AS reviewerId,
         r.independence_group_id AS reviewerIndependenceGroupId,
         r.status AS reviewerStatus,
         a.state AS state,
         a.revision AS revision,
         a.submission_id AS submissionId,
         b.revision AS bundleRevision
       FROM review_assignments a
       INNER JOIN review_bundles b ON b.id = a.bundle_id AND b.version_id = a.version_id
       INNER JOIN title_versions v ON v.id = a.version_id
       INNER JOIN titles t ON t.id = v.title_id
       INNER JOIN reviewers r ON r.id = a.reviewer_id
       WHERE a.bundle_id = ?
       ORDER BY a.created_at ASC`,
    )
    .bind(bundleId)
    .all<AssignmentRow>();
  const results = rows.results ?? [];
  for (const row of results) validateAssignmentRow(row);
  return results;
}

function toScope(row: AssignmentRow): ReviewAssignmentScope {
  return {
    id: row.id,
    bundleId: row.bundleId,
    version: {
      id: row.versionId,
      titleId: row.titleId,
      editionLabel: row.editionLabel,
      platform: row.platform,
      language: row.language,
      releaseYear: row.releaseYear,
      runtimeSeconds: row.runtimeSeconds,
      contentFingerprint: row.contentFingerprint,
    },
    reviewer: parseReviewer(row),
    state: parseAssignmentState(row.state),
    revision: row.revision,
  };
}

function validateAssignmentRow(row: AssignmentRow): void {
  parseReviewer(row);
  parseAssignmentState(row.state);
  if (!Number.isInteger(row.revision) || row.revision < 0 || !Number.isInteger(row.bundleRevision) || row.bundleRevision < 0) {
    throw new ReviewWorkflowError("FORBIDDEN", "revision مخزن غير صالح.");
  }
}

function parseReviewer(row: Pick<AssignmentRow, "reviewerId" | "reviewerIndependenceGroupId" | "reviewerStatus">): ReviewerIdentity {
  if (row.reviewerStatus !== "active" && row.reviewerStatus !== "probation" && row.reviewerStatus !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة المراجع المخزنة غير معروفة.");
  }
  return {
    id: row.reviewerId,
    independenceGroupId: row.reviewerIndependenceGroupId,
    status: row.reviewerStatus,
  };
}

function parseOptionalReviewer(row: ActorRow): ReviewerIdentity | null {
  if (!row.reviewerId || !row.independenceGroupId || !row.reviewerStatus) return null;
  return parseReviewer({
    reviewerId: row.reviewerId,
    reviewerIndependenceGroupId: row.independenceGroupId,
    reviewerStatus: row.reviewerStatus,
  });
}

function parseRole(value: string): InternalRole {
  if ((INTERNAL_ROLES as readonly string[]).includes(value)) return value as InternalRole;
  throw new ReviewWorkflowError("FORBIDDEN", "دور داخلي مخزن غير معروف.");
}

function parseAccountStatus(value: string): InternalAccountStatus {
  if (value === "active" || value === "suspended") return value;
  throw new ReviewWorkflowError("FORBIDDEN", "حالة الحساب الداخلي غير معروفة.");
}

function parseAssignmentState(value: string): ReviewAssignmentState {
  if ((REVIEW_ASSIGNMENT_STATES as readonly string[]).includes(value)) return value as ReviewAssignmentState;
  throw new ReviewWorkflowError("FORBIDDEN", "حالة مهمة مخزنة غير معروفة.");
}

function normalizeSessionEmail(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  return normalized;
}

function getBootstrapAdminEmail(): string | null {
  const value = (env as unknown as Record<string, unknown>).INTERNAL_BOOTSTRAP_ADMIN_EMAIL;
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().toLowerCase();
}

function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "الطلب غير صالح.");
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} مطلوب.`);
  }
  return value.trim();
}

function assertChanges(results: Array<{ meta?: { changes?: number } }>, indexes: readonly number[]): void {
  for (const index of indexes) {
    if ((results[index]?.meta?.changes ?? 0) !== 1) {
      throw new ReviewWorkflowError(
        "REVISION_CONFLICT",
        "تعارض تعديل متزامن أو فشل قيد أمني؛ أعد تحميل البيانات قبل المحاولة.",
      );
    }
  }
}

function requireD1() {
  if (!env.DB) throw new Error("D1 binding `DB` is unavailable.");
  return env.DB;
}
