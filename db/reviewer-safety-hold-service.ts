import { env } from "cloudflare:workers";

import {
  INTERNAL_ROLES,
  ReviewWorkflowError,
  type InternalAccountStatus,
  type InternalActor,
  type InternalRole,
} from "@/lib/internal-review-workflow";
import {
  parseManualReviewerSafetyHoldRequest,
  parseReviewerSafetyHoldResolutionRequest,
} from "@/lib/reviewer-safety-hold-management";
import { REVIEWER_SAFETY_HOLD_POLICY_VERSION } from "@/lib/reviewer-safety-hold";
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

interface TargetReviewerRow {
  userId: string;
  userRevision: number;
  accountStatus: string;
  role: string;
  reviewerId: string;
  reviewerStatus: string;
}

interface HoldContextRow extends TargetReviewerRow {
  holdEventId: string;
  holdPayloadJson: string;
}

export async function placeManualReviewerSafetyHold(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  assertAdmin(actor);
  const request = parseManualReviewerSafetyHoldRequest(input.request);
  if (request.targetUserId === actor.userId) {
    throw new ReviewWorkflowError("FORBIDDEN", "لا يمكن للمشرف تعليق نفسه عبر مسار مراجعة المراجعين.");
  }

  const db = requireD1();
  const target = await loadActiveTargetReviewer(request.targetUserId);
  if (target.userRevision !== request.expectedRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision حساب المراجع قديم.");
  }
  await requireEvidenceEvents(request.evidenceEventIds);

  const holdEventId = `safety-hold-manual-${crypto.randomUUID()}`;
  const payload = JSON.stringify({
    source: "manual_collusion_suspicion",
    policyVersion: REVIEWER_SAFETY_HOLD_POLICY_VERSION,
    triggerCodes: ["COLLUSION_SUSPICION"],
    evidence: {
      note: request.note,
      evidenceEventIds: request.evidenceEventIds,
    },
  });
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'reviewer_safety_hold_placed', 'reviewer', r.id, ?, ?
       FROM internal_users u
       INNER JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.id = ?
         AND u.revision = ?
         AND u.status = 'active'
         AND u.role IN ('reviewer', 'editorial_reviewer')
         AND r.status = 'active'`,
    ).bind(
      holdEventId,
      actor.userId,
      payload,
      now,
      target.userId,
      request.expectedRevision,
    ),
  ]);
  assertChanges(results, [0]);

  return {
    holdEventId,
    userId: target.userId,
    reviewerId: target.reviewerId,
    status: "suspended" as const,
    revision: request.expectedRevision + 1,
    source: "manual_collusion_suspicion" as const,
  };
}

export async function resolveReviewerSafetyHold(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  assertAdmin(actor);
  const request = parseReviewerSafetyHoldResolutionRequest(input.request);
  const db = requireD1();
  const context = await db
    .prepare(
      `SELECT
         h.id AS holdEventId,
         h.payload_json AS holdPayloadJson,
         u.id AS userId,
         u.revision AS userRevision,
         u.status AS accountStatus,
         u.role AS role,
         r.id AS reviewerId,
         r.status AS reviewerStatus
       FROM internal_audit_events h
       INNER JOIN reviewers r ON r.id = h.entity_id
       INNER JOIN internal_users u ON u.reviewer_id = r.id
       WHERE h.id = ?
         AND h.event_type = 'reviewer_safety_hold_placed'
         AND h.entity_type = 'reviewer'
       LIMIT 1`,
    )
    .bind(request.holdEventId)
    .first<HoldContextRow>();
  if (!context) throw new ReviewWorkflowError("FORBIDDEN", "تعليق المراجع المطلوب غير موجود.");
  if (context.userRevision !== request.expectedRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision حساب المراجع قديم.");
  }
  if (context.accountStatus !== "suspended" || context.reviewerStatus !== "suspended") {
    throw new ReviewWorkflowError("FORBIDDEN", "حالة المراجع لا تسمح بحسم تعليق أمان حالي.");
  }

  const alreadyResolved = await db
    .prepare(
      `SELECT id FROM internal_audit_events
       WHERE event_type = 'reviewer_safety_hold_resolved'
         AND json_extract(payload_json, '$.holdEventId') = ?
       LIMIT 1`,
    )
    .bind(request.holdEventId)
    .first<{ id: string }>();
  if (alreadyResolved) {
    throw new ReviewWorkflowError("ASSIGNMENT_LOCKED", "تعليق المراجع تم حسمه بالفعل.");
  }

  const resolutionEventId = `safety-resolution-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const results = await db.batch([
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'reviewer_safety_hold_resolved', 'reviewer', r.id, ?, ?
       FROM internal_users u
       INNER JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.id = ?
         AND u.revision = ?
         AND u.status = 'suspended'
         AND r.status = 'suspended'`,
    ).bind(
      resolutionEventId,
      actor.userId,
      JSON.stringify({
        holdEventId: request.holdEventId,
        resolution: request.resolution,
        note: request.note,
      }),
      now,
      context.userId,
      request.expectedRevision,
    ),
  ]);
  assertChanges(results, [0]);

  return {
    resolutionEventId,
    holdEventId: request.holdEventId,
    reviewerId: context.reviewerId,
    resolution: request.resolution,
    nextState: "awaiting_reference_recalibration" as const,
    revision: request.expectedRevision,
  };
}

async function loadActiveTargetReviewer(userId: string): Promise<TargetReviewerRow> {
  const row = await requireD1()
    .prepare(
      `SELECT
         u.id AS userId,
         u.revision AS userRevision,
         u.status AS accountStatus,
         u.role AS role,
         r.id AS reviewerId,
         r.status AS reviewerStatus
       FROM internal_users u
       INNER JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.id = ? AND u.role IN ('reviewer', 'editorial_reviewer')
       LIMIT 1`,
    )
    .bind(userId)
    .first<TargetReviewerRow>();
  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "حساب المراجع المطلوب غير موجود.");
  if (row.accountStatus !== "active" || row.reviewerStatus !== "active") {
    throw new ReviewWorkflowError("FORBIDDEN", "لا يمكن إنشاء تعليق جديد لمراجع غير نشط.");
  }
  return row;
}

async function requireEvidenceEvents(ids: readonly string[]): Promise<void> {
  const db = requireD1();
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT id FROM internal_audit_events WHERE id IN (${placeholders})
       UNION
       SELECT id FROM review_audit_events WHERE id IN (${placeholders})`,
    )
    .bind(...ids, ...ids)
    .all<{ id: string }>();
  const found = new Set((rows.results ?? []).map((row) => row.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "بعض أدلة الاشتباه المشار إليها غير موجودة في سجل التدقيق.",
      missing,
    );
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
  };
}

function assertAdmin(actor: InternalActor): void {
  if (actor.status !== "active") {
    throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");
  }
  if (actor.role !== "admin") {
    throw new ReviewWorkflowError("FORBIDDEN", "إدارة تعليق المراجعين تتطلب Admin نشطًا.");
  }
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

function assertChanges(results: D1Result<unknown>[], indexes: readonly number[]): void {
  for (const index of indexes) {
    if (Number(results[index]?.meta?.changes ?? 0) !== 1) {
      throw new ReviewWorkflowError(
        "REVISION_CONFLICT",
        "تغيرت حالة تعليق المراجع أثناء العملية؛ أعد تحميل البيانات قبل المتابعة.",
      );
    }
  }
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
