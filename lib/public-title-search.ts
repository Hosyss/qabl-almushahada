import type { Severity } from "./review-engine/index.ts";

export const MIN_PUBLIC_TITLE_SEARCH_LENGTH = 2;
export const MAX_PUBLIC_TITLE_SEARCH_LENGTH = 80;
export const MAX_PUBLIC_TITLE_SEARCH_TOKENS = 8;
export const MAX_PUBLIC_TITLE_SEARCH_RESULTS = 8;

export type PublicTitleKind = "movie" | "series" | "episode" | "special";

export interface PublicTitleSearchCandidate {
  id: string;
  canonicalName: string;
  originalName: string | null;
  kind: PublicTitleKind;
  releaseYear: number;
  hasVerifiedReview: boolean;
  hasReviewInProgress: boolean;
  verifiedBundleId?: string | null;
  /** Highest observation severity from the exact current approved public bundle. */
  verifiedMaxSeverity: Severity | null;
}

export type PublicTitleMatchKind =
  | "canonical_exact"
  | "original_exact"
  | "canonical_prefix"
  | "original_prefix"
  | "canonical_contains"
  | "original_contains"
  | "token_match";

export interface PublicTitleSearchResult extends PublicTitleSearchCandidate {
  matchKind: PublicTitleMatchKind;
}

export interface ParsedPublicTitleSearchRequest {
  query: string;
  normalizedQuery: string;
  tokens: string[];
}

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TATWEEL = /\u0640/gu;
const PUNCTUATION_OR_SYMBOL = /[\p{P}\p{S}]+/gu;
const WHITESPACE = /\s+/gu;

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function normalizePublicTitleSearchText(value: string): string {
  let normalized = value.normalize("NFKC").toLocaleLowerCase("en");
  normalized = normalized.replace(ARABIC_DIACRITICS, "").replace(TATWEEL, "");
  normalized = normalized
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي");
  normalized = normalized.replace(/[٠-٩]/gu, (digit) => String(ARABIC_INDIC_DIGITS.indexOf(digit)));
  normalized = normalized.replace(/[۰-۹]/gu, (digit) => String(EASTERN_ARABIC_DIGITS.indexOf(digit)));
  return normalized.replace(PUNCTUATION_OR_SYMBOL, " ").replace(WHITESPACE, " ").trim();
}

export function parsePublicTitleSearchRequest(input: unknown): ParsedPublicTitleSearchRequest {
  if (!isPlainObject(input)) throw new TypeError("Search request must be an object");
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "query") {
    throw new TypeError("Search request accepts only query");
  }
  if (typeof input.query !== "string") throw new TypeError("query must be a string");
  const query = input.query.trim();
  if (query.length > MAX_PUBLIC_TITLE_SEARCH_LENGTH) {
    throw new RangeError(`query cannot exceed ${MAX_PUBLIC_TITLE_SEARCH_LENGTH} characters`);
  }
  const normalizedQuery = normalizePublicTitleSearchText(query);
  if (normalizedQuery.length < MIN_PUBLIC_TITLE_SEARCH_LENGTH) {
    throw new RangeError(`query must contain at least ${MIN_PUBLIC_TITLE_SEARCH_LENGTH} searchable characters`);
  }
  const tokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))];
  if (tokens.length > MAX_PUBLIC_TITLE_SEARCH_TOKENS) {
    throw new RangeError(`query cannot exceed ${MAX_PUBLIC_TITLE_SEARCH_TOKENS} search tokens`);
  }
  return { query, normalizedQuery, tokens };
}

export function rankPublicTitleSearchCandidates(
  parsed: ParsedPublicTitleSearchRequest,
  candidates: readonly PublicTitleSearchCandidate[],
): PublicTitleSearchResult[] {
  return candidates
    .map((candidate) => ({ candidate, ...scoreCandidate(parsed, candidate) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.candidate.hasVerifiedReview !== b.candidate.hasVerifiedReview) {
        return a.candidate.hasVerifiedReview ? -1 : 1;
      }
      if (b.candidate.releaseYear !== a.candidate.releaseYear) {
        return b.candidate.releaseYear - a.candidate.releaseYear;
      }
      return a.candidate.canonicalName.localeCompare(b.candidate.canonicalName, "ar");
    })
    .slice(0, MAX_PUBLIC_TITLE_SEARCH_RESULTS)
    .map(({ candidate, matchKind }) => ({ ...candidate, matchKind }));
}

export function escapeSqlLikeToken(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function scoreCandidate(
  parsed: ParsedPublicTitleSearchRequest,
  candidate: PublicTitleSearchCandidate,
): { score: number; matchKind: PublicTitleMatchKind } {
  const canonical = normalizePublicTitleSearchText(candidate.canonicalName);
  const original = candidate.originalName ? normalizePublicTitleSearchText(candidate.originalName) : "";
  const query = parsed.normalizedQuery;

  if (canonical === query) return { score: 100, matchKind: "canonical_exact" };
  if (original === query) return { score: 96, matchKind: "original_exact" };
  if (canonical.startsWith(query)) return { score: 90, matchKind: "canonical_prefix" };
  if (original.startsWith(query)) return { score: 86, matchKind: "original_prefix" };
  if (canonical.includes(query)) return { score: 80, matchKind: "canonical_contains" };
  if (original.includes(query)) return { score: 76, matchKind: "original_contains" };

  const allTokensMatch = parsed.tokens.every(
    (token) => canonical.includes(token) || original.includes(token),
  );
  if (allTokensMatch) return { score: 60, matchKind: "token_match" };
  return { score: 0, matchKind: "token_match" };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
