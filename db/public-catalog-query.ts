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

export type PublicCatalogDirectoryStatus = "all" | "catalog_only" | "editorial" | "verified";

export interface PublicCatalogDirectoryQueryInput {
  query: string;
  kind: "all" | "movie" | "series";
  year: number | null;
  status: PublicCatalogDirectoryStatus;
  editorialOnly: boolean;
  editorialTitleIds: readonly string[];
  limit: number;
  offset: number;
}

export interface PublicCatalogDirectoryQueryPlan {
  listSql: string;
  countSql: string;
  filterBindings: unknown[];
  listBindings: unknown[];
}

export function buildPublicCatalogDirectoryQuery(input: PublicCatalogDirectoryQueryInput): PublicCatalogDirectoryQueryPlan {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 48) throw new RangeError("Directory limit must be 1..48");
  if (!Number.isInteger(input.offset) || input.offset < 0 || input.offset > 20_000) throw new RangeError("Directory offset is invalid");
  if (input.editorialTitleIds.length > 12) throw new RangeError("Editorial title id filter is unexpectedly large");

  const editorialPlaceholders = input.editorialTitleIds.length > 0
    ? input.editorialTitleIds.map(() => "?").join(", ")
    : "NULL";
  const editorialExpr = `t.id IN (${editorialPlaceholders})`;
  const verifiedExpr = `EXISTS (
    SELECT 1
    FROM title_versions v
    INNER JOIN review_bundles b ON b.version_id = v.id
    INNER JOIN editorial_approvals ea ON ea.id = b.current_approval_id AND ea.bundle_id = b.id
    WHERE v.title_id = t.id
      AND v.status = 'active'
      AND b.status = 'verified'
      AND b.current_approval_id IS NOT NULL
      AND b.published_at IS NOT NULL
      AND ea.status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM review_reports rr
        WHERE rr.bundle_id = b.id AND rr.status IN ('open', 'investigating')
      )
  )`;

  const filters: string[] = [];
  const filterBindings: unknown[] = [...input.editorialTitleIds];

  if (input.query) {
    const pattern = `%${escapeLike(input.query)}%`;
    filters.push(`(
      lower(t.canonical_name) LIKE ? ESCAPE '\\'
      OR lower(COALESCE(t.original_name, '')) LIKE ? ESCAPE '\\'
      OR lower(COALESCE(t.search_aliases_json, '[]')) LIKE ? ESCAPE '\\'
    )`);
    filterBindings.push(pattern, pattern, pattern);
  }
  if (input.kind !== "all") {
    filters.push("t.kind = ?");
    filterBindings.push(input.kind);
  }
  if (input.year !== null) {
    filters.push("t.release_year = ?");
    filterBindings.push(input.year);
  }
  if (input.editorialOnly) filters.push(editorialExpr);
  if (input.status === "catalog_only") filters.push(`NOT (${editorialExpr}) AND NOT (${verifiedExpr})`);
  if (input.status === "editorial") filters.push(`${editorialExpr} AND NOT (${verifiedExpr})`);
  if (input.status === "verified") filters.push(verifiedExpr);

  const whereFilter = filters.length > 0 ? `AND ${filters.join(" AND ")}` : "";
  const coreFrom = `
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
${whereFilter}`;

  const listSql = `
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
  CASE WHEN ${editorialExpr} THEN 1 ELSE 0 END AS hasEditorialReview,
  CASE WHEN ${verifiedExpr} THEN 1 ELSE 0 END AS hasVerifiedReview
${coreFrom}
ORDER BY t.release_year DESC, t.canonical_name COLLATE NOCASE ASC, t.id ASC
LIMIT ? OFFSET ?`;

  const countSql = `SELECT COUNT(*) AS count ${coreFrom}`;

  // The editorial expression appears once in SELECT before coreFrom and once inside coreFrom status filters at most.
  // Bindings are intentionally explicit rather than interpolating ids into SQL.
  const selectEditorialBindings = [...input.editorialTitleIds];
  const listBindings = [...selectEditorialBindings, ...filterBindings];
  // verifiedExpr has no bindings. Status/editorial filters reuse the same SQL placeholders embedded in coreFrom,
  // so add a second editorial id set only when that filter expression appears.
  const coreEditorialUses = Number(input.editorialOnly) + Number(input.status === "catalog_only" || input.status === "editorial");
  if (coreEditorialUses > 0) {
    // filterBindings already starts with one id set; duplicate sets for each additional editorial expression after the first.
    for (let use = 1; use < coreEditorialUses; use += 1) listBindings.push(...input.editorialTitleIds);
  }
  listBindings.push(input.limit, input.offset);

  return { listSql, countSql, filterBindings, listBindings };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}
