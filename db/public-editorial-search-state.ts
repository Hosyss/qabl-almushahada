import { env } from "cloudflare:workers";

export interface PublicEditorialSearchState {
  titleId: string;
  publicationId: string;
  titleAr: string;
  titleEn: string;
}

const MAX_SEARCH_EDITORIAL_TITLES = 13;

export async function loadPublicEditorialSearchStates(titleIds: readonly string[]): Promise<Map<string, PublicEditorialSearchState>> {
  const unique = [...new Set(titleIds)];
  if (unique.length === 0) return new Map();
  if (unique.length > MAX_SEARCH_EDITORIAL_TITLES) throw new RangeError("Too many editorial search-state title ids");
  for (const titleId of unique) {
    if (!/^wd:Q\d{1,12}$/u.test(titleId)) throw new TypeError("Invalid editorial search-state title id");
  }

  const database = (env as unknown as { DB?: D1Database }).DB;
  if (!database) throw new Error("Public D1 binding is unavailable");
  const placeholders = unique.map(() => "?").join(",");
  const response = await database.prepare(`
    SELECT h.title_id AS titleId, r.public_id AS publicationId, r.title_ar AS titleAr, r.title_en AS titleEn
    FROM editorial_publication_heads h
    INNER JOIN editorial_publication_revisions r
      ON r.id = h.current_revision_id
      AND r.title_id = h.title_id
      AND r.public_id = h.public_id
      AND r.revision = h.revision
    WHERE h.title_id IN (${placeholders})
      AND r.publication_state = 'published'
      AND r.decision_status = 'insufficient_data'
      AND r.decision_eligible = 0
    ORDER BY h.title_id ASC
  `).bind(...unique).all<PublicEditorialSearchState>();

  const rows = Array.isArray(response.results) ? response.results : [];
  return new Map(rows.map((row) => [row.titleId, row]));
}
