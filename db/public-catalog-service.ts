import { env } from "cloudflare:workers";

import { PUBLIC_CATALOG_LIST_QUERY, PUBLIC_CATALOG_TITLE_QUERY } from "@/db/public-catalog-query";
import {
  parsePublicCatalogQid,
  publicCatalogTitleIdFromQid,
  type PublicCatalogKind,
  type PublicCatalogTitle,
} from "@/lib/public-catalog";

interface CatalogRow {
  titleId: string;
  canonicalName: string;
  originalName: string | null;
  kind: string;
  releaseYear: number;
  sourceEntityId: string;
  sourceUrl: string;
  sourceLicense: string;
  policyVersion: string;
  retrievedAt: string;
}

interface DirectoryRow extends CatalogRow {
  hasEditorialReview: number;
  hasVerifiedReview: number;
}

export type PublicCatalogDirectoryStatus = "all" | "catalog_only" | "editorial" | "verified";

export interface PublicCatalogDirectoryInput {
  query?: string;
  kind?: "all" | "movie" | "series";
  year?: number | null;
  status?: PublicCatalogDirectoryStatus;
  editorialOnly?: boolean;
  page?: number;
  pageSize?: number;
  editorialTitleIds: readonly string[];
}

export interface PublicCatalogDirectoryItem extends PublicCatalogTitle {
  hasEditorialReview: boolean;
  hasVerifiedReview: boolean;
}

export interface PublicCatalogDirectoryPage {
  items: PublicCatalogDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DIRECTORY_CTE = `WITH directory AS (
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
    CASE WHEN t.id IN (?, ?, ?, ?) THEN 1 ELSE 0 END AS hasEditorialReview,
    CASE WHEN EXISTS (
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
  WHERE p.source_key = 'wikidata'
    AND p.use_scope = 'catalog_metadata'
    AND p.decision = 'allow'
    AND p.license_label = 'CC0 1.0'
    AND p.automated_ingestion_allowed = 1
    AND p.commercial_use_allowed = 1
    AND (? = '' OR lower(t.canonical_name) LIKE ? ESCAPE '\\' OR lower(COALESCE(t.original_name, '')) LIKE ? ESCAPE '\\' OR lower(COALESCE(t.search_aliases_json, '[]')) LIKE ? ESCAPE '\\')
    AND (? = 'all' OR t.kind = ?)
    AND (? IS NULL OR t.release_year = ?)
)`;

const DIRECTORY_FILTER = `
WHERE (? = 'all'
  OR (? = 'catalog_only' AND hasEditorialReview = 0 AND hasVerifiedReview = 0)
  OR (? = 'editorial' AND hasEditorialReview = 1 AND hasVerifiedReview = 0)
  OR (? = 'verified' AND hasVerifiedReview = 1))
  AND (? = 0 OR hasEditorialReview = 1)`;

export async function loadPublicCatalogTitle(qidInput: unknown): Promise<PublicCatalogTitle | null> {
  const qid = parsePublicCatalogQid(qidInput);
  const titleId = publicCatalogTitleIdFromQid(qid);
  const row = await requireD1()
    .prepare(PUBLIC_CATALOG_TITLE_QUERY)
    .bind(titleId, qid)
    .first<CatalogRow>();
  return row ? parseCatalogRow(row) : null;
}

export async function listPublicCatalogTitles(limit = 100): Promise<PublicCatalogTitle[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError("Catalog list limit must be between 1 and 500");
  }
  const result = await requireD1().prepare(PUBLIC_CATALOG_LIST_QUERY).bind(limit).all<CatalogRow>();
  const titles: PublicCatalogTitle[] = [];
  for (const row of result.results ?? []) {
    const parsed = parseCatalogRow(row);
    if (parsed) titles.push(parsed);
  }
  return titles;
}

