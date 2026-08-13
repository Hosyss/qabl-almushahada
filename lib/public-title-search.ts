export const MIN_PUBLIC_TITLE_SEARCH_QUERY_LENGTH = 2;
export const MAX_PUBLIC_TITLE_SEARCH_QUERY_LENGTH = 80;
export const MAX_PUBLIC_TITLE_SEARCH_TOKENS = 8;
export const MAX_PUBLIC_TITLE_SEARCH_RESULTS = 8;
export const MAX_PUBLIC_TITLE_DID_YOU_MEAN_RESULTS = 5;

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TATWEEL = /\u0640/gu;
const PUNCTUATION_OR_SYMBOL = /[\p{P}\p{S}]+/gu;
const WHITESPACE = /\s+/gu;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/u;
const ARABIC_SCRIPT = /[\u0600-\u06FF]/u;
const LATIN_SCRIPT = /[A-Za-z]/u;

const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export type PublicTitleKind = "movie" | "series" | "episode" | "special";
export type PublicTitleSearchMatchConfidence = "direct" | "suggestion";
export type PublicTitleSearchMatchKind =
  | "canonical_exact" | "original_exact" | "alias_exact"
  | "canonical_prefix" | "original_prefix" | "alias_prefix"
  | "canonical_contains" | "original_contains" | "alias_contains"
  | "token_match" | "compact_match" | "fuzzy_match";

export interface PublicTitleSearchCandidate {
  id: string;
  canonicalName: string;
  originalName: string | null;
  aliases?: string[];
  kind: PublicTitleKind;
  releaseYear: number;
  hasVerifiedReview: boolean;
  hasReviewInProgress: boolean;
  verifiedBundleId: string | null;
  verifiedMaxSeverity: 0 | 1 | 2 | 3 | null;
  editorialPublicationId?: string | null;
  editorialTitleAr?: string | null;
  editorialTitleEn?: string | null;
}

export interface PublicTitleSearchResult extends PublicTitleSearchCandidate {
  aliases: string[];
  matchKind: PublicTitleSearchMatchKind;
  matchConfidence: PublicTitleSearchMatchConfidence;
  matchScore: number;
}

export interface PublicTitleSearchDiscovery {
  matches: PublicTitleSearchResult[];
  didYouMean: PublicTitleSearchResult[];
}

export interface ParsedPublicTitleSearchRequest {
  query: string;
  normalizedQuery: string;
  compactQuery: string;
  tokens: string[];
}

export interface PublicTitleDisplayNames {
  arabicName: string;
  englishName: string;
}

export function normalizePublicTitleSearchText(value: string): string {
  if (typeof value !== "string") throw new TypeError("Search text must be a string");
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(ARABIC_DIACRITICS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/gu, "ا")
    .replace(/[ؤ]/gu, "و")
    .replace(/[ئ]/gu, "ي")
    .replace(/[ىی]/gu, "ي")
    .replace(/[ک]/gu, "ك")
    .replace(/[ۀ]/gu, "ة")
    .replace(/[٠-٩۰-۹]/gu, (digit) => DIGIT_MAP[digit] ?? digit)
    .replace(PUNCTUATION_OR_SYMBOL, " ")
    .replace(WHITESPACE, " ")
    .trim();
}

export function compactPublicTitleSearchText(value: string): string {
  return normalizePublicTitleSearchText(value).replaceAll(" ", "");
}

export function parsePublicTitleSearchRequest(input: unknown): ParsedPublicTitleSearchRequest {
  if (!isPlainObject(input) || Object.keys(input).length !== 1 || typeof input.query !== "string") {
    throw new TypeError("Public title search accepts exactly one query field");
  }
  const query = input.query.trim();
  if (CONTROL_CHARACTERS.test(query)) throw new TypeError("Search query contains control characters");
  if (query.length > MAX_PUBLIC_TITLE_SEARCH_QUERY_LENGTH * 2) {
    throw new RangeError("Search query is unreasonably long before normalization");
  }
  const normalizedQuery = normalizePublicTitleSearchText(query);
  if (normalizedQuery.length < MIN_PUBLIC_TITLE_SEARCH_QUERY_LENGTH || normalizedQuery.length > MAX_PUBLIC_TITLE_SEARCH_QUERY_LENGTH) {
    throw new RangeError("Search query length is outside the public bounds");
  }
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > MAX_PUBLIC_TITLE_SEARCH_TOKENS) {
    throw new RangeError("Search query contains too many tokens");
  }
  return { query, normalizedQuery, compactQuery: normalizedQuery.replaceAll(" ", ""), tokens };
}

