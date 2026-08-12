import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PUBLIC_TITLE_SEARCH_RESULTS,
  normalizePublicTitleSearchText,
  parsePublicTitleSearchRequest,
  rankPublicTitleSearchCandidates,
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
    },
    {
      id: "exact",
      canonicalName: "نيمو",
      originalName: "Nemo",
      kind: "movie",
      releaseYear: 2003,
      hasVerifiedReview: false,
      hasReviewInProgress: false,
    },
  ]);
  assert.equal(results[0]?.id, "exact");
  assert.equal(results[0]?.matchKind, "canonical_exact");
});

test("original-name exact match works for English searches", () => {
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
    },
  ]);
  assert.equal(results[0]?.id, "nemo");
  assert.equal(results[0]?.matchKind, "original_exact");
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
    },
    {
      id: "other",
      canonicalName: "رحلة بحرية",
      originalName: "Finding Dory",
      kind: "movie",
      releaseYear: 2016,
      hasVerifiedReview: true,
      hasReviewInProgress: false,
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
  }));
  const results = rankPublicTitleSearchCandidates(parsed, candidates);
  assert.equal(results.length, MAX_PUBLIC_TITLE_SEARCH_RESULTS);
});

test("candidate SQL remains parameterized, bounded and distinguishes review progress", () => {
  const parsed = parsePublicTitleSearchRequest({ query: "نيمو finding" });
  const candidateQuery = buildPublicTitleCandidateQuery(parsed);

  assert.equal(candidateQuery.sql.includes("نيمو"), false);
  assert.equal(candidateQuery.sql.includes("finding"), false);
  assert.match(candidateQuery.sql, /LIMIT 256$/);
  assert.match(candidateQuery.sql, /v\.status = 'active'/);
  assert.match(candidateQuery.sql, /b\.status = 'verified'/);
  assert.match(candidateQuery.sql, /b\.current_approval_id IS NOT NULL/);
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
