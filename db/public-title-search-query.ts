import type { ParsedPublicTitleSearchRequest } from "../lib/public-title-search.ts";

export const MAX_PUBLIC_TITLE_SEARCH_CANDIDATES = 256;
export const MAX_PUBLIC_TITLE_SQL_PREFILTER_TOKENS = 4;

export interface PublicTitleCandidateQuery {
  sql: string;
  bindings: string[];
}

const SQL_NORMALIZATION_REPLACEMENTS = [
  ["أ", "ا"], ["إ", "ا"], ["آ", "ا"], ["ٱ", "ا"], ["ى", "ي"], ["ی", "ي"], ["ؤ", "و"], ["ئ", "ي"], ["ک", "ك"], ["ۀ", "ة"],
  ["٠", "0"], ["١", "1"], ["٢", "2"], ["٣", "3"], ["٤", "4"], ["٥", "5"], ["٦", "6"], ["٧", "7"], ["٨", "8"], ["٩", "9"],
] as const;

function normalizedSqlColumn(column: string): string {
  let expression = `lower(COALESCE(${column}, ''))`;
  for (const [from, to] of SQL_NORMALIZATION_REPLACEMENTS) expression = `replace(${expression}, '${from}', '${to}')`;
  return expression;
}

function escapeLike(token: string): string {
  return token.replace(/[\\%_]/gu, (character) => `\\${character}`);
}

export function buildSqlSubsequencePattern(token: string): string {
  const characters = Array.from(token);
  return characters.length === 0 ? "%" : `%${characters.map(escapeLike).join("%")}%`;
}

export function buildPublicTitleCandidateQuery(parsed: ParsedPublicTitleSearchRequest): PublicTitleCandidateQuery {
  const predicates: string[] = [];
  const bindings: string[] = [];
  // Candidate SQL is only a bounded prefilter. Keep its bind count and LIKE complexity
  // bounded for long real-world titles; the full parsed query is still applied by the
  // deterministic ranker after candidate retrieval.
  for (const token of parsed.tokens.slice(0, MAX_PUBLIC_TITLE_SQL_PREFILTER_TOKENS)) {
    const broad = buildSqlSubsequencePattern(token);
    const anchor = `%${escapeLike(Array.from(token).slice(0, token.length >= 5 ? 2 : 1).join(""))}%`;
    predicates.push(`(canonicalSearch LIKE ? ESCAPE '\\' OR originalSearch LIKE ? ESCAPE '\\' OR aliasSearch LIKE ? ESCAPE '\\' OR canonicalSearch LIKE ? ESCAPE '\\' OR originalSearch LIKE ? ESCAPE '\\' OR aliasSearch LIKE ? ESCAPE '\\')`);
    bindings.push(broad, broad, broad, anchor, anchor, anchor);
  }
  const exact = escapeLike(parsed.normalizedQuery);
  // SQL ordering is only a candidate-order hint. Using the complete multi-word query as
  // a LIKE prefix can cross workerd/D1's LIKE complexity ceiling; one normalized token is
  // sufficient here because exact equality and the full JS ranker retain final precision.
  const prefix = `${escapeLike(parsed.tokens[0] ?? parsed.normalizedQuery)}%`;
  bindings.push(exact, exact, prefix, prefix);
  const canonical = normalizedSqlColumn("t.canonical_name");
  const original = normalizedSqlColumn("t.original_name");
  const aliases = normalizedSqlColumn("t.search_aliases_json");

  return {
    sql: `WITH searchable_titles AS (
      SELECT t.id AS id, t.canonical_name AS canonicalName, t.original_name AS originalName,
        COALESCE(t.search_aliases_json, '[]') AS aliasesJson, t.kind AS kind, t.release_year AS releaseYear,
        ${canonical} AS canonicalSearch, ${original} AS originalSearch, ${aliases} AS aliasSearch,
        (SELECT b.id FROM title_versions v
          INNER JOIN review_bundles b ON b.version_id = v.id
          INNER JOIN editorial_approvals ea ON ea.id = b.current_approval_id AND ea.bundle_id = b.id
          WHERE v.title_id = t.id AND v.status = 'active' AND b.status = 'verified'
            AND b.current_approval_id IS NOT NULL AND b.published_at IS NOT NULL AND ea.status = 'approved'
            AND NOT EXISTS (SELECT 1 FROM review_reports rr WHERE rr.bundle_id = b.id AND rr.status IN ('open', 'investigating'))
          ORDER BY b.published_at DESC, ea.approved_at DESC, b.id ASC LIMIT 1) AS verifiedBundleId,
        CASE WHEN EXISTS (SELECT 1 FROM title_versions v INNER JOIN review_bundles b ON b.version_id = v.id
          WHERE v.title_id = t.id AND v.status = 'active' AND b.status IN ('draft', 'under_review', 'conflicted'))
          THEN 1 ELSE 0 END AS hasReviewInProgress
      FROM titles t
    ), classified_titles AS (
      SELECT *, CASE WHEN verifiedBundleId IS NOT NULL THEN 1 ELSE 0 END AS hasVerifiedReview FROM searchable_titles
    ), filterable_titles AS (
      SELECT ct.*,
        CASE WHEN ct.verifiedBundleId IS NULL THEN NULL ELSE COALESCE((
          SELECT MAX(o.severity) FROM review_bundles vb
          INNER JOIN editorial_approvals vea ON vea.id = vb.current_approval_id AND vea.bundle_id = vb.id AND vea.status = 'approved'
          INNER JOIN editorial_approval_submissions eas ON eas.approval_id = vea.id
          INNER JOIN observations o ON o.submission_id = eas.submission_id
          WHERE vb.id = ct.verifiedBundleId), 0) END AS verifiedMaxSeverity
      FROM classified_titles ct
    )
    SELECT id, canonicalName, originalName, aliasesJson, kind, releaseYear, hasVerifiedReview,
      hasReviewInProgress, verifiedBundleId, verifiedMaxSeverity
    FROM filterable_titles
    WHERE ${predicates.join(" AND ")}
    ORDER BY CASE WHEN canonicalSearch = ? THEN 0 WHEN originalSearch = ? THEN 1
      WHEN canonicalSearch LIKE ? ESCAPE '\\' THEN 2 WHEN originalSearch LIKE ? ESCAPE '\\' THEN 3 ELSE 4 END ASC,
      hasVerifiedReview DESC, hasReviewInProgress DESC, releaseYear DESC, id ASC
    LIMIT ${MAX_PUBLIC_TITLE_SEARCH_CANDIDATES}`,
    bindings,
  };
}
