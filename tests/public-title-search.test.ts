import assert from "node:assert/strict";
import test from "node:test";

import { filterPublicTitleSearchResults, parsePublicSearchFilters } from "../lib/public-search-filters.ts";
import {
  MAX_PUBLIC_TITLE_DID_YOU_MEAN_RESULTS,
  MAX_PUBLIC_TITLE_SEARCH_RESULTS,
  formatPublicTitleSuggestionLabel,
  normalizePublicTitleSearchText,
  parsePublicTitleSearchRequest,
  rankPublicTitleSearchCandidates,
  rankPublicTitleSearchDiscovery,
  type PublicTitleSearchCandidate,
  type PublicTitleSearchResult,
} from "../lib/public-title-search.ts";
import {
  MAX_PUBLIC_TITLE_SEARCH_CANDIDATES,
  MAX_PUBLIC_TITLE_SQL_ORDER_PREFIX_CHARS,
  MAX_PUBLIC_TITLE_SQL_PREFILTER_TOKENS,
  buildPublicTitleCandidateQuery,
  buildSqlOrderPrefixPattern,
  buildSqlSubsequencePattern,
} from "../db/public-title-search-query.ts";

const HARRY: PublicTitleSearchCandidate = {
  id: "wd:Q102438",
  canonicalName: "هاري بوتر وحجر الفيلسوف",
  originalName: "Harry Potter and the Philosopher's Stone",
  aliases: ["HarryPotter", "Harry Potter and the Sorcerer's Stone"],
  kind: "movie",
  releaseYear: 2001,
  hasVerifiedReview: false,
  hasReviewInProgress: false,
  verifiedBundleId: null,
  verifiedMaxSeverity: null,
};

const NEMO: PublicTitleSearchCandidate = {
  id: "wd:Q123456",
  canonicalName: "البحث عن نيمو",
  originalName: "Finding Nemo",
  aliases: [],
  kind: "movie",
  releaseYear: 2003,
  hasVerifiedReview: false,
  hasReviewInProgress: false,
  verifiedBundleId: null,
  verifiedMaxSeverity: null,
};

const SPIDER: PublicTitleSearchCandidate = {
  id: "wd:Q68934496",
  canonicalName: "الرجل العنكبوت: لا طريق للوطن",
  originalName: "Spider-Man: No Way Home",
  aliases: [],
  kind: "movie",
  releaseYear: 2021,
  hasVerifiedReview: false,
  hasReviewInProgress: false,
  verifiedBundleId: null,
  verifiedMaxSeverity: null,
};

function discover(query: string, candidates: readonly PublicTitleSearchCandidate[] = [HARRY, NEMO]) {
  return rankPublicTitleSearchDiscovery(parsePublicTitleSearchRequest({ query }), candidates);
}

test("Arabic normalization handles diacritics, tatweel, punctuation, hamza and common letter variants", () => {
  assert.equal(normalizePublicTitleSearchText("إِنْسَايْد—آوْت ٢"), "انسايد اوت 2");
  assert.equal(normalizePublicTitleSearchText("هــارى بُوتر"), "هاري بوتر");
});

test("Latin normalization is case-insensitive and punctuation-neutral", () => {
  assert.equal(normalizePublicTitleSearchText("Finding_NEMO: Part Ⅱ"), "finding nemo part ii");
  assert.equal(normalizePublicTitleSearchText("HARRY-POTTER"), "harry potter");
});

test("public search request rejects empty, tiny, overlong, extra-field and over-tokenized queries", () => {
  assert.equal(parsePublicTitleSearchRequest({ query: " هاري بوتر " }).normalizedQuery, "هاري بوتر");
  assert.throws(() => parsePublicTitleSearchRequest("هاري"));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "ه" }));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "هاري", extra: true }));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "x".repeat(161) }));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "1 2 3 4 5 6 7 8 9" }));
});

test("HarryPotter becomes did-you-mean, not a confirmed direct result", () => {
  const result = discover("HarryPotter");
  assert.deepEqual(result.matches, []);
  assert.equal(result.didYouMean[0]?.id, HARRY.id);
  assert.equal(result.didYouMean[0]?.matchKind, "alias_exact");
});

test("harry potter is a direct English prefix match", () => {
  const result = discover("harry potter");
  assert.equal(result.matches[0]?.id, HARRY.id);
  assert.equal(result.matches[0]?.matchKind, "original_prefix");
});

test("Hary Poter remains a conservative fuzzy suggestion", () => {
  const result = discover("Hary Poter");
  assert.deepEqual(result.matches, []);
  assert.equal(result.didYouMean[0]?.id, HARRY.id);
  assert.equal(result.didYouMean[0]?.matchKind, "fuzzy_match");
});

