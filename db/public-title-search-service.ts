import { env } from "cloudflare:workers";

import {
  parsePublicTitleSearchRequest,
  rankPublicTitleSearchCandidates,
  type PublicTitleKind,
  type PublicTitleSearchCandidate,
  type PublicTitleSearchResult,
} from "@/lib/public-title-search";
import type { Severity } from "@/lib/review-engine";
import { buildPublicTitleCandidateQuery } from "@/db/public-title-search-query";

interface CandidateRow {
  id: string;
  canonicalName: string;
  originalName: string | null;
  kind: string;
  releaseYear: number;
  hasVerifiedReview: number;
  hasReviewInProgress: number;
  verifiedBundleId: string | null;
  verifiedMaxSeverity: number | null;
}

export async function searchPublicTitles(input: unknown): Promise<PublicTitleSearchResult[]> {
  const parsed = parsePublicTitleSearchRequest(input);
  const candidateQuery = buildPublicTitleCandidateQuery(parsed);
  const result = await requireD1()
    .prepare(candidateQuery.sql)
    .bind(...candidateQuery.bindings)
    .all<CandidateRow>();

  const candidates: PublicTitleSearchCandidate[] = [];
  for (const row of result.results ?? []) {
    const candidate = parseCandidateRow(row);
    if (candidate) candidates.push(candidate);
  }

  return rankPublicTitleSearchCandidates(parsed, candidates);
}

function parseCandidateRow(row: CandidateRow): PublicTitleSearchCandidate | null {
  if (typeof row.id !== "string" || !row.id.trim()) return null;
  if (typeof row.canonicalName !== "string" || !row.canonicalName.trim()) return null;
  if (row.originalName !== null && (typeof row.originalName !== "string" || !row.originalName.trim())) {
    return null;
  }
  const kind = parseTitleKind(row.kind);
  if (!kind) return null;
  if (!Number.isInteger(row.releaseYear) || row.releaseYear < 1880 || row.releaseYear > 2200) {
    return null;
  }
  if (row.hasVerifiedReview !== 0 && row.hasVerifiedReview !== 1) return null;
  if (row.hasReviewInProgress !== 0 && row.hasReviewInProgress !== 1) return null;
  if (
    row.verifiedBundleId !== null &&
    (typeof row.verifiedBundleId !== "string" || !row.verifiedBundleId.trim())
  ) {
    return null;
  }

  const verifiedBundleId = row.verifiedBundleId?.trim() ?? null;
  const hasVerifiedReview = row.hasVerifiedReview === 1;
  if (hasVerifiedReview !== (verifiedBundleId !== null)) return null;

  if (hasVerifiedReview) {
    if (
      !Number.isInteger(row.verifiedMaxSeverity) ||
      row.verifiedMaxSeverity === null ||
      row.verifiedMaxSeverity < 0 ||
      row.verifiedMaxSeverity > 4
    ) {
      return null;
    }
  } else if (row.verifiedMaxSeverity !== null) {
    return null;
  }

  return {
    id: row.id,
    canonicalName: row.canonicalName.trim(),
    originalName: row.originalName?.trim() ?? null,
    kind,
    releaseYear: row.releaseYear,
    hasVerifiedReview,
    hasReviewInProgress: row.hasReviewInProgress === 1,
    verifiedBundleId,
    verifiedMaxSeverity: hasVerifiedReview ? (row.verifiedMaxSeverity as Severity) : null,
  };
}

function parseTitleKind(value: string): PublicTitleKind | null {
  if (value === "movie" || value === "series" || value === "episode" || value === "special") {
    return value;
  }
  return null;
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
