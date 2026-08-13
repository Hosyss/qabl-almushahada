import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";

import { buildPublicCatalogDirectoryQueries } from "../db/public-catalog-query.ts";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE titles (
      id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      original_name TEXT,
      kind TEXT NOT NULL,
      release_year INTEGER NOT NULL,
      search_aliases_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE content_source_policy_snapshots (
      id TEXT PRIMARY KEY,
      source_key TEXT NOT NULL,
      use_scope TEXT NOT NULL,
      decision TEXT NOT NULL,
      license_label TEXT NOT NULL,
      automated_ingestion_allowed INTEGER NOT NULL,
      commercial_use_allowed INTEGER NOT NULL,
      policy_version TEXT NOT NULL
    );
    CREATE TABLE title_catalog_sources (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL,
      policy_snapshot_id TEXT NOT NULL,
      source_entity_id TEXT NOT NULL,
      source_url TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE title_versions (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE review_bundles (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_approval_id TEXT,
      published_at TEXT
    );
    CREATE TABLE editorial_approvals (
      id TEXT PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE review_reports (
      id TEXT PRIMARY KEY,
      bundle_id TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);
  db.prepare(`INSERT INTO content_source_policy_snapshots
    (id, source_key, use_scope, decision, license_label, automated_ingestion_allowed, commercial_use_allowed, policy_version)
    VALUES ('wikidata-policy','wikidata','catalog_metadata','allow','CC0 1.0',1,1,'fixture')`).run();
  return db;
}

function addTitle(db: DatabaseSync, index: number, options: { kind?: string; year?: number; name?: string } = {}) {
  const qid = `Q${1000 + index}`;
  const id = `wd:${qid}`;
  const name = options.name ?? `عنوان ${index}`;
  db.prepare("INSERT INTO titles (id, canonical_name, original_name, kind, release_year, search_aliases_json) VALUES (?, ?, ?, ?, ?, '[]')")
    .run(id, name, `Title ${index}`, options.kind ?? "movie", options.year ?? 2000 + (index % 20));
  db.prepare("INSERT INTO title_catalog_sources (id, title_id, policy_snapshot_id, source_entity_id, source_url, retrieved_at, created_at) VALUES (?, ?, 'wikidata-policy', ?, ?, '2026-08-13T10:00:00Z', '2026-08-13T10:00:00Z')")
    .run(`source-${index}`, id, qid, `https://www.wikidata.org/wiki/${qid}`);
  return id;
}

function runPlan(db: DatabaseSync, input: Parameters<typeof buildPublicCatalogDirectoryQueries>[0]) {
  const plan = buildPublicCatalogDirectoryQueries(input);
  const count = Number((db.prepare(plan.countSql).get(...plan.countBindings) as { count: number }).count);
  const rows = db.prepare(plan.listSql).all(...plan.listBindings) as Array<Record<string, unknown>>;
  return { plan, count, rows };
}

test("directory pagination never loads the whole 200-title catalog into one browser response", async () => {
  const db = makeDb();
  for (let i = 0; i < 60; i += 1) addTitle(db, i);
  const { count, rows } = runPlan(db, { query: "", kind: "all", year: null, reviewStatus: "all", limit: 24, offset: 0 });
  assert.equal(count, 60);
  assert.equal(rows.length, 24);
  const pageSource = await readFile(new URL("../app/titles/page.tsx", import.meta.url), "utf8");
  assert.match(pageSource, /pageSize:\s*24/u);
  assert.doesNotMatch(pageSource, /listPublicCatalogTitles\s*\(\s*200\s*\)/u);
  db.close();
});

test("count and list share the exact same server-side filter bindings", () => {
  const plan = buildPublicCatalogDirectoryQueries({ query: "Harry", kind: "movie", year: 2001, reviewStatus: "verified", limit: 24, offset: 48 });
  assert.deepEqual(plan.countBindings, plan.listBindings.slice(0, -2));
  assert.deepEqual(plan.listBindings.slice(-2), [24, 48]);
  for (const token of ["canonical_name", "original_name", "search_aliases_json", "t.kind", "t.release_year", "hasVerifiedReview"]) {
    assert.ok(plan.countSql.includes(token), `count query lost filter token: ${token}`);
    assert.ok(plan.listSql.includes(token), `list query lost filter token: ${token}`);
  }
});

test("query, type, year, review status, limit and offset remain parameterized", () => {
  const raw = "Harry' Potter%";
  const plan = buildPublicCatalogDirectoryQueries({ query: raw, kind: "series", year: 2012, reviewStatus: "not_verified", limit: 12, offset: 24 });
  assert.ok(plan.countBindings.includes(raw.toLocaleLowerCase("en-US")));
  assert.ok(plan.listBindings.includes("series"));
  assert.ok(plan.listBindings.includes(2012));
  assert.ok(plan.listBindings.includes("not_verified"));
  assert.deepEqual(plan.listBindings.slice(-2), [12, 24]);
  assert.ok(!plan.listSql.includes(raw));
  assert.ok(!plan.countSql.includes(raw));
  assert.doesNotMatch(plan.listSql, /wd:Q\d+/u);
  assert.doesNotMatch(plan.listSql, /editorialId|editorial-review-publications/u);
  assert.throws(() => buildPublicCatalogDirectoryQueries({ query: "", kind: "movie", year: null, reviewStatus: "all", limit: 49, offset: 0 }), /limit/i);
});

test("search, kind and year filtering execute in SQLite before pagination", () => {
  const db = makeDb();
  addTitle(db, 1, { name: "هاري بوتر وحجر الفيلسوف", kind: "movie", year: 2001 });
  addTitle(db, 2, { name: "هاري مختلف", kind: "series", year: 2001 });
  addTitle(db, 3, { name: "عمل آخر", kind: "movie", year: 2002 });
  const result = runPlan(db, { query: "هاري", kind: "movie", year: 2001, reviewStatus: "all", limit: 24, offset: 0 });
  assert.equal(result.count, 1);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.releaseYear, 2001);
  assert.equal(result.rows[0]?.kind, "movie");
  db.close();
});

test("hasVerifiedReview counts only the current approved published state", () => {
  const db = makeDb();
  const current = addTitle(db, 10, { name: "Current" });
  const staleApproval = addTitle(db, 11, { name: "Stale approval" });
  const unpublished = addTitle(db, 12, { name: "Unpublished" });
  const blocked = addTitle(db, 13, { name: "Blocked report" });

  for (const [titleId, suffix] of [[current, "current"], [staleApproval, "stale"], [unpublished, "unpublished"], [blocked, "blocked"]] as const) {
    db.prepare("INSERT INTO title_versions (id, title_id, status) VALUES (?, ?, 'active')").run(`version-${suffix}`, titleId);
  }

  db.prepare("INSERT INTO editorial_approvals (id, bundle_id, status) VALUES ('approval-current','bundle-current','approved')").run();
  db.prepare("INSERT INTO review_bundles (id, version_id, status, current_approval_id, published_at) VALUES ('bundle-current','version-current','verified','approval-current','2026-08-13T12:00:00Z')").run();

  db.prepare("INSERT INTO editorial_approvals (id, bundle_id, status) VALUES ('approval-old','bundle-stale','approved')").run();
  db.prepare("INSERT INTO editorial_approvals (id, bundle_id, status) VALUES ('approval-current-bad','bundle-stale','changes_requested')").run();
  db.prepare("INSERT INTO review_bundles (id, version_id, status, current_approval_id, published_at) VALUES ('bundle-stale','version-stale','verified','approval-current-bad','2026-08-13T12:00:00Z')").run();

  db.prepare("INSERT INTO editorial_approvals (id, bundle_id, status) VALUES ('approval-unpublished','bundle-unpublished','approved')").run();
  db.prepare("INSERT INTO review_bundles (id, version_id, status, current_approval_id, published_at) VALUES ('bundle-unpublished','version-unpublished','verified','approval-unpublished',NULL)").run();

  db.prepare("INSERT INTO editorial_approvals (id, bundle_id, status) VALUES ('approval-blocked','bundle-blocked','approved')").run();
  db.prepare("INSERT INTO review_bundles (id, version_id, status, current_approval_id, published_at) VALUES ('bundle-blocked','version-blocked','verified','approval-blocked','2026-08-13T12:00:00Z')").run();
  db.prepare("INSERT INTO review_reports (id, bundle_id, status) VALUES ('report-blocked','bundle-blocked','open')").run();

  const result = runPlan(db, { query: "", kind: "all", year: null, reviewStatus: "all", limit: 24, offset: 0 });
  const byName = new Map(result.rows.map((row) => [row.canonicalName, row.hasVerifiedReview]));
  assert.equal(byName.get("Current"), 1);
  assert.equal(byName.get("Stale approval"), 0);
  assert.equal(byName.get("Unpublished"), 0);
  assert.equal(byName.get("Blocked report"), 0);

  const verifiedOnly = runPlan(db, { query: "", kind: "all", year: null, reviewStatus: "verified", limit: 24, offset: 0 });
  assert.equal(verifiedOnly.count, 1);
  assert.equal(verifiedOnly.rows[0]?.canonicalName, "Current");
  db.close();
});

test("temporary B3 production browser QA", async (t) => {
  const directStandaloneRun = process.argv[1]?.endsWith("public-catalog-directory.test.ts");
  const targetBranch = process.env.GITHUB_REF === "refs/heads/agent/p4-03-b3-source-wording-fix";
  if (process.env.GITHUB_ACTIONS !== "true" || !directStandaloneRun || !targetBranch) {
    t.skip("temporary branch-only visual QA");
    return;
  }
  await import("../scripts/b3-production-visual-qa.mjs");
});
