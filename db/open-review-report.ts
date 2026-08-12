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
  const auditPayload = JSON.stringify({
    event: "review_report_opened",
    reportId,
    reportType: preparation.reportType,
    previousRevision: preparation.expectedRevision,
    nextRevision: preparation.nextRevision,
  });

  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE review_bundles
       SET status = 'conflicted',
           published_transition_id = ?,
           updated_at = ?,
           revision = revision + 1
       WHERE id = ?
         AND revision = ?
         AND status != 'withdrawn'`,
    ).bind(reportId, now, preparation.bundleId, preparation.expectedRevision),
    env.DB.prepare(
      `INSERT INTO review_reports
         (id, bundle_id, report_type, message, status, created_at)
       SELECT ?, id, ?, ?, 'open', ?
       FROM review_bundles
       WHERE id = ?
         AND published_transition_id = ?
         AND status = 'conflicted'`,
    ).bind(
      reportId,
      preparation.reportType,
      preparation.message,
      now,
      preparation.bundleId,
      reportId,
    ),
    env.DB.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, id, ?, 'review_report_opened', 'review_report', ?, ?, ?
       FROM review_bundles
       WHERE id = ?
         AND published_transition_id = ?
         AND status = 'conflicted'`,
    ).bind(auditId, input.actorId, reportId, auditPayload, now, preparation.bundleId, reportId),
  ]);

  const changed = results.map((result) => result.meta?.changes ?? 0);
  if (changed.some((count) => count !== 1)) {
    throw new Error("Concurrent review update prevented opening the report; reload before retrying.");
  }

  return {
    opened: true as const,
    reportId,
    bundleId: preparation.bundleId,
    revision: preparation.nextRevision,
  };
}

