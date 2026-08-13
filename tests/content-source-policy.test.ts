import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTENT_SOURCE_POLICIES,
  assertAutomatedSourceUseAllowed,
} from "../lib/content-source-policy.ts";
import {
  buildWikidataCatalogQuery,
  buildWikidataTitleUpsertSql,
  parseWikidataCatalogResponse,
  WIKIDATA_USER_AGENT,
} from "../lib/wikidata-catalog.ts";

test("commercial source policy allows only Wikidata automated catalog ingestion initially", () => {
  const automated = Object.values(CONTENT_SOURCE_POLICIES)
    .filter((policy) => policy.automatedIngestion)
    .map((policy) => policy.key);
  assert.deepEqual(automated, ["wikidata"]);
  assert.equal(assertAutomatedSourceUseAllowed("wikidata", "catalog_metadata").licenseLabel, "CC0 1.0");
});

test("commercially restricted or attribution-incomplete sources fail closed for automation", () => {
  assert.throws(() => assertAutomatedSourceUseAllowed("tmdb", "catalog_metadata"), /not allowed/i);
  assert.throws(() => assertAutomatedSourceUseAllowed("imdb", "catalog_metadata"), /not allowed/i);
  assert.throws(() => assertAutomatedSourceUseAllowed("wikipedia", "analysis_evidence"), /not allowed/i);
  assert.throws(() => assertAutomatedSourceUseAllowed("wikimediaCommons", "media"), /not allowed/i);
});

test("Wikidata query is bounded and identifies the bot", () => {
  const query = buildWikidataCatalogQuery({ limit: 50, offset: 100 });
  assert.match(query, /LIMIT 50/);
  assert.match(query, /OFFSET 100/);
  assert.match(query, /wikibase:language "ar,en"/);
  assert.match(WIKIDATA_USER_AGENT, /QablAlmushahadaBot/);
  assert.throws(() => buildWikidataCatalogQuery({ limit: 201, offset: 0 }), /limit/);
  assert.throws(() => buildWikidataCatalogQuery({ limit: 10, offset: -1 }), /offset/);
});

test("Wikidata parser accepts only bounded movie/series facts and keeps source provenance", () => {
  const parsed = parseWikidataCatalogResponse({
    results: {
      bindings: [
        {
          item: { value: "https://www.wikidata.org/entity/Q123" },
          itemLabel: { value: "فيلم تجريبي" },
          kind: { value: "movie" },
          date: { value: "2025-01-01T00:00:00Z" },
        },
        {
          item: { value: "https://www.wikidata.org/entity/Q123" },
          itemLabel: { value: "Duplicate" },
          kind: { value: "movie" },
          date: { value: "2025-01-01T00:00:00Z" },
        },
        {
          item: { value: "https://www.wikidata.org/entity/Q999" },
          itemLabel: { value: "Q999" },
          kind: { value: "series" },
          date: { value: "2024-01-01T00:00:00Z" },
        },
      ],
    },
  });

  assert.deepEqual(parsed, [
    {
      id: "wd:Q123",
      wikidataEntityId: "Q123",
      canonicalName: "فيلم تجريبي",
      originalName: null,
      kind: "movie",
      releaseYear: 2025,
      sourceUrl: "https://www.wikidata.org/wiki/Q123",
      sourceLicense: "CC0 1.0",
    },
  ]);
});

test("generated D1 upsert escapes source labels and never changes review state", () => {
  const sql = buildWikidataTitleUpsertSql([
    {
      id: "wd:Q7",
      wikidataEntityId: "Q7",
      canonicalName: "طفل 'آمن'",
      originalName: null,
      kind: "series",
      releaseYear: 2026,
      sourceUrl: "https://www.wikidata.org/wiki/Q7",
      sourceLicense: "CC0 1.0",
    },
  ]);

  assert.match(sql, /INSERT INTO titles/);
  assert.match(sql, /طفل ''آمن''/);
  assert.doesNotMatch(sql, /review_bundles|review_submissions|verified|editorial_approvals/);
});