test("هاريبوتر compact Arabic input suggests Harry Potter", () => {
  const result = discover("هاريبوتر");
  assert.deepEqual(result.matches, []);
  assert.equal(result.didYouMean[0]?.id, HARRY.id);
});

test("هارى بوتر normalizes to a direct Arabic prefix match", () => {
  const result = discover("هارى بوتر");
  assert.equal(result.matches[0]?.id, HARRY.id);
  assert.equal(result.matches[0]?.matchKind, "canonical_prefix");
});

test("a small Arabic typo is suggested but not promoted", () => {
  const result = discover("هاري بوتر وحجر الفلسوف");
  assert.deepEqual(result.matches, []);
  assert.equal(result.didYouMean[0]?.id, HARRY.id);
  assert.equal(result.didYouMean[0]?.matchKind, "fuzzy_match");
});

test("Spider-Man full Arabic title keeps five ranking tokens while SQL LIKE ordering stays bounded", () => {
  const parsed = parsePublicTitleSearchRequest({ query: SPIDER.canonicalName });
  assert.equal(parsed.tokens.length, 5);
  const query = buildPublicTitleCandidateQuery(parsed);
  assert.equal(MAX_PUBLIC_TITLE_SQL_PREFILTER_TOKENS, 4);
  assert.equal(MAX_PUBLIC_TITLE_SQL_ORDER_PREFIX_CHARS, 12);
  assert.equal(query.bindings.length, 28);
  assert.equal(query.sql.split("?").length - 1, query.bindings.length);
  assert.equal(query.bindings[24], parsed.normalizedQuery);
  assert.equal(query.bindings[25], parsed.normalizedQuery);
  assert.equal(query.bindings[26], buildSqlOrderPrefixPattern(parsed.normalizedQuery));
  assert.equal(query.bindings[27], buildSqlOrderPrefixPattern(parsed.normalizedQuery));
  assert.notEqual(query.bindings[26], `${parsed.normalizedQuery}%`);
  assert.ok(Array.from(query.bindings[26]).length <= MAX_PUBLIC_TITLE_SQL_ORDER_PREFIX_CHARS + 1);

  const result = rankPublicTitleSearchDiscovery(parsed, [SPIDER]);
  assert.equal(result.matches[0]?.id, SPIDER.id);
  assert.equal(result.matches[0]?.matchKind, "canonical_exact");
});

test("Spider-Man English title matches exactly with punctuation", () => {
  const result = discover("Spider-Man: No Way Home", [SPIDER]);
  assert.equal(result.matches[0]?.id, SPIDER.id);
  assert.equal(result.matches[0]?.matchKind, "original_exact");
});

test("Spider-Man English title matches exactly without punctuation", () => {
  const result = discover("Spider Man No Way Home", [SPIDER]);
  assert.equal(result.matches[0]?.id, SPIDER.id);
  assert.equal(result.matches[0]?.matchKind, "original_exact");
});

test("five-or-more-token queries are decided by the complete ranker query", () => {
  const exact = discover("الرجل العنكبوت لا طريق للوطن", [SPIDER]);
  assert.equal(exact.matches[0]?.id, SPIDER.id);
  assert.equal(exact.matches[0]?.matchKind, "canonical_exact");

  const wrongTail = discover("الرجل العنكبوت لا طريق مختلف", [SPIDER]);
  assert.deepEqual(wrongTail.matches, []);
  assert.deepEqual(wrongTail.didYouMean, []);
});

test("a long unrelated query never promotes Spider-Man from a broad SQL candidate set", () => {
  const result = discover("فيلم عشوائي طويل جدا لا يخص الرجل", [SPIDER]);
  assert.deepEqual(result.matches, []);
  assert.deepEqual(result.didYouMean, []);
});

test("a distant title is not suggested", () => {
  const result = discover("مهمة مستحيلة");
  assert.deepEqual(result.matches, []);
  assert.deepEqual(result.didYouMean, []);
});

test("a title absent from D1 candidates can never be invented", () => {
  const result = discover("HarryPotter", [NEMO]);
  assert.deepEqual(result.matches, []);
  assert.deepEqual(result.didYouMean, []);
});

test("D1 alias matches directly and labels include Arabic, English and year", () => {
  const result = discover("Harry Potter and the Sorcerer's Stone");
  assert.equal(result.matches[0]?.id, HARRY.id);
  assert.equal(result.matches[0]?.matchKind, "alias_exact");
  assert.equal(formatPublicTitleSuggestionLabel(HARRY), "هاري بوتر وحجر الفيلسوف — Harry Potter and the Philosopher's Stone (2001)");
});

