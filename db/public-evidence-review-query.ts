export interface PublicEvidenceReviewGateExpectation {
  headRevision: number;
  publicationRevision: number;
}

export interface PublicEvidenceReviewGateQuery {
  sql: string;
  bindings: Array<string | number>;
}

export function buildPublicEvidenceReviewGateQuery(
  publicationId: string,
  expectation?: PublicEvidenceReviewGateExpectation,
): PublicEvidenceReviewGateQuery {
  const bindings: Array<string | number> = [publicationId];
  let expectationSql = "";
  if (expectation) {
    expectationSql = `
         AND head.revision = ?
         AND publication.revision = ?`;
    bindings.push(expectation.headRevision, expectation.publicationRevision);
  }

  return {
    sql: `SELECT
         publication.id AS publicationId,
         head.revision AS headRevision,
         publication.revision AS publicationRevision,
         publication.review_method AS reviewMethod,
         publication.human_watch_confirmed AS humanWatchConfirmed,
         publication.publication_gate_version AS publicationGateVersion,
         publication.published_at AS publishedAt,
         t.id AS titleId,
         t.canonical_name AS canonicalName,
         t.original_name AS originalName,
         t.kind AS kind,
         t.release_year AS releaseYear,
         version.id AS versionId,
         version.edition_label AS editionLabel,
         version.platform AS platform,
         version.language AS language,
         version.runtime_seconds AS runtimeSeconds
       FROM evidence_review_publications publication
       INNER JOIN evidence_review_publication_heads head
         ON head.current_publication_id = publication.id
        AND head.version_id = publication.version_id
       INNER JOIN title_versions version ON version.id = publication.version_id
       INNER JOIN titles t ON t.id = version.title_id
       WHERE publication.id = ?
         AND head.revision = publication.revision
         AND version.status = 'active'
         AND publication.review_method = 'evidence_based'
         AND publication.human_watch_confirmed = 0
         AND EXISTS (
           SELECT 1
           FROM evidence_publication_sources source_link
           WHERE source_link.publication_id = publication.id
         )
         AND NOT EXISTS (
           SELECT 1
           FROM evidence_publication_sources source_link
           LEFT JOIN version_evidence_sources source
             ON source.id = source_link.evidence_source_id
           LEFT JOIN content_source_policy_snapshots policy
             ON policy.id = source.policy_snapshot_id
           WHERE source_link.publication_id = publication.id
             AND (
               source.id IS NULL
               OR source.version_id <> publication.version_id
               OR policy.id IS NULL
               OR policy.use_scope <> 'analysis_evidence'
               OR policy.commercial_use_allowed <> 1
               OR source.source_license <> policy.license_label
               OR source.license_url <> policy.license_url
               OR (source.ingestion_mode = 'automated' AND policy.automated_ingestion_allowed <> 1)
               OR (policy.attribution_required = 1 AND length(trim(COALESCE(source.attribution_text, ''))) < 20)
             )
         )
         AND (
           SELECT COUNT(DISTINCT assertion.category)
           FROM evidence_publication_assertions assertion
           WHERE assertion.publication_id = publication.id
             AND assertion.result IN ('none', 'present')
         ) = 10
         AND NOT EXISTS (
           SELECT 1
           FROM evidence_publication_assertions assertion
           WHERE assertion.publication_id = publication.id
             AND assertion.result = 'uncertain'
         )
         AND NOT EXISTS (
           SELECT assertion.category
           FROM evidence_publication_assertions assertion
           WHERE assertion.publication_id = publication.id
             AND assertion.result IN ('none', 'present')
           GROUP BY assertion.category
           HAVING COUNT(DISTINCT assertion.result) > 1
         )
         AND NOT EXISTS (
           SELECT 1
           FROM evidence_publication_assertions assertion
           WHERE assertion.publication_id = publication.id
             AND assertion.result = 'present'
             AND NOT EXISTS (
               SELECT 1
               FROM evidence_publication_facts fact
               WHERE fact.publication_id = publication.id
                 AND fact.assertion_id = assertion.id
             )
         )${expectationSql}
       LIMIT 1`,
    bindings,
  };
}
