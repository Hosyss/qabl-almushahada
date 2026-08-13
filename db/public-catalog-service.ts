import { env } from "cloudflare:workers";
import {
  buildPublicCatalogDirectoryQueries,
  PUBLIC_CATALOG_LIST_QUERY,
  PUBLIC_CATALOG_TITLE_QUERY,
  type PublicCatalogDirectoryEditorialStatus,
  type PublicCatalogDirectoryKind,
  type PublicCatalogDirectoryReviewStatus,
} from "@/db/public-catalog-query";
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
interface DirectoryRow extends CatalogRow { hasVerifiedReview: number; hasEditorialReview: number; }

export type { PublicCatalogDirectoryEditorialStatus, PublicCatalogDirectoryReviewStatus } from "@/db/public-catalog-query";

export interface PublicCatalogDirectoryInput {
  query?: string;
  kind?: PublicCatalogDirectoryKind;
  year?: number | null;
  reviewStatus?: PublicCatalogDirectoryReviewStatus;
  editorialStatus?: PublicCatalogDirectoryEditorialStatus;
  page?: number;
  pageSize?: number;
}
export interface PublicCatalogDirectoryItem extends PublicCatalogTitle {
  hasVerifiedReview: boolean;
  hasEditorialReview: boolean;
}
export interface PublicCatalogDirectoryPage {
  items: PublicCatalogDirectoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function loadPublicCatalogTitle(qidInput: unknown): Promise<PublicCatalogTitle | null> {
  const qid = parsePublicCatalogQid(qidInput);
  const row = await requireD1().prepare(PUBLIC_CATALOG_TITLE_QUERY).bind(publicCatalogTitleIdFromQid(qid), qid).first<CatalogRow>();
  return row ? parseCatalogRow(row) : null;
}

export async function listPublicCatalogTitles(limit = 100): Promise<PublicCatalogTitle[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new RangeError("Catalog list limit must be between 1 and 500");
  const result = await requireD1().prepare(PUBLIC_CATALOG_LIST_QUERY).bind(limit).all<CatalogRow>();
  return (result.results ?? []).map(parseCatalogRow).filter((item): item is PublicCatalogTitle => item !== null);
}

export async function listPublicCatalogDirectory(input: PublicCatalogDirectoryInput): Promise<PublicCatalogDirectoryPage> {
  const query = (input.query ?? "").trim();
  const kind = input.kind ?? "all";
  const year = input.year ?? null;
  const reviewStatus = input.reviewStatus ?? "all";
  const editorialStatus = input.editorialStatus ?? "all";
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 24;
  if (query.length > 80) throw new RangeError("Directory query is too long");
  if (kind !== "all" && kind !== "movie" && kind !== "series") throw new TypeError("Invalid directory kind");
  if (reviewStatus !== "all" && reviewStatus !== "verified" && reviewStatus !== "not_verified") throw new TypeError("Invalid directory review status");
  if (editorialStatus !== "all" && editorialStatus !== "editorial" && editorialStatus !== "no_editorial") throw new TypeError("Invalid directory editorial status");
  if (year !== null && (!Number.isInteger(year) || year < 1880 || year > 2200)) throw new RangeError("Invalid directory year");
  if (!Number.isInteger(page) || page < 1 || page > 1000) throw new RangeError("Invalid directory page");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) throw new RangeError("Invalid directory page size");
  const offset = (page - 1) * pageSize;
  if (offset > 20_000) throw new RangeError("Directory offset is too large");

  const plan = buildPublicCatalogDirectoryQueries({ query, kind, year, reviewStatus, editorialStatus, limit: pageSize, offset });
  const database = requireD1();
  const [countRow, result] = await Promise.all([
    database.prepare(plan.countSql).bind(...plan.countBindings).first<{ count: number }>(),
    database.prepare(plan.listSql).bind(...plan.listBindings).all<DirectoryRow>(),
  ]);
  const total = typeof countRow?.count === "number" && Number.isInteger(countRow.count) && countRow.count >= 0 ? countRow.count : 0;
  const items: PublicCatalogDirectoryItem[] = [];
  for (const row of result.results ?? []) {
    const parsed = parseCatalogRow(row);
    if (parsed) items.push({ ...parsed, hasVerifiedReview: row.hasVerifiedReview === 1, hasEditorialReview: row.hasEditorialReview === 1 });
  }
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

function parseCatalogRow(row: CatalogRow): PublicCatalogTitle | null {
  if (typeof row.titleId !== "string" || typeof row.sourceEntityId !== "string") return null;
  let qid: string;
  try { qid = parsePublicCatalogQid(row.sourceEntityId); } catch { return null; }
  if (row.titleId !== publicCatalogTitleIdFromQid(qid)) return null;
  const canonicalName = typeof row.canonicalName === "string" ? row.canonicalName.trim() : "";
  const originalName = row.originalName === null ? null : row.originalName?.trim();
  if (!canonicalName || canonicalName.length > 500 || (row.originalName !== null && (!originalName || originalName.length > 500))) return null;
  const kind = parseKind(row.kind);
  if (!kind || !Number.isInteger(row.releaseYear) || row.releaseYear < 1880 || row.releaseYear > 2200) return null;
  if (row.sourceUrl !== `https://www.wikidata.org/wiki/${qid}` || row.sourceLicense !== "CC0 1.0") return null;
  if (typeof row.policyVersion !== "string" || !row.policyVersion.trim()) return null;
  if (typeof row.retrievedAt !== "string" || !Number.isFinite(new Date(row.retrievedAt).getTime())) return null;
  return { titleId: row.titleId, qid, canonicalName, originalName: originalName ?? null, kind, releaseYear: row.releaseYear, sourceUrl: row.sourceUrl, sourceLicense: "CC0 1.0", policyVersion: row.policyVersion.trim(), retrievedAt: new Date(row.retrievedAt).toISOString() };
}
function parseKind(value: string): PublicCatalogKind | null { return value === "movie" || value === "series" ? value : null; }
function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