test("exact canonical match outranks a verified prefix match", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "نيمو" });
  const results = rankPublicTitleSearchCandidates(parsed, [
    { ...NEMO, id: "prefix", canonicalName: "نيمو يعود", originalName: null, hasVerifiedReview: true, verifiedBundleId: "bundle-prefix", verifiedMaxSeverity: 2 },
    { ...NEMO, id: "exact", canonicalName: "نيمو", originalName: "Nemo" },
  ]);
  assert.equal(results[0]?.id, "exact");
});

test("direct and suggested result sets are capped", () => {
  const direct = Array.from({ length: 20 }, (_, index): PublicTitleSearchCandidate => ({ ...NEMO, id: `title-${index}`, canonicalName: `فيلم ${index}`, originalName: null }));
  assert.equal(rankPublicTitleSearchCandidates(parsePublicTitleSearchRequest({ query: "فيلم" }), direct).length, MAX_PUBLIC_TITLE_SEARCH_RESULTS);
  const fuzzy = Array.from({ length: 10 }, (_, index): PublicTitleSearchCandidate => ({ ...HARRY, id: `harry-${index}`, releaseYear: 2001 + index }));
  assert.equal(rankPublicTitleSearchDiscovery(parsePublicTitleSearchRequest({ query: "Hary Poter" }), fuzzy).didYouMean.length, MAX_PUBLIC_TITLE_DID_YOU_MEAN_RESULTS);
});

test("public filters accept only known values", () => {
  assert.deepEqual(parsePublicSearchFilters({ kind: "series", age: "11", status: "verified" }), { kind: "series", age: 11, status: "verified" });
  assert.deepEqual(parsePublicSearchFilters({ kind: "unknown", age: "12", status: "pending" }), { kind: "all", age: null, status: "all" });
});

test("age filtering uses only verified severity evidence", () => {
  const base = { aliases: [], matchConfidence: "direct" as const, matchScore: 900 };
  const results: PublicTitleSearchResult[] = [
    { ...base, id: "gentle", canonicalName: "فيلم هادئ", originalName: null, kind: "movie", releaseYear: 2026, hasVerifiedReview: true, hasReviewInProgress: false, verifiedBundleId: "bundle-gentle", verifiedMaxSeverity: 1, matchKind: "canonical_prefix" },
    { ...base, id: "strong", canonicalName: "مسلسل أقوى", originalName: null, kind: "series", releaseYear: 2026, hasVerifiedReview: true, hasReviewInProgress: false, verifiedBundleId: "bundle-strong", verifiedMaxSeverity: 3, matchKind: "canonical_contains" },
    { ...base, id: "catalog", canonicalName: "فيلم بلا مراجعة", originalName: null, kind: "movie", releaseYear: 2025, hasVerifiedReview: false, hasReviewInProgress: false, verifiedBundleId: null, verifiedMaxSeverity: null, matchKind: "token_match" },
  ];
  assert.deepEqual(filterPublicTitleSearchResults(results, { kind: "all", age: 8, status: "all" }).map((item) => item.id), ["gentle"]);
  assert.deepEqual(filterPublicTitleSearchResults(results, { kind: "all", age: 14, status: "verified" }).map((item) => item.id), ["gentle", "strong"]);
  assert.deepEqual(filterPublicTitleSearchResults(results, { kind: "movie", age: null, status: "catalog_only" }).map((item) => item.id), ["catalog"]);
});

test("candidate SQL stays parameterized, includes D1 aliases and exact approval evidence", () => {
  const candidateQuery = buildPublicTitleCandidateQuery(parsePublicTitleSearchRequest({ query: "هاري potter" }));
  assert.equal(candidateQuery.sql.includes("هاري"), false);
  assert.equal(candidateQuery.sql.includes("potter"), false);
  assert.match(candidateQuery.sql, /search_aliases_json/);
  assert.match(candidateQuery.sql, /LIMIT 256$/);
  assert.match(candidateQuery.sql, /b\.status = 'verified'/);
  assert.match(candidateQuery.sql, /b\.current_approval_id IS NOT NULL/);
  assert.match(candidateQuery.sql, /ea\.status = 'approved'/);
  assert.match(candidateQuery.sql, /SELECT MAX\(o\.severity\)/);
  assert.equal(candidateQuery.bindings.length, 16);
  assert.equal(candidateQuery.bindings[0], buildSqlSubsequencePattern("هاري"));
  assert.equal(candidateQuery.bindings[6], buildSqlSubsequencePattern("potter"));
  assert.equal(candidateQuery.sql.split("?").length - 1, candidateQuery.bindings.length);
  assert.equal(MAX_PUBLIC_TITLE_SEARCH_CANDIDATES, 256);
});
