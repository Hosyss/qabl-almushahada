export interface PublicReviewGateExpectation {
  bundleRevision: number;
  approvalId: string;
}

export interface PublicReviewGateQuery {
  sql: string;
  bindings: Array<string | number>;
}

export function buildPublicReviewGateQuery(
  bundleId: string,
  expectation?: PublicReviewGateExpectation,
): PublicReviewGateQuery {
  const bindings: Array<string | number> = [bundleId];
  let expectationSql = "";

  if (expectation) {
    expectationSql = `
         AND b.revision = ?
         AND b.current_approval_id = ?`;
    bindings.push(expectation.bundleRevision, expectation.approvalId);
  }

  return {
    sql: `SELECT
         b.id AS bundleId,
         b.revision AS bundleRevision,
         t.id AS titleId,
         t.canonical_name AS canonicalName,
         t.original_name AS originalName,
         t.kind AS kind,
         t.release_year AS releaseYear,
         v.id AS versionId,
         v.edition_label AS editionLabel,
         v.platform AS platform,
         v.language AS language,
         v.runtime_seconds AS runtimeSeconds,
         v.content_fingerprint AS contentFingerprint,
         b.published_at AS publishedAt,
         ea.id AS approvalId,
         ea.approved_at AS approvedAt
       FROM review_bundles b
       INNER JOIN title_versions v ON v.id = b.version_id
       INNER JOIN titles t ON t.id = v.title_id
       INNER JOIN editorial_approvals ea
         ON ea.id = b.current_approval_id
        AND ea.bundle_id = b.id
       WHERE b.id = ?
         AND b.status = 'verified'
         AND b.current_approval_id IS NOT NULL
         AND b.published_at IS NOT NULL
         AND v.status = 'active'
         AND ea.status = 'approved'
         AND NOT EXISTS (
           SELECT 1
           FROM review_reports rr
           WHERE rr.bundle_id = b.id
             AND rr.status IN ('open', 'investigating')
         )${expectationSql}
       LIMIT 1`,
    bindings,
  };
}
