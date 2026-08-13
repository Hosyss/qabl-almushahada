import { getCloudflareContext } from "@opennextjs/cloudflare";
import { buildPublicTitleCandidateQuery } from "./public-title-search-query.ts";
import {
  parsePublicTitleSearchRequest,
  rankPublicTitleSearchCandidates,
  rankPublicTitleSearchDiscovery,
  type PublicTitleSearchCandidate,
  type PublicTitleSearchDiscovery,
  type PublicTitleSearchResult,
} from "../lib/public-title-search.ts";

interface D1PreparedStatementLike { bind(...values: unknown[]): D1PreparedStatementLike; all<T>(): Promise<{ results?: T[] }>; }
interface D1DatabaseLike { prepare(query: string): D1PreparedStatementLike; }
interface CandidateRow {
  id: string; canonicalName: string; originalName: string | null; aliasesJson: string;
  kind: "movie" | "series" | "episode" | "special"; releaseYear: number;
  hasVerifiedReview: number; hasReviewInProgress: number; verifiedBundleId: string | null; verifiedMaxSeverity: number | null;
}

export async function searchPublicTitles(input: { query: string }): Promise<PublicTitleSearchResult[]> {
  const { parsed, candidates } = await loadSearchCandidates(input);
  return rankPublicTitleSearchCandidates(parsed, candidates);
}

export async function searchPublicTitleDiscovery(input: { query: string }): Promise<PublicTitleSearchDiscovery> {
  const { parsed, candidates } = await loadSearchCandidates(input);
  return rankPublicTitleSearchDiscovery(parsed, candidates);
}

async function loadSearchCandidates(input: { query: string }) {
  const parsed = parsePublicTitleSearchRequest(input);
  const database = await getPublicDatabase();
  const candidateQuery = buildPublicTitleCandidateQuery(parsed);
  const response = await database.prepare(candidateQuery.sql).bind(...candidateQuery.bindings).all<CandidateRow>();
  const rows = Array.isArray(response.results) ? response.results : [];
  const candidates: PublicTitleSearchCandidate[] = rows.map((row) => ({
    id: row.id,
    canonicalName: row.canonicalName,
    originalName: row.originalName,
    aliases: parseAliases(row.aliasesJson),
    kind: row.kind,
    releaseYear: row.releaseYear,
    hasVerifiedReview: row.hasVerifiedReview === 1,
    hasReviewInProgress: row.hasReviewInProgress === 1,
    verifiedBundleId: row.verifiedBundleId,
    verifiedMaxSeverity: row.verifiedMaxSeverity == null ? null : clampSeverity(row.verifiedMaxSeverity),
  }));
  return { parsed, candidates };
}

async function getPublicDatabase(): Promise<D1DatabaseLike> {
  const context = await getCloudflareContext({ async: true });
  const database = (context.env as { DB?: D1DatabaseLike }).DB;
  if (!database) throw new Error("Public D1 binding is unavailable");
  return database;
}

function parseAliases(value: unknown): string[] {
  if (typeof value !== "string" || value.length > 12000) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((item): item is string => typeof item === "string")
      .map((item) => item.trim()).filter((item) => item.length >= 2 && item.length <= 240))].slice(0, 32);
  } catch { return []; }
}

function clampSeverity(value: number): 0 | 1 | 2 | 3 {
  if (!Number.isInteger(value) || value < 0 || value > 3) throw new TypeError("Verified maximum severity from D1 is invalid");
  return value as 0 | 1 | 2 | 3;
}
