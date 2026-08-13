import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPublicTitleSearchResults,
  parsePublicSearchFilters,
} from "../lib/public-search-filters.ts";
import {
  MAX_PUBLIC_TITLE_SEARCH_RESULTS,
  normalizePublicTitleSearchText,
  parsePublicTitleSearchRequest,
  rankPublicTitleSearchCandidates,
  type PublicTitleSearchResult,
} from "../lib/public-title-search.ts";
import {
  MAX_PUBLIC_TITLE_SEARCH_CANDIDATES,
  buildPublicTitleCandidateQuery,
  buildSqlSubsequencePattern,
} from "../db/public-title-search-query.ts";

test("Arabic title normalization removes diacritics, tatweel, punctuation and digit variants", () => {
  assert.equal(normalizePublicTitleSearchText("إِنْسَايْد—آوْت ٢"), "انسايد اوت 2");
  assert.equal(normalizePublicTitleSearchText("  مُدُنــى، ۲۰۲٦  "), "مدني 2026");
});

test("original Latin title normalization is case-insensitive and NFKC stable", () => {
  assert.equal(normalizePublicTitleSearchText("Finding_NEMO: Part Ⅱ"), "finding nemo part ii");
});

test("public search request accepts only a bounded query field", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "  البحث عن نيمو  " });
  assert.equal(parsed.normalizedQuery, "البحث عن نيمو");
  assert.deepEqual(parsed.tokens, ["البحث", "عن", "نيمو"]);

  assert.throws(() => parsePublicTitleSearchRequest("نيمو"));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "ن" }));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "نيمو", extra: true }));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "x".repeat(81) }));
  assert.throws(() => parsePublicTitleSearchRequest({ query: "1 2 3 4 5 6 7 8 9" }));
});

test("exact canonical match outranks a verified prefix match", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "نيمو" });
  const results = rankPublicTitleSearchCandidates(parsed, [
    {
      id: "verified-prefix",
      canonicalName: "نيمو يعود",
      originalName: null,
      kind: "movie",
      releaseYear: 2026,
      hasVerifiedReview: true,
      hasReviewInProgress: false,
      verifiedBundleId: "bundle-verified-prefix",
      verifiedMaxSeverity: 2,
    },
    {
      id: "exact",
      canonicalName: "نيمو",
      originalName: "Nemo",
      kind: "movie",
      releaseYear: 2003,
      hasVerifiedReview: false,
      hasReviewInProgress: false,
      verifiedBundleId: null,
      verifiedMaxSeverity: null,
    },
  ]);
  assert.equal(results[0]?.id, "exact");
  assert.equal(results[0]?.matchKind, "canonical_exact");
});

test("original-name exact match works for English searches and keeps the exact bundle locator", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "finding nemo" });
  const results = rankPublicTitleSearchCandidates(parsed, [
    {
      id: "nemo",
      canonicalName: "البحث عن نيمو",
      originalName: "Finding Nemo",
      kind: "movie",
      releaseYear: 2003,
      hasVerifiedReview: true,
      hasReviewInProgress: false,
      verifiedBundleId: "bundle-nemo-ar",
      verifiedMaxSeverity: 1,
    },
  ]);
  assert.equal(results[0]?.id, "nemo");
  assert.equal(results[0]?.matchKind, "original_exact");
  assert.equal(results[0]?.verifiedBundleId, "bundle-nemo-ar");
  assert.equal(results[0]?.verifiedMaxSeverity, 1);
});

test("token matching can span canonical and original names without inventing fuzzy similarity", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "نيمو finding" });
  const results = rankPublicTitleSearchCandidates(parsed, [
    {
      id: "nemo",
      canonicalName: "البحث عن نيمو",
      originalName: "Finding Nemo",
      kind: "movie",
      releaseYear: 2003,
      hasVerifiedReview: true,
      hasReviewInProgress: false,
      verifiedBundleId: "bundle-nemo-ar",
      verifiedMaxSeverity: 1,
    },
    {
      id: "other",
      canonicalName: "رحلة بحرية",
      originalName: "Finding Dory",
      kind: "movie",
      releaseYear: 2016,
      hasVerifiedReview: true,
      hasReviewInProgress: false,
      verifiedBundleId: "bundle-dory-ar",
      verifiedMaxSeverity: 2,
    },
  ]);
  assert.deepEqual(results.map((item) => item.id), ["nemo"]);
  assert.equal(results[0]?.matchKind, "token_match");
});

test("public ranking is deterministically capped", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "فيلم" });
  const candidates = Array.from({ length: 20 }, (_, index) => ({
    id: `title-${index}`,
    canonicalName: `فيلم ${index}`,
    originalName: null,
    kind: "movie" as const,
    releaseYear: 2000 + index,
    hasVerifiedReview: false,
    hasReviewInProgress: false,
    verifiedBundleId: null,
    verifiedMaxSeverity: null,
  }));
  const results = rankPublicTitleSearchCandidates(parsed, candidates);
  assert.equal(results.length, MAX_PUBLIC_TITLE_SEARCH_RESULTS);
});