export async function listPublicCatalogDirectory(input: PublicCatalogDirectoryInput): Promise<PublicCatalogDirectoryPage> {
  const query = (input.query ?? "").trim().toLocaleLowerCase("en-US");
  if (query.length > 80) throw new RangeError("Directory query is too long");
  const kind = input.kind ?? "all";
  if (kind !== "all" && kind !== "movie" && kind !== "series") throw new TypeError("Invalid directory kind");
  const status = input.status ?? "all";
  if (!(["all", "catalog_only", "editorial", "verified"] as const).includes(status)) throw new TypeError("Invalid directory status");
  const year = input.year ?? null;
  if (year !== null && (!Number.isInteger(year) || year < 1880 || year > 2200)) throw new RangeError("Invalid directory year");
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 24;
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new RangeError("Invalid directory page");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) throw new RangeError("Invalid directory page size");
  if (input.editorialTitleIds.length > 4) throw new RangeError("Only the four current editorial titles are allowed in this checkpoint");

  const editorialIds = [...input.editorialTitleIds];
  for (const titleId of editorialIds) {
    if (!/^wd:Q[1-9][0-9]{0,14}$/u.test(titleId)) throw new TypeError("Invalid editorial title id");
  }
  while (editorialIds.length < 4) editorialIds.push("__none__");

  const pattern = `%${escapeLike(query)}%`;
  const editorialOnly = input.editorialOnly === true ? 1 : 0;
  const baseBindings = [
    ...editorialIds,
    query,
    pattern,
    pattern,
    pattern,
    kind,
    kind,
    year,
    year,
    status,
    status,
    status,
    status,
    editorialOnly,
  ];
  const offset = (page - 1) * pageSize;
  if (offset > 20_000) throw new RangeError("Directory offset is too large");

  const database = requireD1();
  const countSql = `${DIRECTORY_CTE}\nSELECT COUNT(*) AS count FROM directory\n${DIRECTORY_FILTER}`;
  const listSql = `${DIRECTORY_CTE}\nSELECT * FROM directory\n${DIRECTORY_FILTER}\nORDER BY releaseYear DESC, canonicalName COLLATE NOCASE ASC, titleId ASC\nLIMIT ? OFFSET ?`;

  const [countRow, result] = await Promise.all([
    database.prepare(countSql).bind(...baseBindings).first<{ count: number }>(),
    database.prepare(listSql).bind(...baseBindings, pageSize, offset).all<DirectoryRow>(),
  ]);

  const total = Number.isInteger(countRow?.count) && (countRow?.count ?? -1) >= 0 ? countRow!.count : 0;
  const items: PublicCatalogDirectoryItem[] = [];
  for (const row of result.results ?? []) {
    const parsed = parseCatalogRow(row);
    if (!parsed) continue;
    items.push({
      ...parsed,
      hasEditorialReview: row.hasEditorialReview === 1,
      hasVerifiedReview: row.hasVerifiedReview === 1,
    });
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/gu, (character) => `\\${character}`);
}

function parseCatalogRow(row: CatalogRow): PublicCatalogTitle | null {
  if (typeof row.titleId !== "string") return null;
  if (typeof row.sourceEntityId !== "string") return null;

  let qid: string;
  try {
    qid = parsePublicCatalogQid(row.sourceEntityId);
  } catch {
    return null;
  }
  if (row.titleId !== publicCatalogTitleIdFromQid(qid)) return null;

  const canonicalName = typeof row.canonicalName === "string" ? row.canonicalName.trim() : "";
  if (!canonicalName || canonicalName.length > 500) return null;
  const originalName = row.originalName === null ? null : row.originalName?.trim();
  if (row.originalName !== null && (!originalName || originalName.length > 500)) return null;

  const kind = parseKind(row.kind);
  if (!kind) return null;
  if (!Number.isInteger(row.releaseYear) || row.releaseYear < 1880 || row.releaseYear > 2200) return null;
  if (row.sourceUrl !== `https://www.wikidata.org/wiki/${qid}`) return null;
  if (row.sourceLicense !== "CC0 1.0") return null;
  if (typeof row.policyVersion !== "string" || !row.policyVersion.trim()) return null;
  if (typeof row.retrievedAt !== "string" || !Number.isFinite(new Date(row.retrievedAt).getTime())) return null;

  return {
    titleId: row.titleId,
    qid,
    canonicalName,
    originalName: originalName ?? null,
    kind,
    releaseYear: row.releaseYear,
    sourceUrl: row.sourceUrl,
    sourceLicense: "CC0 1.0",
    policyVersion: row.policyVersion.trim(),
    retrievedAt: new Date(row.retrievedAt).toISOString(),
  };
}

function parseKind(value: string): PublicCatalogKind | null {
  if (value === "movie" || value === "series") return value;
  return null;
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
