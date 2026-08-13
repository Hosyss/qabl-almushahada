import { env } from "cloudflare:workers";
import { CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY, CURRENT_EDITORIAL_BY_TITLE_ID_QUERY, CURRENT_EDITORIAL_LIST_QUERY } from "./public-editorial-head-query";
import { EDITORIAL_CLAIMS_QUERY, EDITORIAL_CLAIM_SOURCES_QUERY, EDITORIAL_SOURCES_QUERY, EDITORIAL_UNCERTAIN_QUERY } from "./public-editorial-children-query";
import type { EditorialClaimRow, EditorialClaimSourceRow, EditorialHeadRow, EditorialSourceRow, EditorialUncertainRow } from "./public-editorial-read-model";

export async function findEditorialHeadByPublicId(id: string) {
  return database().prepare(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY).bind(id).first<EditorialHeadRow>();
}
export async function findEditorialHeadByTitleId(id: string) {
  return database().prepare(CURRENT_EDITORIAL_BY_TITLE_ID_QUERY).bind(id).first<EditorialHeadRow>();
}
export async function listEditorialHeads(limit: number) {
  const result = await database().prepare(CURRENT_EDITORIAL_LIST_QUERY).bind(limit).all<EditorialHeadRow>();
  return result.results ?? [];
}
export async function loadEditorialChildren(snapshotId: string) {
  const db = database();
  const [sources, claims, links, uncertain] = await Promise.all([
    db.prepare(EDITORIAL_SOURCES_QUERY).bind(snapshotId).all<EditorialSourceRow>(),
    db.prepare(EDITORIAL_CLAIMS_QUERY).bind(snapshotId).all<EditorialClaimRow>(),
    db.prepare(EDITORIAL_CLAIM_SOURCES_QUERY).bind(snapshotId).all<EditorialClaimSourceRow>(),
    db.prepare(EDITORIAL_UNCERTAIN_QUERY).bind(snapshotId).all<EditorialUncertainRow>(),
  ]);
  return { sources: sources.results ?? [], claims: claims.results ?? [], links: links.results ?? [], uncertain: uncertain.results ?? [] };
}
function database(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