export function rankPublicTitleSearchCandidates(
  request: ParsedPublicTitleSearchRequest,
  candidates: readonly PublicTitleSearchCandidate[],
): PublicTitleSearchResult[] {
  return rankPublicTitleSearchDiscovery(request, candidates).matches;
}

export function rankPublicTitleSearchDiscovery(
  request: ParsedPublicTitleSearchRequest,
  candidates: readonly PublicTitleSearchCandidate[],
): PublicTitleSearchDiscovery {
  const ranked = candidates
    .map((candidate) => scoreCandidate(request, candidate))
    .filter((item): item is PublicTitleSearchResult => item !== null)
    .sort(compareRankedResults);

  const matches: PublicTitleSearchResult[] = [];
  const didYouMean: PublicTitleSearchResult[] = [];
  const seenDirect = new Set<string>();
  const seenSuggestion = new Set<string>();

  for (const result of ranked) {
    if (result.matchConfidence === "direct") {
      if (seenDirect.has(result.id) || matches.length >= MAX_PUBLIC_TITLE_SEARCH_RESULTS) continue;
      seenDirect.add(result.id);
      matches.push(result);
      continue;
    }
    if (seenDirect.has(result.id) || seenSuggestion.has(result.id) || didYouMean.length >= MAX_PUBLIC_TITLE_DID_YOU_MEAN_RESULTS) continue;
    seenSuggestion.add(result.id);
    didYouMean.push(result);
  }
  return { matches, didYouMean };
}

export function getPublicTitleDisplayNames(
  title: Pick<PublicTitleSearchCandidate, "canonicalName" | "originalName">,
): PublicTitleDisplayNames {
  const canonical = title.canonicalName.trim();
  const original = title.originalName?.trim() || "";
  const arabicName = ARABIC_SCRIPT.test(canonical) ? canonical : ARABIC_SCRIPT.test(original) ? original : canonical;
  const englishName = LATIN_SCRIPT.test(original) ? original : LATIN_SCRIPT.test(canonical) ? canonical : original || canonical;
  return { arabicName, englishName };
}

export function formatPublicTitleSuggestionLabel(
  title: Pick<PublicTitleSearchCandidate, "canonicalName" | "originalName" | "releaseYear">,
): string {
  const { arabicName, englishName } = getPublicTitleDisplayNames(title);
  return `${arabicName} — ${englishName} (${title.releaseYear})`;
}

function scoreCandidate(
  request: ParsedPublicTitleSearchRequest,
  candidate: PublicTitleSearchCandidate,
): PublicTitleSearchResult | null {
  const aliases = [...new Set((candidate.aliases ?? []).map((alias) => alias.trim()).filter(Boolean))];
  const normalizedCanonical = normalizePublicTitleSearchText(candidate.canonicalName);
  const normalizedOriginal = candidate.originalName ? normalizePublicTitleSearchText(candidate.originalName) : "";
  const normalizedAliases = aliases.map((alias) => normalizePublicTitleSearchText(alias)).filter(Boolean);
  const names = [
    { kind: "canonical" as const, value: normalizedCanonical },
    ...(normalizedOriginal ? [{ kind: "original" as const, value: normalizedOriginal }] : []),
    ...normalizedAliases.map((value) => ({ kind: "alias" as const, value })),
  ];

  let best: { score: number; matchKind: PublicTitleSearchMatchKind; matchConfidence: PublicTitleSearchMatchConfidence } | null = null;
  for (const name of names) {
    const scored = scoreNormalizedName(request, name.kind, name.value);
    if (!scored || (best && scored.score <= best.score)) continue;
    best = scored;
  }
  if (!best) return null;
  return { ...candidate, aliases, matchKind: best.matchKind, matchConfidence: best.matchConfidence, matchScore: best.score };
}

