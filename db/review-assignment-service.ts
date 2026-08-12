import { env } from "cloudflare:workers";

import {
  INTERNAL_ROLES,
  REVIEW_ASSIGNMENT_STATES,
  ReviewWorkflowError,
  assertCanEditOwnDraft,
  prepareLockedReviewSubmission,
  sanitizeReviewDraftForStorage,
  type InternalActor,
  type InternalAccountStatus,
  type InternalRole,
  type ReviewAssignmentScope,
  type ReviewAssignmentState,
} from "@/lib/internal-review-workflow";
import { planPostSubmissionAudit } from "@/lib/review-audit-selection";
import type { ReviewerIdentity } from "@/lib/review-engine";

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
  draftPayloadJson: string | null;
}

export async function saveOwnReviewDraft(input: {
  sessionEmail: string;
  assignmentId: string;
  expectedRevision: number;
  draft: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  const loaded = await requireAssignment(input.assignmentId);
  assertCanEditOwnDraft(actor, loaded.scope, input.expectedRevision);

  const sanitized = sanitizeReviewDraftForStorage(input.draft);
  const payloadJson = JSON.stringify(sanitized);
  const now = new Date().toISOString();
  const transitionId = crypto.randomUUID();
  const db = requireD1();
  const results = await db.batch([
    db.prepare(
      `UPDATE review_assignments
       SET state = 'in_progress',
           revision = revision + 1,
           started_at = COALESCE(started_at, ?),
           updated_at = ?,
           last_transition_id = ?
       WHERE id = ?
         AND reviewer_id = ?
         AND revision = ?
         AND state IN ('assigned', 'in_progress', 'changes_requested')`,
    ).bind(now, now, transitionId, loaded.scope.id, actor.reviewer!.id, input.expectedRevision),
    db.prepare(
      `INSERT INTO review_assignment_drafts
         (assignment_id, payload_json, updated_by_user_id, updated_at)
       SELECT id, ?, ?, ?
       FROM review_assignments
       WHERE id = ? AND last_transition_id = ?
       ON CONFLICT(assignment_id) DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = excluded.updated_at`,
    ).bind(payloadJson, actor.userId, now, loaded.scope.id, transitionId),
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, bundle_id, ?, 'review_draft_saved', 'review_assignment', id, ?, ?
       FROM review_assignments
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      JSON.stringify({
        assignmentId: loaded.scope.id,
        fromRevision: input.expectedRevision,
        toRevision: input.expectedRevision + 1,
      }),
      now,
      loaded.scope.id,
      transitionId,
    ),
  ]);

  assertAtomicTransition(results, 0, 2);
  return {
    assignmentId: loaded.scope.id,
    state: "in_progress" as const,
    revision: input.expectedRevision + 1,
  };
}

