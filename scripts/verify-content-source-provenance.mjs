import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(projectRoot, "drizzle");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");

for (const migrationFile of migrationFiles) {
  const sql = await readFile(path.join(migrationDirectory, migrationFile), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) database.exec(statement);
}

const policy = database
  .prepare(
    `SELECT * FROM content_source_policy_snapshots
     WHERE id = 'source-policy:wikidata:2026-08-13.1:catalog_metadata'`,
  )
  .get();
assert.ok(policy, "Missing seeded Wikidata policy snapshot.");
assert.equal(policy.source_key, "wikidata");
assert.equal(policy.use_scope, "catalog_metadata");
assert.equal(policy.license_label, "CC0 1.0");
assert.equal(policy.automated_ingestion_allowed, 1);
assert.equal(policy.commercial_use_allowed, 1);

assert.throws(
  () =>
    database
      .prepare(
        `INSERT INTO content_source_policy_snapshots
          (id, source_key, policy_version, use_scope, decision, license_label, license_url,
           policy_url, attribution_required, share_alike, automated_ingestion_allowed,
           commercial_use_allowed, verified_on)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "source-policy:tmdb:forged:catalog_metadata",
        "tmdb",
        "forged",
        "catalog_metadata",
        "allow",
        "forged",
        "https://example.com/license",
        "https://developer.themoviedb.org/docs/faq",
        0,
        0,
        1,
        1,
        "2026-08-13",
      ),
  /constraint/i,
  "Database accepted a forged commercially-allowed TMDB policy snapshot.",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE content_source_policy_snapshots SET verified_on = ? WHERE id = ?")
      .run("2099-01-01", policy.id),
  /append-only/i,
  "Policy snapshot was mutable.",
);
assert.throws(
  () => database.prepare("DELETE FROM content_source_policy_snapshots WHERE id = ?").run(policy.id),
  /append-only/i,
  "Policy snapshot was deletable.",
);

database
  .prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
  .run("wd:Q123", "عنوان موثق المصدر", "movie", 2026);
database
  .prepare(
    `INSERT INTO title_versions
      (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  .run("version-source-test", "wd:Q123", "نسخة اختبار", "test", "ar", 6000, "source-test-fingerprint", "active");

const validHash = "a".repeat(64);
database
  .prepare(
    `INSERT INTO title_catalog_sources
      (id, title_id, policy_snapshot_id, source_entity_id, source_url, source_revision,
       retrieved_at, content_sha256, ingestion_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  .run(
    "catalog-source-1",
    "wd:Q123",
    policy.id,
    "Q123",
    "https://www.wikidata.org/wiki/Q123",
    "987654321",
    "2026-08-13T04:00:00.000Z",
    validHash,
    "automated",
  );

const storedCatalog = database
  .prepare("SELECT * FROM title_catalog_sources WHERE id = 'catalog-source-1'")
  .get();
assert.equal(storedCatalog.source_entity_id, "Q123");
assert.equal(storedCatalog.source_revision, "987654321");
assert.equal(storedCatalog.content_sha256, validHash);

assert.throws(
  () =>
    database
      .prepare(
        `INSERT INTO title_catalog_sources
          (id, title_id, policy_snapshot_id, source_entity_id, source_url, retrieved_at,
           content_sha256, ingestion_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "catalog-source-wrong-url",
        "wd:Q123",
        policy.id,
        "Q123",
        "https://example.com/Q123",
        "2026-08-13T04:00:00.000Z",
        "b".repeat(64),
        "automated",
      ),
  /invalid Wikidata catalog provenance identity/i,
  "Database accepted a Wikidata snapshot pointing at a different domain.",
);

assert.throws(
  () =>
    database
      .prepare(
        `INSERT INTO title_catalog_sources
          (id, title_id, policy_snapshot_id, source_entity_id, source_url, retrieved_at,
           content_sha256, ingestion_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "catalog-source-bad-hash",
        "wd:Q123",
        policy.id,
        "Q123",
        "https://www.wikidata.org/wiki/Q123",
        "2026-08-13T04:00:00.000Z",
        "B".repeat(64),
        "automated",
      ),
  /constraint/i,
  "Database accepted a non-lowercase SHA-256 digest.",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE title_catalog_sources SET source_revision = ? WHERE id = ?")
      .run("changed", "catalog-source-1"),
  /append-only/i,
  "Catalog provenance was mutable.",
);
assert.throws(
  () => database.prepare("DELETE FROM title_catalog_sources WHERE id = ?").run("catalog-source-1"),
  /append-only/i,
  "Catalog provenance was deletable.",
);

assert.throws(
  () =>
    database
      .prepare(
        `INSERT INTO version_evidence_sources
          (id, version_id, policy_snapshot_id, source_url, source_license, license_url,
           retrieved_at, content_sha256, ingestion_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "evidence-forged-from-catalog",
        "version-source-test",
        policy.id,
        "https://www.wikidata.org/wiki/Q123",
        "CC0 1.0",
        "https://creativecommons.org/publicdomain/zero/1.0/",
        "2026-08-13T04:00:00.000Z",
        "c".repeat(64),
        "automated",
      ),
  /analysis-evidence policy snapshot/i,
  "Catalog metadata policy was incorrectly accepted as analysis evidence.",
);

assert.throws(
  () =>
    database
      .prepare(
        `INSERT INTO title_catalog_sources
          (id, title_id, policy_snapshot_id, source_entity_id, source_url, retrieved_at,
           content_sha256, ingestion_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "catalog-source-missing-title",
        "missing-title",
        policy.id,
        "Q999",
        "https://www.wikidata.org/wiki/Q999",
        "2026-08-13T04:00:00.000Z",
        "d".repeat(64),
        "automated",
      ),
  /foreign key/i,
  "Catalog provenance was accepted without a real title.",
);

assert.throws(
  () => database.prepare("DELETE FROM titles WHERE id = ?").run("wd:Q123"),
  /foreign key/i,
  "A sourced title was deletable while immutable provenance still references it.",
);

const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Foreign-key validation failed after provenance checks.");

console.log("Verified P3S-04 immutable commercial-source provenance and catalog/evidence separation.");
