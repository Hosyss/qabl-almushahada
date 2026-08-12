import { env } from "cloudflare:workers";

import { prepareReportOpening } from "@/lib/review-engine";

export async function openReviewReport(input: {
  bundleId: string;
  revision: number;
  reportType: string;
  message: string;
  actorId: string;
}) {
  const preparation = prepareReportOpening(input);
  if (!preparation.allowed) {
    return { opened: false as const, reason: "invalid_input" as const, errorsAr: preparation.errorsAr };
  }

  if (!env.DB) throw new Error("D1 binding `DB` is unavailable.");

  const reportId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const now = new Date().toISOString();

  const results = await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO review_reports
         (id, bundle_id, version_id, invalidated_approval_id,
          previous_bundle_status, previous_bundle_revision,
          report_type, message, status, revision, created_at)
       SELECT ?, id, version_id, current_approval_id,
              status, revision, ?, ?, 'open', 0, ?
       FROM review_bundles
       WHERE id = ?
         AND revision = ?
         AND status = 'verified'
         AND current_approval_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM review_reports active_report
           WHERE active_report.bundle_id = review_bundles.id
             AND active_report.status IN ('open', 'investigating')
         )`,
    ).bind(
      reportId,
      preparation.reportType,
      preparation.message,
      now,
      preparation.bundleId,
      preparation.expectedRevision,
    ),
    env.DB.prepare(
      `UPDATE review_bundles
       SET status = 'conflicted',
           current_approval_id = NULL,
           published_transition_id = ?,
           updated_at = ?,
           revision = revision + 1
       WHERE id = ?
         AND revision = ?
         AND EXISTS (
           SELECT 1 FROM review_reports
           WHERE id = ?
             AND bundle_id = review_bundles.id
             AND previous_bundle_revision = ?
             AND previous_bundle_status = 'verified'
             AND invalidated_approval_id IS NOT NULL
         )`,
    ).bind(
      reportId,
      now,
      preparation.bundleId,
      preparation.expectedRevision,
      reportId,
      preparation.expectedRevision,
    ),
    env.DB.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, r.bundle_id, ?, 'review_report_opened', 'review_report', r.id,
              json_object(
                'event', 'review_report_opened',
                'reportId', r.id,
                'reportType', r.report_type,
                'versionId', r.version_id,
                'invalidatedApprovalId', r.invalidated_approval_id,
                'previousStatus', r.previous_bundle_status,
                'previousRevision', r.previous_bundle_revision,
                'nextRevision', r.previous_bundle_revision + 1
              ),
              ?
       FROM review_reports r
       INNER JOIN review_bundles b ON b.id = r.bundle_id
       WHERE r.id = ?
         AND b.published_transition_id = ?
         AND b.status = 'conflicted'
         AND b.current_approval_id IS NULL`,
    ).bind(auditId, input.actorId, now, reportId, reportId),
  ]);

  const changed = results.map((result) => result.meta?.changes ?? 0);
  if (changed.some((count) => count !== 1)) {
    throw new Error(
      "Concurrent review update, missing current approval, or an active report prevented opening the report; reload before retrying.",
    );
  }

  return {
    opened: true as const,
    reportId,
    bundleId: preparation.bundleId,
    revision: preparation.nextRevision,
  };
}
