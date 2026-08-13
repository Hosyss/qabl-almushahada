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
