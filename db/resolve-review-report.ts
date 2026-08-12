import { env } from "cloudflare:workers";

import {
  INTERNAL_ROLES,
  ReviewWorkflowError,
  type InternalActor,
  type InternalAccountStatus,
  type InternalRole,
} from "@/lib/internal-review-workflow";
import { prepareReviewReportResolution } from "@/lib/review-report-resolution";
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

interface ReportRow {
  reportId: string;
  bundleId: string;
  versionId: string | null;
  invalidatedApprovalId: string | null;
  previousBundleStatus: string | null;
  previousBundleRevision: number | null;
  reportType: string;
  reportStatus: string;
  reportRevision: number;
  bundleVersionId: string;
  bundleStatus: string;
  bundleRevision: number;
  currentApprovalId: string | null;
}

interface AssignmentCountRow {
  total: number;
  approved: number;
}

export async function resolveReviewReport(input: {
  sessionEmail: string;
  request: unknown;
}) {
  const actor = await requireInternalActor(input.sessionEmail);
  const plan = prepareReviewReportResolution(actor, input.request);
  const report = await loadReport(plan.reportId);

  if (report.reportRevision !== plan.expectedReportRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision البلاغ قديم؛ أعد تحميل البيانات.");
  }
  if (report.bundleRevision !== plan.expectedBundleRevision) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", "revision الحزمة قديم؛ أعد تحميل البيانات.");
  }
  if (report.reportStatus !== "open" && report.reportStatus !== "investigating") {
    throw new ReviewWorkflowError("ASSIGNMENT_LOCKED", "تم حسم هذا البلاغ بالفعل.");
  }
  if (
    !report.versionId ||
    report.versionId !== report.bundleVersionId ||
    report.previousBundleStatus !== "verified" ||
    report.invalidatedApprovalId === null ||
    report.previousBundleRevision === null ||
    report.previousBundleRevision + 1 !== report.bundleRevision ||
    report.bundleStatus !== "conflicted" ||
    report.currentApprovalId !== null
  ) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "حالة البلاغ أو الحزمة تغيرت؛ لا يمكن الحسم تلقائيًا بأمان.",
    );
  }

  if (plan.resolutionKind === "no_issue") {
    return dismissReportAsNoIssue(actor, plan, report);
  }
  return confirmCorrectionRequired(actor, plan, report);
}