export async function submitOwnReviewAssignment(input: {
  sessionEmail: string;
  assignmentId: string;
  expectedRevision: number;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  const loaded = await requireAssignment(input.assignmentId);
  assertCanEditOwnDraft(actor, loaded.scope, input.expectedRevision);

  if (!loaded.draft) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "لا توجد مسودة محفوظة لإرسالها.");
  }

  const submissionId = crypto.randomUUID();
  const supersedesSubmissionId = loaded.submissionId;
  const submissionRevision = await getNextSubmissionRevision(loaded.scope.id);
  const prepared = prepareLockedReviewSubmission({
    actor,
    assignment: loaded.scope,
    expectedRevision: input.expectedRevision,
    draft: loaded.draft,
    submissionId,
  });
  const submission = {
    ...prepared,
    observations: prepared.observations.map((observation) => ({
      ...observation,
      id: crypto.randomUUID(),
    })),
  };

  // The draw happens only after the final submission payload is validated and
  // frozen in memory. It is never supplied by or returned to the reviewer.
  const randomWords = new Uint32Array(1);
  crypto.getRandomValues(randomWords);
  const auditSelection = planPostSubmissionAudit(submission, randomWords[0]!);
  const auditSelectionId = crypto.randomUUID();

  const db = requireD1();
  const now = new Date().toISOString();
  const transitionId = crypto.randomUUID();
  const statements = [
    db.prepare(
      `UPDATE review_assignments
       SET state = 'submitted',
           revision = revision + 1,
           submission_id = ?,
           submitted_at = ?,
           updated_at = ?,
           last_transition_id = ?
       WHERE id = ?
         AND reviewer_id = ?
         AND revision = ?
         AND state = 'in_progress'`,
    ).bind(
      submission.id,
      now,
      now,
      transitionId,
      loaded.scope.id,
      actor.reviewer!.id,
      input.expectedRevision,
    ),
    db.prepare(
      `INSERT INTO review_submissions
         (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
          supersedes_submission_id, started_at, completed_at, watched_seconds,
          declared_complete, created_at, updated_at)
       SELECT ?, bundle_id, version_id, reviewer_id, id, ?, ?, ?, ?, ?, 1, ?, ?
       FROM review_assignments
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      submission.id,
      submissionRevision,
      supersedesSubmissionId,
      submission.startedAt,
      submission.completedAt,
      submission.watchedSeconds,
      now,
      now,
      loaded.scope.id,
      transitionId,
    ),
  ];

  for (const [category, result] of Object.entries(submission.categoryChecks)) {
    statements.push(
      db.prepare(
        `INSERT INTO review_category_checks (submission_id, category, result, checked_at)
         SELECT ?, ?, ?, ?
         FROM review_assignments
         WHERE id = ? AND last_transition_id = ?`,
      ).bind(submission.id, category, result, now, loaded.scope.id, transitionId),
    );
  }

  for (const observation of submission.observations) {
    statements.push(
      db.prepare(
        `INSERT INTO observations
           (id, submission_id, category, severity, start_second, end_second,
            frequency, context, spoiler_level, summary, created_at, updated_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         FROM review_assignments
         WHERE id = ? AND last_transition_id = ?`,
      ).bind(
        observation.id,
        submission.id,
        observation.category,
        observation.severity,
        observation.startSecond,
        observation.endSecond,
        observation.frequency,
        observation.context,
        observation.spoilerLevel,
        observation.summary,
        now,
        now,
        loaded.scope.id,
        transitionId,
      ),
    );
    for (const flag of observation.flags) {
      statements.push(
        db.prepare(
          `INSERT INTO observation_flags (observation_id, flag)
           SELECT ?, ?
           FROM review_assignments
           WHERE id = ? AND last_transition_id = ?`,
        ).bind(observation.id, flag, loaded.scope.id, transitionId),
      );
    }
  }

  const auditSelectionIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO review_audit_selections
         (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
          risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json, created_at)
       SELECT ?, s.id, s.assignment_id, s.bundle_id, s.version_id, s.reviewer_id,
              ?, ?, ?, ?, ?, ?
       FROM review_submissions s
       INNER JOIN review_assignments a ON a.id = s.assignment_id
       WHERE s.id = ?
         AND a.id = ?
         AND a.last_transition_id = ?
         AND a.state = 'submitted'
         AND a.submission_id = s.id`,
    ).bind(
      auditSelectionId,
      auditSelection.riskTier,
      auditSelection.sampleRateBps,
      auditSelection.drawU32,
      auditSelection.selected ? 1 : 0,
      JSON.stringify(auditSelection.riskTriggerCodes),
      now,
      submission.id,
      loaded.scope.id,
      transitionId,
    ),
  );

  const auditIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, bundle_id, ?, 'review_submission_revision_created', 'review_submission', ?, ?, ?
       FROM review_assignments
       WHERE id = ? AND last_transition_id = ?`,
    ).bind(
      crypto.randomUUID(),
      actor.userId,
      submission.id,
      JSON.stringify({
        assignmentId: loaded.scope.id,
        assignmentFromRevision: input.expectedRevision,
        assignmentToRevision: input.expectedRevision + 1,
        submissionRevision,
        supersedesSubmissionId,
        submission,
      }),
      now,
      loaded.scope.id,
      transitionId,
    ),
  );

  const results = await db.batch(statements);
  assertAtomicTransition(results, 0, auditIndex);
  if ((results[auditSelectionIndex]?.meta?.changes ?? 0) !== 1) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "تعذر تسجيل قرار التدقيق العشوائي ذريًا مع الإرسال؛ أعد تحميل المهمة.",
    );
  }

  return {
    assignmentId: loaded.scope.id,
    submissionId: submission.id,
    submissionRevision,
    supersedesSubmissionId,
    state: "submitted" as const,
    revision: input.expectedRevision + 1,
  };
}

async function getNextSubmissionRevision(assignmentId: string): Promise<number> {
  const row = await requireD1()
    .prepare(
      `SELECT COALESCE(MAX(revision), 0) + 1 AS nextRevision
       FROM review_submissions
       WHERE assignment_id = ?`,
    )
    .bind(assignmentId)
    .first<{ nextRevision: number }>();
  const nextRevision = row?.nextRevision;
  if (!Number.isInteger(nextRevision) || nextRevision < 1) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "تعذر تحديد revision المراجعة التالية بأمان.");
  }
  return nextRevision;
}

async function requireInternalActor(sessionEmail: string): Promise<InternalActor> {
  const normalizedEmail = sessionEmail.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  }

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

  if (!row) {
    throw new ReviewWorkflowError("FORBIDDEN", "الحساب غير مضاف إلى النظام الداخلي.");
  }

  const role = parseRole(row.role);
  const accountStatus = parseAccountStatus(row.accountStatus);
  const reviewer = parseOptionalReviewer(row);
  if ((role === "reviewer" || role === "editorial_reviewer") && !reviewer) {
    throw new ReviewWorkflowError("FORBIDDEN", "الحساب الداخلي غير مربوط بهوية مراجع.");
  }

  return {
    userId: row.userId,
    email: row.authEmail,
    role,
    status: accountStatus,
    reviewer,
  };
}

async function requireAssignment(assignmentId: string): Promise<{
  scope: ReviewAssignmentScope;
  submissionId: string | null;
  draft: unknown | null;
}> {
  const normalizedId = assignmentId.trim();
  if (!normalizedId) {
    throw new ReviewWorkflowError("FORBIDDEN", "معرّف المهمة غير صالح.");
  }

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
         d.payload_json AS draftPayloadJson
       FROM review_assignments a
       INNER JOIN review_bundles b ON b.id = a.bundle_id AND b.version_id = a.version_id
       INNER JOIN title_versions v ON v.id = a.version_id
       INNER JOIN titles t ON t.id = v.title_id
       INNER JOIN reviewers r ON r.id = a.reviewer_id
       LEFT JOIN review_assignment_drafts d ON d.assignment_id = a.id
       WHERE a.id = ?
       LIMIT 1`,
    )
    .bind(normalizedId)
    .first<AssignmentRow>();

  if (!row) {
    throw new ReviewWorkflowError("FORBIDDEN", "المهمة غير موجودة أو غير صالحة.");
  }

  const reviewer = parseReviewer({
    reviewerId: row.reviewerId,
    independenceGroupId: row.reviewerIndependenceGroupId,
    reviewerStatus: row.reviewerStatus,
  });
  const state = parseAssignmentState(row.state);
  if (!Number.isInteger(row.revision) || row.revision < 0) {
    throw new ReviewWorkflowError("FORBIDDEN", "revision مخزن غير صالح.");
  }

  let draft: unknown | null = null;
  if (row.draftPayloadJson !== null) {
    try {
      draft = JSON.parse(row.draftPayloadJson) as unknown;
    } catch {
      throw new ReviewWorkflowError("INVALID_DRAFT", "المسودة المخزنة تالفة.");
    }
  }

  return {
    scope: {
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
      reviewer,
      state,
      revision: row.revision,
    },
    submissionId: row.submissionId,
    draft,
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

function parseAssignmentState(value: string): ReviewAssignmentState {
  if ((REVIEW_ASSIGNMENT_STATES as readonly string[]).includes(value)) {
    return value as ReviewAssignmentState;
  }
  throw new ReviewWorkflowError("FORBIDDEN", "حالة مهمة مخزنة غير معروفة.");
}

function parseOptionalReviewer(row: ActorRow): ReviewerIdentity | null {
  if (!row.reviewerId || !row.independenceGroupId || !row.reviewerStatus) return null;
  return parseReviewer({
    reviewerId: row.reviewerId,
    independenceGroupId: row.independenceGroupId,
    reviewerStatus: row.reviewerStatus,
  });
}

function parseReviewer(input: {
  reviewerId: string;
  independenceGroupId: string;
  reviewerStatus: string;
}): ReviewerIdentity {
  if (
    input.reviewerStatus !== "active" &&
    input.reviewerStatus !== "probation" &&
    input.reviewerStatus !== "suspended"
  ) {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة المراجع المخزنة غير معروفة.");
  }
  return {
    id: input.reviewerId,
    independenceGroupId: input.independenceGroupId,
    status: input.reviewerStatus,
  };
}

function assertAtomicTransition(
  results: Array<{ meta?: { changes?: number } }>,
  updateIndex: number,
  auditIndex: number,
): void {
  const updateChanges = results[updateIndex]?.meta?.changes ?? 0;
  const auditChanges = results[auditIndex]?.meta?.changes ?? 0;
  if (updateChanges !== 1 || auditChanges !== 1) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "تعارض تعديل متزامن؛ أعد تحميل المهمة قبل المحاولة مرة أخرى.",
    );
  }
}

function requireD1() {
  if (!env.DB) throw new Error("D1 binding `DB` is unavailable.");
  return env.DB;
}