function scoreNormalizedName(
  request: ParsedPublicTitleSearchRequest,
  source: "canonical" | "original" | "alias",
  normalizedName: string,
): { score: number; matchKind: PublicTitleSearchMatchKind; matchConfidence: PublicTitleSearchMatchConfidence } | null {
  if (!normalizedName) return null;
  const query = request.normalizedQuery;
  if (normalizedName === query) {
    return { score: source === "canonical" ? 1000 : source === "original" ? 990 : 980, matchKind: `${source}_exact` as PublicTitleSearchMatchKind, matchConfidence: "direct" };
  }
  if (normalizedName.startsWith(`${query} `) || normalizedName.startsWith(query)) {
    return { score: source === "canonical" ? 920 : source === "original" ? 910 : 900, matchKind: `${source}_prefix` as PublicTitleSearchMatchKind, matchConfidence: "direct" };
  }
  if (normalizedName.includes(query)) {
    return { score: source === "canonical" ? 820 : source === "original" ? 810 : 800, matchKind: `${source}_contains` as PublicTitleSearchMatchKind, matchConfidence: "direct" };
  }
  if (request.tokens.every((token) => normalizedName.split(" ").some((part) => part === token || part.startsWith(token)))) {
    return { score: 740, matchKind: "token_match", matchConfidence: "direct" };
  }

  const compactName = normalizedName.replaceAll(" ", "");
  if (request.compactQuery.length >= 5 && (compactName === request.compactQuery || compactName.startsWith(request.compactQuery))) {
    return { score: compactName === request.compactQuery ? 690 : 670, matchKind: "compact_match", matchConfidence: "suggestion" };
  }

  const fuzzyScore = scoreConservativeFuzzyMatch(request, normalizedName);
  if (fuzzyScore !== null) return { score: fuzzyScore, matchKind: "fuzzy_match", matchConfidence: "suggestion" };
  return null;
}

function scoreConservativeFuzzyMatch(request: ParsedPublicTitleSearchRequest, normalizedName: string): number | null {
  if (request.normalizedQuery.length < 5) return null;
  const queryTokenCount = request.tokens.length;
  const nameTokens = normalizedName.split(" ").filter(Boolean);
  const comparisons = new Set<string>([normalizedName]);
  if (nameTokens.length >= queryTokenCount) comparisons.add(nameTokens.slice(0, queryTokenCount).join(" "));
  const compactName = normalizedName.replaceAll(" ", "");
  comparisons.add(compactName);
  comparisons.add(compactName.slice(0, request.compactQuery.length));

  let minDistance = Number.POSITIVE_INFINITY;
  for (const comparison of comparisons) {
    const distance = boundedLevenshtein(request.compactQuery, comparison.replaceAll(" ", ""), 2);
    if (distance < minDistance) minDistance = distance;
  }
  if (!Number.isFinite(minDistance) || minDistance > 2) return null;
  return 620 - minDistance * 20;
}

function compareRankedResults(a: PublicTitleSearchResult, b: PublicTitleSearchResult): number {
  if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
  if (Number(b.hasVerifiedReview) !== Number(a.hasVerifiedReview)) return Number(b.hasVerifiedReview) - Number(a.hasVerifiedReview);
  if (Number(b.hasReviewInProgress) !== Number(a.hasReviewInProgress)) return Number(b.hasReviewInProgress) - Number(a.hasReviewInProgress);
  if (b.releaseYear !== a.releaseYear) return b.releaseYear - a.releaseYear;
  return a.id.localeCompare(b.id);
}

function boundedLevenshtein(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return Number.POSITIVE_INFINITY;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMinimum = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + substitutionCost);
      current.push(value);
      rowMinimum = Math.min(rowMinimum, value);
    }
    if (rowMinimum > maxDistance) return Number.POSITIVE_INFINITY;
    previous = current;
  }
  return previous[b.length] > maxDistance ? Number.POSITIVE_INFINITY : previous[b.length];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
