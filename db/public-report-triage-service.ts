import { env } from "cloudflare:workers";

import { ReviewWorkflowError } from "@/lib/internal-review-workflow";
import { prepareReportOpening } from "@/lib/review-engine";

interface TriageActorRow {
  userId: string;
  role: string;
  accountStatus: string;
  reviewerId: string | null;
  reviewerStatus: string | null;
}

interface IntakeRow {
  id: string;
  targetKind: string;
  targetPublicId: string;
  targetRevision: number;
  targetSnapshotRef: string;
  targetVersionId: string | null;
  reportReason: string;
  message: string;
  status: string;
  revision: number;
  createdAt: string;
}

export interface PublicReportQueueItem {
  id: string;
  targetKind: "human_review" | "evidence_publication" | "editorial_publication";
  targetPublicId: string;
  targetRevision: number;
  reportReason: string;
  message: string;
  status: "received" | "dismissed" | "promoted";
  revision: number;
  createdAt: string;
}

export async function listPublicReportIntakes(input: {
  sessionEmail: string;
  limit?: number;
}): Promise<PublicReportQueueItem[]> {
  await requireEditorialTriageActor(input.sessionEmail);
  const limit = Math.min(100, Math.max(1, Number.isInteger(input.limit) ? input.limit! : 50));
  const result = await requireD1()
    .prepare(
      `SELECT id,
              target_kind AS targetKind,
              target_public_id AS targetPublicId,
              target_revision AS targetRevision,
              report_reason AS reportReason,
              message,
              status,
              revision,
              created_at AS createdAt
       FROM public_report_intakes
       ORDER BY CASE status WHEN 'received' THEN 0 ELSE 1 END, created_at ASC, id ASC
       LIMIT ?`,
    )
    .bind(limit)
    .all<PublicReportQueueItem>();
  return result.results ?? [];
}

export async function dismissPublicReportIntake(input: {
  sessionEmail: string;
  intakeId: string;
  expectedRevision: number;
  note: string;
}) {
  const actor = await requireEditorialTriageActor(input.sessionEmail);
  const intakeId = normalizeId(input.intakeId);
  const note = normalizeNote(input.note);
  const expectedRevision = normalizeRevision(input.expectedRevision);
  const now = new Date().toISOString();
  const auditId = crypto.randomUUID();
  const db = requireD1();
  const results = await db.batch([
    db.prepare(
      `UPDATE public_report_intakes
       SET status = 'dismissed',
           triaged_by_user_id = ?,
           triage_note = ?,
           triaged_at = ?,
           revision = revision + 1
       WHERE id = ?
         AND revision = ?
         AND status = 'received'`,
    ).bind(actor.userId, note, now, intakeId, expectedRevision),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'public_report_intake_dismissed', 'public_report_intake', i.id,
              json_object('targetKind', i.target_kind, 'targetPublicId', i.target_public_id,
                          'reportReason', i.report_reason, 'revision', i.revision), ?
       FROM public_report_intakes i
       WHERE i.id = ?
         AND i.status = 'dismissed'
         AND i.revision = ?`,
    ).bind(auditId, actor.userId, now, intakeId, expectedRevision + 1),
  ]);
  assertExactChanges(results, 2);
  return { intakeId, status: "dismissed" as const, revision: expectedRevision + 1 };
}

export async function promotePublicReportIntake(input: {
  sessionEmail: string;
  intakeId: string;
  expectedRevision: number;
  materialReportType: string;
  note: string;
}) {
  const actor = await requireEditorialTriageActor(input.sessionEmail);
  const intakeId = normalizeId(input.intakeId);
  const expectedRevision = normalizeRevision(input.expectedRevision);
  const note = normalizeNote(input.note);
  const intake = await loadReceivedIntake(intakeId, expectedRevision);
  if (intake.targetKind !== "human_review" || !intake.targetVersionId) {
    throw new ReviewWorkflowError(
      "FORBIDDEN",
      "التصعيد التلقائي متاح فقط للمراجعة البشرية ذات دورة التصحيح المكتملة.",
    );
  }

  const reportPlan = prepareReportOpening({
    bundleId: intake.targetPublicId,
    revision: intake.targetRevision,
    reportType: input.materialReportType,
    message: intake.message,
  });
  if (!reportPlan.allowed) {
    throw new ReviewWorkflowError("INVALID_DRAFT", reportPlan.errorsAr.join(" "));
  }

  const db = requireD1();
  const reportId = crypto.randomUUID();
  const reportAuditId = crypto.randomUUID();
  const internalAuditId = crypto.randomUUID();
  const now = new Date().toISOString();

  const results = await db.batch([
    db.prepare(
      `INSERT INTO review_reports
         (id, bundle_id, version_id, invalidated_approval_id,
          previous_bundle_status, previous_bundle_revision,
          report_type, message, status, revision, created_at)
       SELECT ?, b.id, b.version_id, b.current_approval_id,
              b.status, b.revision, ?, i.message, 'open', 0, ?
       FROM public_report_intakes i
       INNER JOIN review_bundles b ON b.id = i.target_public_id
       WHERE i.id = ?
         AND i.revision = ?
         AND i.status = 'received'
         AND i.target_kind = 'human_review'
         AND b.id = ?
         AND b.version_id = i.target_version_id
         AND b.revision = i.target_revision
         AND b.status = 'verified'
         AND b.current_approval_id = i.target_snapshot_ref
         AND b.current_approval_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM review_reports active_report
           WHERE active_report.bundle_id = b.id
             AND active_report.status IN ('open', 'investigating')
         )`,
    ).bind(
      reportId,
      reportPlan.reportType,
      now,
      intakeId,
      expectedRevision,
      reportPlan.bundleId,
    ),
    db.prepare(
      `UPDATE review_bundles
       SET status = 'conflicted',
           current_approval_id = NULL,
           published_transition_id = ?,
           updated_at = ?,
           revision = revision + 1
       WHERE id = ?
         AND version_id = ?
         AND revision = ?
         AND status = 'verified'
         AND current_approval_id = ?
         AND EXISTS (
           SELECT 1 FROM review_reports report
           WHERE report.id = ?
             AND report.bundle_id = review_bundles.id
             AND report.previous_bundle_revision = ?
             AND report.invalidated_approval_id = ?
         )`,
    ).bind(
      reportId,
      now,
      reportPlan.bundleId,
      intake.targetVersionId,
      intake.targetRevision,
      intake.targetSnapshotRef,
      reportId,
      intake.targetRevision,
      intake.targetSnapshotRef,
    ),
    db.prepare(
      `UPDATE public_report_intakes
       SET status = 'promoted',
           material_report_id = ?,
           triaged_by_user_id = ?,
           triage_note = ?,
           triaged_at = ?,
           revision = revision + 1
       WHERE id = ?
         AND revision = ?
         AND status = 'received'
         AND EXISTS (
           SELECT 1 FROM review_reports report
           INNER JOIN review_bundles b ON b.id = report.bundle_id
           WHERE report.id = ?
             AND b.status = 'conflicted'
             AND b.current_approval_id IS NULL
             AND b.published_transition_id = ?
         )`,
    ).bind(reportId, actor.userId, note, now, intakeId, expectedRevision, reportId, reportId),
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, report.bundle_id, ?, 'review_report_opened_from_public_intake', 'review_report', report.id,
              json_object('publicIntakeId', i.id, 'reportType', report.report_type,
                          'previousRevision', report.previous_bundle_revision,
                          'nextRevision', report.previous_bundle_revision + 1), ?
       FROM review_reports report
       INNER JOIN public_report_intakes i ON i.material_report_id = report.id
       INNER JOIN review_bundles b ON b.id = report.bundle_id
       WHERE report.id = ?
         AND i.id = ?
         AND i.status = 'promoted'
         AND b.status = 'conflicted'
         AND b.current_approval_id IS NULL`,
    ).bind(reportAuditId, actor.userId, now, reportId, intakeId),
    db.prepare(
      `INSERT INTO internal_audit_events
         (id, actor_user_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, ?, 'public_report_intake_promoted', 'public_report_intake', i.id,
              json_object('materialReportId', i.material_report_id,
                          'targetPublicId', i.target_public_id,
                          'revision', i.revision), ?
       FROM public_report_intakes i
       WHERE i.id = ?
         AND i.status = 'promoted'
         AND i.material_report_id = ?`,
    ).bind(internalAuditId, actor.userId, now, intakeId, reportId),
  ]);

  assertExactChanges(results, 5);
  return {
    intakeId,
    status: "promoted" as const,
    revision: expectedRevision + 1,
    materialReportId: reportId,
    bundleRevision: intake.targetRevision + 1,
  };
}

