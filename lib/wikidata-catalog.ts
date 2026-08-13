import { assertAutomatedSourceUseAllowed } from "./content-source-policy.ts";
import type { PublicTitleKind } from "./public-title-search.ts";

export const WIKIDATA_SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
export const WIKIDATA_USER_AGENT =
  "QablAlmushahadaBot/0.1 (+https://github.com/Hosyss/qabl-almushahada)";

export interface WikidataCatalogTitle {
  id: string;
  wikidataEntityId: string;
  canonicalName: string;
  originalName: string | null;
  kind: Extract<PublicTitleKind, "movie" | "series">;
  releaseYear: number;
  sourceUrl: string;
  sourceLicense: "CC0 1.0";
}

type SparqlBindingValue = { type?: string; value?: string };
type SparqlBinding = Record<string, SparqlBindingValue | undefined>;

export function buildWikidataCatalogQuery(options: {
  limit: number;
  offset: number;
}): string {
  const { limit, offset } = options;
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new RangeError("limit must be an integer between 1 and 200");
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
    throw new RangeError("offset must be an integer between 0 and 1000000");
  }

  return `SELECT DISTINCT ?item ?itemLabel ?kind ?date WHERE {
  {
    ?item wdt:P31/wdt:P279* wd:Q11424 .
    BIND("movie" AS ?kind)
  }
  UNION
  {
    ?item wdt:P31/wdt:P279* wd:Q5398426 .
    BIND("series" AS ?kind)
  }
  ?item wdt:P577 ?date .
  FILTER(YEAR(?date) >= 1880 && YEAR(?date) <= 2200)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ar,en". }
}
ORDER BY DESC(?date) ?item
LIMIT ${limit}
OFFSET ${offset}`;
}

export function parseWikidataCatalogResponse(payload: unknown): WikidataCatalogTitle[] {
  assertAutomatedSourceUseAllowed("wikidata", "catalog_metadata");

  if (!isPlainObject(payload) || !isPlainObject(payload.results) || !Array.isArray(payload.results.bindings)) {
    throw new TypeError("Invalid Wikidata SPARQL response");
  }

  const seen = new Set<string>();
  const titles: WikidataCatalogTitle[] = [];

  for (const rawBinding of payload.results.bindings) {
    if (!isPlainObject(rawBinding)) continue;
    const binding = rawBinding as SparqlBinding;
    const itemUrl = readValue(binding.item);
    const label = readValue(binding.itemLabel)?.trim();
    const kind = readValue(binding.kind);
    const date = readValue(binding.date);

    const entityId = itemUrl?.match(/^https:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/u)?.[1];
    if (!entityId || !label || label === entityId || !date) continue;
    if (kind !== "movie" && kind !== "series") continue;

    const releaseYear = Number(date.slice(0, 4));
    if (!Number.isInteger(releaseYear) || releaseYear < 1880 || releaseYear > 2200) continue;

    const id = `wd:${entityId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    titles.push({
      id,
      wikidataEntityId: entityId,
      canonicalName: label,
      originalName: null,
      kind,
      releaseYear,
      sourceUrl: `https://www.wikidata.org/wiki/${entityId}`,
      sourceLicense: "CC0 1.0",
    });
  }

  return titles;
}

export function buildWikidataTitleUpsertSql(titles: readonly WikidataCatalogTitle[]): string {
  if (titles.length === 0) return "-- No validated Wikidata titles to import.\n";

  return titles
    .map((title) => {
      if (!/^wd:Q\d+$/u.test(title.id)) throw new TypeError("Invalid Wikidata-backed title id");
      if (title.sourceLicense !== "CC0 1.0") throw new TypeError("Unexpected Wikidata license");
      const canonicalName = sqlString(title.canonicalName);
      const originalName = title.originalName === null ? "NULL" : sqlString(title.originalName);
      return `INSERT INTO titles (id, canonical_name, original_name, kind, release_year)
VALUES (${sqlString(title.id)}, ${canonicalName}, ${originalName}, ${sqlString(title.kind)}, ${title.releaseYear})
ON CONFLICT(id) DO UPDATE SET
  canonical_name = excluded.canonical_name,
  original_name = excluded.original_name,
  kind = excluded.kind,
  release_year = excluded.release_year,
  updated_at = CURRENT_TIMESTAMP;`;
    })
    .join("\n\n") + "\n";
}

export async function fetchWikidataCatalogPage(options: {
  limit?: number;
  offset?: number;
  fetchImpl?: typeof fetch;
} = {}): Promise<WikidataCatalogTitle[]> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  const fetchImpl = options.fetchImpl ?? fetch;
  const query = buildWikidataCatalogQuery({ limit, offset });
  const url = new URL(WIKIDATA_SPARQL_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");

  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/sparql-results+json, application/json;q=0.9",
      "Accept-Encoding": "gzip",
      "User-Agent": WIKIDATA_USER_AGENT,
    },
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      `Wikidata request failed with ${response.status}${retryAfter ? `; retry-after=${retryAfter}` : ""}`,
    );
  }

  return parseWikidataCatalogResponse(await response.json());
}

function readValue(value: SparqlBindingValue | undefined): string | undefined {
  return typeof value?.value === "string" ? value.value : undefined;
}

function sqlString(value: string): string {
  if (value.includes("\u0000")) throw new TypeError("SQL text cannot contain NUL");
  return `'${value.replaceAll("'", "''")}'`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
