import {
  escapeSqlLikeToken,
  type ParsedPublicTitleSearchRequest,
} from "../lib/public-title-search.ts";

export const MAX_PUBLIC_TITLE_SEARCH_CANDIDATES = 256;

export interface PublicTitleCandidateQuery {
  sql: string;
  bindings: string[];
}

const SQL_NORMALIZATION_REPLACEMENTS = [
  ["أ", "ا"],
  ["إ", "ا"],
  ["آ", "ا"],
  ["ٱ", "ا"],
  ["ى", "ي"],
  ["ؤ", "و"],
  ["ئ", "ي"],
  ["٠", "0"],
  ["١", "1"],
  ["٢", "2"],
  ["٣", "3"],
  ["٤", "4"],
  ["٥", "5"],
  ["٦", "6"],
  ["٧", "7"],
  ["٨", "8"],
  ["٩", "9"],
  ["۰", "0"],
  ["۱", "1"],
  ["۲", "2"],
  ["۳", "3"],
  ["۴", "4"],
  ["۵", "5"],
  ["۶", "6"],
  ["۷", "7"],
  ["۸", "8"],
  ["۹", "9"],
] as const;

function normalizedSqlColumn(column: string): string {
  let expression = `lower(COALESCE(${column}, ''))`;
  for (const [from, to] of SQL_NORMALIZATION_REPLACEMENTS) {
    expression = `replace(${expression}, '${from}', '${to}')`;
  }
  return expression;
}

export function buildSqlSubsequencePattern(token: string): string {
  const characters = Array.from(token);
  if (characters.length === 0) return "%";
  return `%${characters.map(escapeSqlLikeToken).join("%")}%`;
}

export function buildPublicTitleCandidateQuery(
  parsed: ParsedPublicTitleSearchRequest,
): PublicTitleCandidateQuery {
  const tokenPredicates: string[] = [];
  const bindings: string[] = [];

  for (const token of parsed.tokens) {
    const pattern = buildSqlSubsequencePattern(token);
    tokenPredicates.push(
      `(canonicalSearch LIKE ? ESCAPE '\\' OR originalSearch LIKE ? ESCAPE '\\')`,
    );
    bindings.push(pattern, pattern);
  }

  const exact = escapeSqlLikeToken(parsed.normalizedQuery);
  const prefix = `${exact}%`;
  bindings.push(exact, exact, prefix, prefix);

  const canonicalExpression = normalizedSqlColumn("t.canonical_name");
  const originalExpression = normalizedSqlColumn("t.original_name");

  return {
    sql: `WITH searchable_titles AS (
      SELECT
        t.id AS id,
        t.canonical_name AS canonicalName,
        t.original_name AS originalName,
        t.kind AS kind,
        t.release_year AS releaseYear,
        ${canonicalExpression} AS canonicalSearch,
        ${originalExpression} AS originalSearch,
        CASE WHEN EXISTS (
          SELECT 1
          FROM title_versions v
          INNER JOIN review_bundles b ON b.version_id = v.id
          WHERE v.title_id = t.id
            AND v.status = 'active'
            AND b.status = 'verified'
            AND b.current_approval_id IS NOT NULL
        ) THEN 1 ELSE 0 END AS hasVerifiedReview,
        CASE WHEN EXISTS (
          SELECT 1
          FROM title_versions v
          INNER JOIN review_bundles b ON b.version_id = v.id
          WHERE v.title_id = t.id
            AND v.status = 'active'
            AND b.status IN ('draft', 'under_review', 'conflicted')
        ) THEN 1 ELSE 0 END AS hasReviewInProgress
      FROM titles t
    )
    SELECT id, canonicalName, originalName, kind, releaseYear, hasVerifiedReview, hasReviewInProgress
    FROM searchable_titles
    WHERE ${tokenPredicates.join(" AND ")}
    ORDER BY
      CASE
        WHEN canonicalSearch = ? THEN 0
        WHEN originalSearch = ? THEN 1
        WHEN canonicalSearch LIKE ? ESCAPE '\\' THEN 2
        WHEN originalSearch LIKE ? ESCAPE '\\' THEN 3
        ELSE 4
      END ASC,
      hasVerifiedReview DESC,
      hasReviewInProgress DESC,
      releaseYear DESC,
      id ASC
    LIMIT ${MAX_PUBLIC_TITLE_SEARCH_CANDIDATES}`,
    bindings,
  };
}
