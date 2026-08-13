import { assertAutomatedSourceUseAllowed } from "./content-source-policy.ts";
import type { PublicTitleKind } from "./public-title-search.ts";
import {
  buildCurrentSourcePolicySnapshot,
  prepareCatalogSourceProvenance,
  type CatalogSourceProvenanceRecord,
  type SourcePolicySnapshotRecord,
} from "./source-provenance.ts";

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

export interface WikidataCatalogImportRecord {
  title: WikidataCatalogTitle;
  provenance: CatalogSourceProvenanceRecord;
}

export interface WikidataCatalogImportPlan {
  source: "wikidata";
  license: "CC0 1.0";
  retrievedAt: string;
  policySnapshot: SourcePolicySnapshotRecord;
  records: WikidataCatalogImportRecord[];
  sql: string;
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

  return `SELECT ?item ?arLabel ?enLabel ?kind (MIN(?rawDate) AS ?date) (MAX(?rawSitelinks) AS ?sitelinks) WHERE {
  VALUES (?class ?kind) {
    (wd:Q11424 "movie")
    (wd:Q5398426 "series")
  }
  ?item wdt:P31 ?class .
  ?item wdt:P577 ?rawDate .
  ?item wikibase:sitelinks ?rawSitelinks .
  FILTER(YEAR(?rawDate) >= 1880 && YEAR(?rawDate) <= 2200)
  FILTER(?rawSitelinks >= 20)
  OPTIONAL {
    ?item rdfs:label ?arLabel .
    FILTER(LANG(?arLabel) = "ar")
  }
  OPTIONAL {
    ?item rdfs:label ?enLabel .
    FILTER(LANG(?enLabel) = "en")
  }
  FILTER(BOUND(?arLabel) || BOUND(?enLabel))
}
GROUP BY ?item ?arLabel ?enLabel ?kind
ORDER BY DESC(?sitelinks) ASC(?date) ?item
LIMIT ${limit}
OFFSET ${offset}`;
}

export function parseWikidataCatalogResponse(payload: unknown): WikidataCatalogTitle[] {
  assertAutomatedSourceUseAllowed("wikidata", "catalog_metadata");

  if (!isPlainObject(payload) || !isPlainObject(payload.results) || !Array.isArray(payload.results.bindings)) {
    throw new TypeError("Invalid Wikidata SPARQL response");
  }

  const titlesById = new Map<string, WikidataCatalogTitle>();
  const conflictedIds = new Set<string>();

  for (const rawBinding of payload.results.bindings) {
    if (!isPlainObject(rawBinding)) continue;
    const binding = rawBinding as SparqlBinding;
    const itemUrl = readValue(binding.item);
    const arLabel = cleanLabel(readValue(binding.arLabel));
    const enLabel = cleanLabel(readValue(binding.enLabel));
    const fallbackLabel = cleanLabel(readValue(binding.itemLabel));
    const kind = readValue(binding.kind);
    const date = readValue(binding.date);

    const entityId = itemUrl?.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/u)?.[1];
    const canonicalName = arLabel ?? enLabel ?? fallbackLabel;
    if (!entityId || !canonicalName || canonicalName === entityId || !date) continue;
    if (kind !== "movie" && kind !== "series") continue;

    const releaseYear = Number(date.slice(0, 4));
    if (!Number.isInteger(releaseYear) || releaseYear < 1880 || releaseYear > 2200) continue;

    const id = `wd:${entityId}`;
    if (conflictedIds.has(id)) continue;

    const title: WikidataCatalogTitle = {
      id,
      wikidataEntityId: entityId,
      canonicalName,
      originalName:
        arLabel && enLabel && arLabel.localeCompare(enLabel, "en", { sensitivity: "base" }) !== 0
          ? enLabel
          : null,
      kind,
      releaseYear,
      sourceUrl: `https://www.wikidata.org/wiki/${entityId}`,
      sourceLicense: "CC0 1.0",
    };

    const existing = titlesById.get(id);
    if (!existing) {
      titlesById.set(id, title);
      continue;
    }

    if (existing.kind !== title.kind) {
      titlesById.delete(id);
      conflictedIds.add(id);
    }
  }

  return [...titlesById.values()];
}

