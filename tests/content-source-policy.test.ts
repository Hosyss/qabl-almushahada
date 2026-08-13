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

test("commercial source policy separates automated catalog and analysis-evidence uses", () => {
  const automatedCatalog = Object.values(CONTENT_SOURCE_POLICIES)
    .filter(
      (policy) =>
        policy.automatedIngestion &&
        (policy.allowedUses as readonly string[]).includes("catalog_metadata"),
    )
    .map((policy) => policy.key);
  const automatedEvidence = Object.values(CONTENT_SOURCE_POLICIES)
    .filter(
      (policy) =>
        policy.automatedIngestion &&
        (policy.allowedUses as readonly string[]).includes("analysis_evidence"),
    )
    .map((policy) => policy.key);

  assert.deepEqual(automatedCatalog, ["wikidata"]);
  assert.deepEqual(automatedEvidence, ["wikipedia"]);
  assert.equal(assertAutomatedSourceUseAllowed("wikidata", "catalog_metadata").licenseLabel, "CC0 1.0");
  const wikipedia = assertAutomatedSourceUseAllowed("wikipedia", "analysis_evidence");
  assert.equal(wikipedia.licenseLabel, "CC BY-SA 4.0");
  assert.equal(wikipedia.attributionRequired, true);
  assert.equal(wikipedia.shareAlike, true);
});

test("commercially restricted or wrong-scope sources remain fail-closed", () => {
  assert.throws(() => assertAutomatedSourceUseAllowed("tmdb", "catalog_metadata"), /not allowed/i);
  assert.throws(() => assertAutomatedSourceUseAllowed("imdb", "analysis_evidence"), /not allowed/i);
  assert.throws(() => assertAutomatedSourceUseAllowed("wikipedia", "catalog_metadata"), /not allowed/i);
  assert.throws(() => assertAutomatedSourceUseAllowed("wikidata", "analysis_evidence"), /not allowed/i);
  assert.throws(() => assertAutomatedSourceUseAllowed("wikimediaCommons", "media"), /not allowed/i);
});

test("Wikidata query is bounded, popularity-ranked, bilingual and identifies the bot", () => {
  const query = buildWikidataCatalogQuery({ limit: 200, offset: 0 });
  assert.match(query, /LIMIT 200/);
  assert.match(query, /OFFSET 0/);
  assert.match(query, /wikibase:sitelinks/);
  assert.match(query, /FILTER\(\?rawSitelinks >= 20\)/);
  assert.match(query, /rdfs:label \?arLabel/);
  assert.match(query, /rdfs:label \?enLabel/);
  assert.match(query, /ORDER BY DESC\(\?sitelinks\)/);
  assert.match(query, /MIN\(\?rawDate\)/);
  assert.match(WIKIDATA_USER_AGENT, /QablAlmushahadaBot/);
  assert.throws(() => buildWikidataCatalogQuery({ limit: 201, offset: 0 }), /limit/);
  assert.throws(() => buildWikidataCatalogQuery({ limit: 10, offset: -1 }), /offset/);
});

test("Wikidata parser prefers Arabic label and keeps a distinct English lookup name", () => {
  const parsed = parseWikidataCatalogResponse({
    results: {
      bindings: [
        {
          item: { value: "https://www.wikidata.org/entity/Q123" },
          arLabel: { value: "فيلم تجريبي" },
          enLabel: { value: "Example Film" },
          kind: { value: "movie" },
          date: { value: "2025-01-01T00:00:00Z" },
          sitelinks: { value: "120" },
        },
        {
          item: { value: "https://www.wikidata.org/entity/Q456" },
          enLabel: { value: "English Only Series" },
          kind: { value: "series" },
          date: { value: "2024-01-01T00:00:00Z" },
          sitelinks: { value: "90" },
        },
      ],
    },
  });

  assert.deepEqual(parsed, [
    {
      id: "wd:Q123",
      wikidataEntityId: "Q123",
      canonicalName: "فيلم تجريبي",
      originalName: "Example Film",
      kind: "movie",
      releaseYear: 2025,
      sourceUrl: "https://www.wikidata.org/wiki/Q123",
      sourceLicense: "CC0 1.0",
    },
    {
      id: "wd:Q456",
      wikidataEntityId: "Q456",
      canonicalName: "English Only Series",
      originalName: null,
      kind: "series",
      releaseYear: 2024,
      sourceUrl: "https://www.wikidata.org/wiki/Q456",
      sourceLicense: "CC0 1.0",
    },
  ]);
});

test("Wikidata parser rejects ambiguous entities classified as both movie and series", () => {
  const parsed = parseWikidataCatalogResponse({
    results: {
      bindings: [
        {
          item: { value: "https://www.wikidata.org/entity/Q777" },
          arLabel: { value: "عمل متعارض" },
          kind: { value: "movie" },
          date: { value: "2020-01-01T00:00:00Z" },
        },
        {
          item: { value: "https://www.wikidata.org/entity/Q777" },
          arLabel: { value: "عمل متعارض" },
          kind: { value: "series" },
          date: { value: "2020-01-01T00:00:00Z" },
        },
      ],
    },
  });

  assert.deepEqual(parsed, []);
});

test("generated D1 upsert escapes source labels and never changes review state", () => {
  const sql = buildWikidataTitleUpsertSql([
    {
      id: "wd:Q7",
      wikidataEntityId: "Q7",
      canonicalName: "طفل 'آمن'",
      originalName: "Safe Child",
      kind: "series",
      releaseYear: 2026,
      sourceUrl: "https://www.wikidata.org/wiki/Q7",
      sourceLicense: "CC0 1.0",
    },
  ]);

  assert.match(sql, /INSERT INTO titles/);
  assert.match(sql, /طفل ''آمن''/);
  assert.match(sql, /Safe Child/);
  assert.doesNotMatch(sql, /review_bundles|review_submissions|verified|editorial_approvals/);
});