async function dismissReportAsNoIssue(
  actor: InternalActor,
  plan: ReturnType<typeof prepareReviewReportResolution>,
  report: ReportRow,
) {
  const db = requireD1();
  const now = new Date().toISOString();
  const transitionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  const results = await db.batch([
    db.prepare(
      `UPDATE review_reports
       SET status = 'dismissed',
           resolution_kind = 'no_issue',
           resolution_note = ?,
           resolved_by_user_id = ?,
           resolved_at = ?,
           revision = revision + 1,
           last_transition_id = ?
       WHERE id = ?
         AND revision = ?
         AND status IN ('open', 'investigating')
         AND bundle_id = ?
         AND version_id = ?`,
    ).bind(
      plan.note,
      actor.userId,
      now,
      transitionId,
      report.reportId,
      plan.expectedReportRevision,
      report.bundleId,
      report.versionId,
    ),
    db.prepare(
      `UPDATE review_bundles
       SET status = 'verified',
           current_approval_id = ?,
           revision = revision + 1,
           workflow_transition_id = ?,
           updated_at = ?
       WHERE id = ?
         AND version_id = ?
         AND revision = ?
         AND status = 'conflicted'
         AND current_approval_id IS NULL
         AND EXISTS (
           SELECT 1 FROM review_reports
           WHERE id = ?
             AND status = 'dismissed'
             AND resolution_kind = 'no_issue'
             AND last_transition_id = ?
         )`,
    ).bind(
      report.invalidatedApprovalId,
      transitionId,
      now,
      report.bundleId,
      report.versionId,
      plan.expectedBundleRevision,
      report.reportId,
      transitionId,
    ),
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, r.bundle_id, ?, 'review_report_dismissed', 'review_report', r.id,
              json_object(
                'resolutionKind', 'no_issue',
                'restoredApprovalId', r.invalidated_approval_id,
                'versionId', r.version_id,
                'reportRevision', r.revision,
                'bundleRevision', b.revision
              ),
              ?
       FROM review_reports r
       INNER JOIN review_bundles b ON b.id = r.bundle_id
       WHERE r.id = ?
         AND r.last_transition_id = ?
         AND b.workflow_transition_id = ?`,
    ).bind(auditId, actor.userId, now, report.reportId, transitionId, transitionId),
  ]);

  assertChanges(results, [0, 1, 2]);
  return {
    reportId: report.reportId,
    resolutionKind: "no_issue" as const,
    reportRevision: plan.expectedReportRevision + 1,
    bundleRevision: plan.expectedBundleRevision + 1,
    restoredApprovalId: report.invalidatedApprovalId,
  };
}

async function confirmCorrectionRequired(
  actor: InternalActor,
  plan: ReturnType<typeof prepareReviewReportResolution>,
  report: ReportRow,
) {
  const db = requireD1();
  const now = new Date().toISOString();
  const transitionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const versionMismatch = report.reportType === "different_version";

  let expectedApprovedAssignments = 0;
  if (!versionMismatch) {
    const counts = await db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN state = 'approved' THEN 1 ELSE 0 END) AS approved
         FROM review_assignments
         WHERE bundle_id = ? AND version_id = ?`,
      )
      .bind(report.bundleId, report.versionId)
      .first<AssignmentCountRow>();
    const total = Number(counts?.total ?? 0);
    const approved = Number(counts?.approved ?? 0);
    if (total < 1 || approved !== total) {
      throw new ReviewWorkflowError(
        "REVISION_CONFLICT",
        "مهام النسخة لم تعد كلها في حالة approved؛ أعد تحميل الحزمة قبل التصحيح.",
      );
    }
    expectedApprovedAssignments = total;
  }

  const statements = [
    db.prepare(
      `UPDATE review_reports
       SET status = 'resolved',
           resolution_kind = 'correction_required',
           resolution_note = ?,
           resolved_by_user_id = ?,
           resolved_at = ?,
           revision = revision + 1,
           last_transition_id = ?
       WHERE id = ?
         AND revision = ?
         AND status IN ('open', 'investigating')
         AND bundle_id = ?
         AND version_id = ?`,
    ).bind(
      plan.note,
      actor.userId,
      now,
      transitionId,
      report.reportId,
      plan.expectedReportRevision,
      report.bundleId,
      report.versionId,
    ),
  ];

  let assignmentUpdateIndex: number | null = null;
  if (!versionMismatch) {
    assignmentUpdateIndex = statements.length;
    statements.push(
      db.prepare(
        `UPDATE review_assignments
         SET state = 'changes_requested',
             revision = revision + 1,
             last_transition_id = ?,
             updated_at = ?
         WHERE bundle_id = ?
           AND version_id = ?
           AND state = 'approved'
           AND EXISTS (
             SELECT 1 FROM review_reports
             WHERE id = ?
               AND status = 'resolved'
               AND resolution_kind = 'correction_required'
               AND last_transition_id = ?
           )`,
      ).bind(
        transitionId,
        now,
        report.bundleId,
        report.versionId,
        report.reportId,
        transitionId,
      ),
    );
  }

  const bundleUpdateIndex = statements.length;
  statements.push(
    db.prepare(
      `UPDATE review_bundles
       SET status = ?,
           current_approval_id = NULL,
           revision = revision + 1,
           workflow_transition_id = ?,
           updated_at = ?
       WHERE id = ?
         AND version_id = ?
         AND revision = ?
         AND status = 'conflicted'
         AND current_approval_id IS NULL
         AND EXISTS (
           SELECT 1 FROM review_reports
           WHERE id = ?
             AND status = 'resolved'
             AND resolution_kind = 'correction_required'
             AND last_transition_id = ?
         )`,
    ).bind(
      versionMismatch ? "withdrawn" : "under_review",
      transitionId,
      now,
      report.bundleId,
      report.versionId,
      plan.expectedBundleRevision,
      report.reportId,
      transitionId,
    ),
  );

  const auditIndex = statements.length;
  statements.push(
    db.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, r.bundle_id, ?, ?, 'review_report', r.id,
              json_object(
                'resolutionKind', 'correction_required',
                'versionId', r.version_id,
                'invalidatedApprovalId', r.invalidated_approval_id,
                'reportType', r.report_type,
                'reportRevision', r.revision,
                'bundleRevision', b.revision,
                'nextBundleStatus', b.status
              ),
              ?
       FROM review_reports r
       INNER JOIN review_bundles b ON b.id = r.bundle_id
       WHERE r.id = ?
         AND r.last_transition_id = ?
         AND b.workflow_transition_id = ?`,
    ).bind(
      auditId,
      actor.userId,
      versionMismatch ? "review_report_version_mismatch_confirmed" : "review_report_correction_required",
      now,
      report.reportId,
      transitionId,
      transitionId,
    ),
  );

  const results = await db.batch(statements);
  assertChanges(results, [0, bundleUpdateIndex, auditIndex]);
  if (
    assignmentUpdateIndex !== null &&
    (results[assignmentUpdateIndex]?.meta?.changes ?? 0) !== expectedApprovedAssignments
  ) {
    throw new ReviewWorkflowError(
      "REVISION_CONFLICT",
      "تغيرت مهام المراجعة أثناء الحسم؛ أعد تحميل البيانات.",
    );
  }

  return {
    reportId: report.reportId,
    resolutionKind: "correction_required" as const,
    reportRevision: plan.expectedReportRevision + 1,
    bundleRevision: plan.expectedBundleRevision + 1,
    nextBundleStatus: versionMismatch ? ("withdrawn" as const) : ("under_review" as const),
    reopenedAssignmentCount: versionMismatch ? 0 : expectedApprovedAssignments,
  };
}

async function loadReport(reportId: string): Promise<ReportRow> {
  const row = await requireD1()
    .prepare(
      `SELECT
         r.id AS reportId,
         r.bundle_id AS bundleId,
         r.version_id AS versionId,
         r.invalidated_approval_id AS invalidatedApprovalId,
         r.previous_bundle_status AS previousBundleStatus,
         r.previous_bundle_revision AS previousBundleRevision,
         r.report_type AS reportType,
         r.status AS reportStatus,
         r.revision AS reportRevision,
         b.version_id AS bundleVersionId,
         b.status AS bundleStatus,
         b.revision AS bundleRevision,
         b.current_approval_id AS currentApprovalId
       FROM review_reports r
       INNER JOIN review_bundles b ON b.id = r.bundle_id
       WHERE r.id = ?
       LIMIT 1`,
    )
    .bind(reportId)
    .first<ReportRow>();
  if (!row) throw new ReviewWorkflowError("FORBIDDEN", "البلاغ غير موجود.");
  return row;
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
    reviewer: parseReviewer(row),
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

function parseReviewer(row: ActorRow): ReviewerIdentity | null {
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
