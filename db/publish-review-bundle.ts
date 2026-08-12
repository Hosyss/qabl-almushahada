import { env } from "cloudflare:workers";

import { preparePublication } from "@/lib/review-engine";
import { loadReviewBundle } from "./load-review-bundle";

export async function publishReviewBundle(bundleId: string, actorId: string) {
  const loaded = await loadReviewBundle(bundleId);
  if (!loaded) {
    return { published: false as const, reason: "not_found" as const };
  }

  const preparation = preparePublication(loaded.bundle, loaded.revision);
  if (!preparation.allowed) {
    return {
      published: false as const,
      reason: "quality_gate" as const,
      quality: preparation.quality,
    };
  }

  if (!env.DB) {
    throw new Error("D1 binding `DB` is unavailable.");
  }

  const now = new Date().toISOString();
  const transitionId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const auditPayload = JSON.stringify(preparation.auditPayload);

  const results = await env.DB.batch([
    env.DB.prepare(
      `UPDATE review_bundles
       SET status = 'verified',
           published_at = ?,
           updated_at = ?,
           revision = revision + 1,
           published_transition_id = ?
       WHERE id = ?
         AND revision = ?
         AND status IN ('draft', 'under_review', 'conflicted')`,
    ).bind(now, now, transitionId, bundleId, preparation.expectedRevision),
    env.DB.prepare(
      `INSERT INTO review_audit_events
         (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json, created_at)
       SELECT ?, id, ?, 'bundle_verified', 'review_bundle', id, ?, ?
       FROM review_bundles
       WHERE id = ?
         AND published_transition_id = ?
         AND status = 'verified'`,
    ).bind(auditId, actorId, auditPayload, now, bundleId, transitionId),
  ]);

  const updateChanges = results[0]?.meta?.changes ?? 0;
  const auditChanges = results[1]?.meta?.changes ?? 0;
  if (updateChanges !== 1 || auditChanges !== 1) {
    throw new Error("Concurrent review update prevented publication; reload and run quality gates again.");
  }

  return {
    published: true as const,
    bundleId,
    revision: preparation.nextRevision,
    quality: preparation.quality,
  };
}