export function buildWikidataTitleUpsertSql(titles: readonly WikidataCatalogTitle[]): string {
  if (titles.length === 0) return "-- No validated Wikidata titles to import.\n";

  return titles
    .map((title) => {
      assertValidWikidataCatalogTitle(title);
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

export async function prepareWikidataCatalogImportPlan(
  titles: readonly WikidataCatalogTitle[],
  options: { retrievedAt: string },
): Promise<WikidataCatalogImportPlan> {
  if (!Array.isArray(titles) || titles.length < 1 || titles.length > 200) {
    throw new RangeError("Wikidata production import must contain between 1 and 200 titles");
  }

  const policySnapshot = buildCurrentSourcePolicySnapshot("wikidata", "catalog_metadata");
  const seen = new Set<string>();
  const records: WikidataCatalogImportRecord[] = [];

  for (const title of titles) {
    assertValidWikidataCatalogTitle(title);
    if (seen.has(title.wikidataEntityId)) {
      throw new TypeError(`Duplicate Wikidata entity in import plan: ${title.wikidataEntityId}`);
    }
    seen.add(title.wikidataEntityId);

    const contentSha256 = await hashWikidataCatalogTitle(title);
    const provenance = prepareCatalogSourceProvenance({
      id: `catalog:wikidata:${title.wikidataEntityId}:${contentSha256}`,
      titleId: title.id,
      source: "wikidata",
      sourceEntityId: title.wikidataEntityId,
      sourceUrl: title.sourceUrl,
      sourceRevision: null,
      retrievedAt: options.retrievedAt,
      contentSha256,
      ingestionMode: "automated",
    });
    records.push({ title, provenance });
  }

  return {
    source: "wikidata",
    license: "CC0 1.0",
    retrievedAt: records[0].provenance.retrievedAt,
    policySnapshot,
    records,
    sql: buildWikidataCatalogImportSql(records, policySnapshot.id),
  };
}

export function buildWikidataCatalogImportSql(
  records: readonly WikidataCatalogImportRecord[],
  expectedPolicySnapshotId: string,
): string {
  if (records.length < 1 || records.length > 200) {
    throw new RangeError("Wikidata import SQL requires between 1 and 200 records");
  }

  const statements: string[] = [
    "-- P3S-08 Wikidata catalog import: metadata + immutable provenance only.",
    "-- This file intentionally does not create title versions, reviews, approvals, or evidence publications.",
  ];

  for (const record of records) {
    assertValidWikidataCatalogTitle(record.title);
    const provenance = record.provenance;
    if (
      provenance.titleId !== record.title.id ||
      provenance.policySnapshotId !== expectedPolicySnapshotId ||
      provenance.sourceEntityId !== record.title.wikidataEntityId ||
      provenance.sourceUrl !== record.title.sourceUrl ||
      provenance.ingestionMode !== "automated"
    ) {
      throw new TypeError("Wikidata catalog title/provenance identity mismatch");
    }

    statements.push(buildWikidataTitleUpsertSql([record.title]).trim());
    statements.push(`INSERT INTO title_catalog_sources (
  id, title_id, policy_snapshot_id, source_entity_id, source_url,
  source_revision, retrieved_at, content_sha256, ingestion_mode
) VALUES (
  ${sqlString(provenance.id)},
  ${sqlString(provenance.titleId)},
  ${sqlString(provenance.policySnapshotId)},
  ${sqlString(provenance.sourceEntityId)},
  ${sqlString(provenance.sourceUrl)},
  ${provenance.sourceRevision === null ? "NULL" : sqlString(provenance.sourceRevision)},
  ${sqlString(provenance.retrievedAt)},
  ${sqlString(provenance.contentSha256)},
  'automated'
)
ON CONFLICT(policy_snapshot_id, source_entity_id, content_sha256) DO NOTHING;`);
  }

  return `${statements.join("\n\n")}\n`;
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

async function hashWikidataCatalogTitle(title: WikidataCatalogTitle): Promise<string> {
  const canonical = JSON.stringify({
    sourceEntityId: title.wikidataEntityId,
    sourceUrl: title.sourceUrl,
    sourceLicense: title.sourceLicense,
    canonicalName: title.canonicalName,
    originalName: title.originalName,
    kind: title.kind,
    releaseYear: title.releaseYear,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function assertValidWikidataCatalogTitle(title: WikidataCatalogTitle): void {
  if (!/^wd:Q\d+$/u.test(title.id) || title.id !== `wd:${title.wikidataEntityId}`) {
    throw new TypeError("Invalid Wikidata-backed title id");
  }
  if (!/^Q\d+$/u.test(title.wikidataEntityId)) throw new TypeError("Invalid Wikidata entity id");
  if (title.sourceUrl !== `https://www.wikidata.org/wiki/${title.wikidataEntityId}`) {
    throw new TypeError("Wikidata source URL must match entity id");
  }
  if (title.sourceLicense !== "CC0 1.0") throw new TypeError("Unexpected Wikidata license");
  if (!title.canonicalName.trim() || title.canonicalName.length > 500 || title.canonicalName.includes("\u0000")) {
    throw new TypeError("Invalid Wikidata canonical title");
  }
  if (
    title.originalName !== null &&
    (!title.originalName.trim() || title.originalName.length > 500 || title.originalName.includes("\u0000"))
  ) {
    throw new TypeError("Invalid Wikidata original title");
  }
  if (title.kind !== "movie" && title.kind !== "series") throw new TypeError("Invalid Wikidata title kind");
  if (!Number.isInteger(title.releaseYear) || title.releaseYear < 1880 || title.releaseYear > 2200) {
    throw new TypeError("Invalid Wikidata release year");
  }
}

function cleanLabel(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
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