test("public filters accept only known kind, age-band and verification values", () => {
  assert.deepEqual(
    parsePublicSearchFilters({ kind: "series", age: "11", status: "verified" }),
    { kind: "series", age: 11, status: "verified" },
  );
  assert.deepEqual(
    parsePublicSearchFilters({ kind: "unknown", age: "12", status: "pending" }),
    { kind: "all", age: null, status: "all" },
  );
  assert.deepEqual(
    parsePublicSearchFilters({ kind: ["movie"], age: ["8"], status: ["verified"] }),
    { kind: "all", age: null, status: "all" },
  );
});

test("age filtering uses only verified severity evidence and preserves search ranking", () => {
  const results: PublicTitleSearchResult[] = [
    {
      id: "gentle-movie",
      canonicalName: "فيلم هادئ",
      originalName: null,
      kind: "movie",
      releaseYear: 2026,
      hasVerifiedReview: true,
      hasReviewInProgress: false,
      verifiedBundleId: "bundle-gentle",
      verifiedMaxSeverity: 1,
      matchKind: "canonical_prefix",
    },
    {
      id: "strong-series",
      canonicalName: "مسلسل أقوى",
      originalName: null,
      kind: "series",
      releaseYear: 2026,
      hasVerifiedReview: true,
      hasReviewInProgress: false,
      verifiedBundleId: "bundle-strong",
      verifiedMaxSeverity: 3,
      matchKind: "canonical_contains",
    },
    {
      id: "catalog-movie",
      canonicalName: "فيلم بلا مراجعة",
      originalName: null,
      kind: "movie",
      releaseYear: 2025,
      hasVerifiedReview: false,
      hasReviewInProgress: false,
      verifiedBundleId: null,
      verifiedMaxSeverity: null,
      matchKind: "token_match",
    },
  ];

  const ageEight = filterPublicTitleSearchResults(results, {
    kind: "all",
    age: 8,
    status: "all",
  });
  assert.deepEqual(ageEight.map((item) => item.id), ["gentle-movie"]);

  const ageFourteen = filterPublicTitleSearchResults(results, {
    kind: "all",
    age: 14,
    status: "verified",
  });
  assert.deepEqual(ageFourteen.map((item) => item.id), ["gentle-movie", "strong-series"]);

  const catalogMovies = filterPublicTitleSearchResults(results, {
    kind: "movie",
    age: null,
    status: "catalog_only",
  });
  assert.deepEqual(catalogMovies.map((item) => item.id), ["catalog-movie"]);
});

test("candidate SQL stays parameterized and derives age evidence from the exact current approval", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "نيمو finding" });
  const candidateQuery = buildPublicTitleCandidateQuery(parsed);

  assert.equal(candidateQuery.sql.includes("نيمو"), false);
  assert.equal(candidateQuery.sql.includes("finding"), false);
  assert.match(candidateQuery.sql, /LIMIT 256$/);
  assert.match(candidateQuery.sql, /v\.status = 'active'/);
  assert.match(candidateQuery.sql, /b\.status = 'verified'/);
  assert.match(candidateQuery.sql, /b\.current_approval_id IS NOT NULL/);
  assert.match(candidateQuery.sql, /b\.published_at IS NOT NULL/);
  assert.match(candidateQuery.sql, /ea\.status = 'approved'/);
  assert.match(candidateQuery.sql, /rr\.status IN \('open', 'investigating'\)/);
  assert.match(candidateQuery.sql, /AS verifiedBundleId/);
  assert.match(candidateQuery.sql, /editorial_approval_submissions eas/);
  assert.match(candidateQuery.sql, /vea\.id = vb\.current_approval_id/);
  assert.match(candidateQuery.sql, /SELECT MAX\(o\.severity\)/);
  assert.match(candidateQuery.sql, /AS verifiedMaxSeverity/);
  assert.match(candidateQuery.sql, /ORDER BY b\.published_at DESC, ea\.approved_at DESC, b\.id ASC/);
  assert.match(candidateQuery.sql, /b\.status IN \('draft', 'under_review', 'conflicted'\)/);
  assert.equal(candidateQuery.bindings.length, 8);
  assert.equal(candidateQuery.bindings[0], buildSqlSubsequencePattern("نيمو"));
  assert.equal(candidateQuery.bindings[1], buildSqlSubsequencePattern("نيمو"));
  assert.equal(candidateQuery.bindings[2], buildSqlSubsequencePattern("finding"));
  assert.equal(candidateQuery.bindings[3], buildSqlSubsequencePattern("finding"));
  assert.equal(MAX_PUBLIC_TITLE_SEARCH_CANDIDATES, 256);
});

test("SQL-like wildcard characters are never interpolated into candidate SQL", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "نيمو' OR 1=1 --" });
  const candidateQuery = buildPublicTitleCandidateQuery(parsed);
  assert.equal(candidateQuery.sql.includes("OR 1=1"), false);
  assert.ok(candidateQuery.bindings.every((binding) => typeof binding === "string"));
});
