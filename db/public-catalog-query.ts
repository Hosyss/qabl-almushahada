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

export type PublicCatalogDirectoryKind = 'all' | 'movie' | 'series';
export type PublicCatalogDirectoryReviewStatus = 'all' | 'verified' | 'not_verified';

export interface PublicCatalogDirectoryQueryInput {
  query: string;
  kind: PublicCatalogDirectoryKind;
  year: number | null;
  reviewStatus: PublicCatalogDirectoryReviewStatus;
  limit: number;
  offset: number;
}

export interface PublicCatalogDirectoryQueryPlan {
  countSql: string;
  countBindings: Array<string | number | null>;
  listSql: string;
  listBindings: Array<string | number | null>;
}

const DIRECTORY_CTE_SQL = `WITH directory AS (
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
    cs.retrieved_at AS retrievedAt,
    CASE WHEN EXISTS (
      SELECT 1
      FROM title_versions v
      INNER JOIN review_bundles b ON b.version_id = v.id
      INNER JOIN editorial_approvals ea
        ON ea.id = b.current_approval_id
       AND ea.bundle_id = b.id
      WHERE v.title_id = t.id
        AND v.status = 'active'
        AND b.status = 'verified'
        AND b.current_approval_id IS NOT NULL
        AND b.published_at IS NOT NULL
        AND ea.status = 'approved'
        AND NOT EXISTS (
          SELECT 1
          FROM review_reports rr
          WHERE rr.bundle_id = b.id
            AND rr.status IN ('open', 'investigating')
        )
    ) THEN 1 ELSE 0 END AS hasVerifiedReview
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
    AND (? = '' OR lower(t.canonical_name) LIKE ? ESCAPE '\\' OR lower(COALESCE(t.original_name, '')) LIKE ? ESCAPE '\\' OR lower(COALESCE(t.search_aliases_json, '[]')) LIKE ? ESCAPE '\\')
    AND (? = 'all' OR t.kind = ?)
    AND (? IS NULL OR t.release_year = ?)
)`;

const DIRECTORY_REVIEW_FILTER_SQL = `WHERE (? = 'all'
  OR (? = 'verified' AND hasVerifiedReview = 1)
  OR (? = 'not_verified' AND hasVerifiedReview = 0))`;

export function buildPublicCatalogDirectoryQueries(
  input: PublicCatalogDirectoryQueryInput,
): PublicCatalogDirectoryQueryPlan {
  if (input.kind !== 'all' && input.kind !== 'movie' && input.kind !== 'series') {
    throw new TypeError('Invalid directory kind');
  }
  if (input.reviewStatus !== 'all' && input.reviewStatus !== 'verified' && input.reviewStatus !== 'not_verified') {
    throw new TypeError('Invalid directory review status');
  }
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 48) {
    throw new RangeError('Directory limit must be between 1 and 48');
  }
  if (!Number.isInteger(input.offset) || input.offset < 0 || input.offset > 20_000) {
    throw new RangeError('Directory offset is out of range');
  }
  if (input.year !== null && (!Number.isInteger(input.year) || input.year < 1880 || input.year > 2200)) {
    throw new RangeError('Invalid directory year');
  }
  if (input.query.length > 80) throw new RangeError('Directory query is too long');

  const pattern = `%${escapeLike(input.query.toLocaleLowerCase('en-US'))}%`;
  const sharedBindings: Array<string | number | null> = [
    input.query.toLocaleLowerCase('en-US'),
    pattern,
    pattern,
    pattern,
    input.kind,
    input.kind,
    input.year,
    input.year,
    input.reviewStatus,
    input.reviewStatus,
    input.reviewStatus,
  ];

  return {
    countSql: `${DIRECTORY_CTE_SQL}\nSELECT COUNT(*) AS count FROM directory\n${DIRECTORY_REVIEW_FILTER_SQL}`,
    countBindings: [...sharedBindings],
    listSql: `${DIRECTORY_CTE_SQL}\nSELECT * FROM directory\n${DIRECTORY_REVIEW_FILTER_SQL}\nORDER BY releaseYear DESC, canonicalName COLLATE NOCASE ASC, titleId ASC\nLIMIT ? OFFSET ?`,
    listBindings: [...sharedBindings, input.limit, input.offset],
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}
