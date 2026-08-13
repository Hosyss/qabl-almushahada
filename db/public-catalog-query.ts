const ALLOWED_CATALOG_SOURCE_SQL = `
  p.source_key = 'wikidata'
  AND p.use_scope = 'catalog_metadata'
  AND p.decision = 'allow'
  AND p.license_label = 'CC0 1.0'
  AND p.automated_ingestion_allowed = 1
  AND p.commercial_use_allowed = 1
`;

export const PUBLIC_CATALOG_TITLE_QUERY = `
SELECT
  t.id AS titleId,
  t.canonical_name AS canonicalName,
  t.original_name AS originalName,
  t.kind AS kind,
  t.release_year AS releaseYear,
  cs.source_entity_id AS sourceEntityId,
  cs.source_url AS sourceUrl,
  p.license_label AS sourceLicense,
  p.policy_version AS policyVersion,
  cs.retrieved_at AS retrievedAt
FROM titles t
INNER JOIN title_catalog_sources cs ON cs.title_id = t.id
INNER JOIN content_source_policy_snapshots p ON p.id = cs.policy_snapshot_id
WHERE t.id = ?
  AND cs.source_entity_id = ?
  AND ${ALLOWED_CATALOG_SOURCE_SQL}
ORDER BY cs.retrieved_at DESC, cs.created_at DESC, cs.id DESC
LIMIT 1`;

export const PUBLIC_CATALOG_LIST_QUERY = `
SELECT
  t.id AS titleId,
  t.canonical_name AS canonicalName,
  t.original_name AS originalName,
  t.kind AS kind,
  t.release_year AS releaseYear,
  cs.source_entity_id AS sourceEntityId,
  cs.source_url AS sourceUrl,
  p.license_label AS sourceLicense,
  p.policy_version AS policyVersion,
  cs.retrieved_at AS retrievedAt
FROM titles t
INNER JOIN title_catalog_sources cs ON cs.id = (
  SELECT cs2.id
  FROM title_catalog_sources cs2
  INNER JOIN content_source_policy_snapshots p2 ON p2.id = cs2.policy_snapshot_id
  WHERE cs2.title_id = t.id
    AND p2.source_key = 'wikidata'
    AND p2.use_scope = 'catalog_metadata'
    AND p2.decision = 'allow'
    AND p2.license_label = 'CC0 1.0'
    AND p2.automated_ingestion_allowed = 1
    AND p2.commercial_use_allowed = 1
  ORDER BY cs2.retrieved_at DESC, cs2.created_at DESC, cs2.id DESC
  LIMIT 1
)
INNER JOIN content_source_policy_snapshots p ON p.id = cs.policy_snapshot_id
WHERE ${ALLOWED_CATALOG_SOURCE_SQL}
ORDER BY t.release_year DESC, t.canonical_name COLLATE NOCASE ASC, t.id ASC
LIMIT ?`;
