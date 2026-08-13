import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PUBLIC_CATALOG_LIST_QUERY, PUBLIC_CATALOG_TITLE_QUERY } from "../db/public-catalog-query.ts";
import {
  prepareWikidataCatalogImportPlan,
  type WikidataCatalogTitle,
} from "../lib/wikidata-catalog.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(projectRoot, "drizzle");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+.*\.sql$/u.test(name))
  .sort();

assert.equal(migrationFiles.length, 22, "P3S-08 must not require a new schema migration.");

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
for (const migrationFile of migrationFiles) {
  const sql = await readFile(path.join(migrationDirectory, migrationFile), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) {
    db.exec(statement);
  }
}

const fixture: WikidataCatalogTitle = {
  id: "wd:Q123456789",
  wikidataEntityId: "Q123456789",
  canonicalName: "عنوان كتالوج قانوني",
  originalName: null,
  kind: "movie",
  releaseYear: 2026,
  sourceUrl: "https://www.wikidata.org/wiki/Q123456789",
  sourceLicense: "CC0 1.0",
};

const plan = await prepareWikidataCatalogImportPlan([fixture], {
  retrievedAt: "2026-08-13T10:00:00.000Z",
});

assert.equal(plan.records.length, 1);
assert.equal(plan.policySnapshot.id, "source-policy:wikidata:2026-08-13.1:catalog_metadata");
assert.equal(plan.records[0].provenance.policySnapshotId, plan.policySnapshot.id);
assert.match(plan.records[0].provenance.contentSha256, /^[0-9a-f]{64}$/u);
assert.match(plan.sql, /INSERT INTO titles/u);
assert.match(plan.sql, /INSERT INTO title_catalog_sources/u);
assert.doesNotMatch(
  plan.sql,
  /INSERT INTO (title_versions|review_bundles|review_submissions|editorial_approvals|evidence_review_publications)/u,
  "Catalog import SQL must never synthesize review/evidence state.",
);

db.exec(plan.sql);
db.exec(plan.sql);

const title = db.prepare("SELECT canonical_name, kind, release_year FROM titles WHERE id = ?").get(fixture.id);
assert.equal(title?.canonical_name, fixture.canonicalName);
assert.equal(title?.kind, fixture.kind);
assert.equal(title?.release_year, fixture.releaseYear);

const provenanceRows = db.prepare(
  "SELECT title_id, policy_snapshot_id, source_entity_id, source_url, content_sha256, ingestion_mode FROM title_catalog_sources WHERE title_id = ?",
).all(fixture.id);
assert.equal(provenanceRows.length, 1, "Reapplying the same catalog artifact must be idempotent.");
assert.equal(provenanceRows[0].source_entity_id, fixture.wikidataEntityId);
assert.equal(provenanceRows[0].ingestion_mode, "automated");

assert.equal(db.prepare("SELECT COUNT(*) AS count FROM title_versions WHERE title_id = ?").get(fixture.id).count, 0);
assert.equal(
  db.prepare(
    "SELECT COUNT(*) AS count FROM review_bundles WHERE version_id IN (SELECT id FROM title_versions WHERE title_id = ?)",
  ).get(fixture.id).count,
  0,
);
assert.equal(
  db.prepare(
    "SELECT COUNT(*) AS count FROM evidence_review_publications WHERE version_id IN (SELECT id FROM title_versions WHERE title_id = ?)",
  ).get(fixture.id).count,
  0,
);

const publicRow = db.prepare(PUBLIC_CATALOG_TITLE_QUERY).get(fixture.id, fixture.wikidataEntityId);
assert.equal(publicRow?.canonicalName, fixture.canonicalName);
assert.equal(publicRow?.sourceLicense, "CC0 1.0");

const publicList = db.prepare(PUBLIC_CATALOG_LIST_QUERY).all(100);
assert.equal(publicList.length, 1);
assert.equal(publicList[0].titleId, fixture.id);

assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
db.close();

console.log(
  "Verified P3S-08 catalog import: 22 migrations / 33 tables, provenance-safe idempotent Wikidata metadata, no synthetic review state, and public catalog queries gated by legal source policy.",
);