async function loadReceivedIntake(intakeId: string, expectedRevision: number): Promise<IntakeRow> {
  const row = await requireD1()
    .prepare(
      `SELECT id,
              target_kind AS targetKind,
              target_public_id AS targetPublicId,
              target_revision AS targetRevision,
              target_snapshot_ref AS targetSnapshotRef,
              target_version_id AS targetVersionId,
              report_reason AS reportReason,
              message,
              status,
              revision,
              created_at AS createdAt
       FROM public_report_intakes
       WHERE id = ? AND revision = ? AND status = 'received'
       LIMIT 1`,
    )
    .bind(intakeId, expectedRevision)
    .first<IntakeRow>();
  if (!row) throw new ReviewWorkflowError("REVISION_CONFLICT", "البلاغ تغير أو تم حسمه؛ أعد تحميل القائمة.");
  return row;
}

async function requireEditorialTriageActor(sessionEmail: string): Promise<{ userId: string }> {
  const email = sessionEmail.trim().toLowerCase();
  if (!email) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  const row = await requireD1()
    .prepare(
      `SELECT u.id AS userId,
              u.role AS role,
              u.status AS accountStatus,
              r.id AS reviewerId,
              r.status AS reviewerStatus
       FROM internal_users u
       LEFT JOIN reviewers r ON r.id = u.reviewer_id
       WHERE u.auth_email = ?
       LIMIT 1`,
    )
    .bind(email)
    .first<TriageActorRow>();
  if (
    !row ||
    row.role !== "editorial_reviewer" ||
    row.accountStatus !== "active" ||
    !row.reviewerId ||
    row.reviewerStatus !== "active"
  ) {
    throw new ReviewWorkflowError("FORBIDDEN", "حسم البلاغات العامة يتطلب مراجعًا تحريريًا نشطًا.");
  }
  return { userId: row.userId };
}

function normalizeId(value: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 180 || /[\u0000-\u001F\u007F]/u.test(id)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "معرّف البلاغ غير صالح.");
  }
  return id;
}

function normalizeRevision(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "revision البلاغ غير صالح.");
  }
  return value;
}

function normalizeNote(value: string): string {
  const note = typeof value === "string" ? value.trim() : "";
  if (note.length < 10 || note.length > 2000) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "ملاحظة الحسم يجب أن تكون بين 10 و2000 حرف.");
  }
  return note;
}

function assertExactChanges(results: D1Result<unknown>[], expectedCount: number) {
  if (results.length !== expectedCount || results.some((result) => (result.meta?.changes ?? 0) !== 1)) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "تغيرت حالة البلاغ أو المحتوى أثناء الحسم؛ أعد التحميل قبل المحاولة مرة أخرى.",
    );
  }
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
