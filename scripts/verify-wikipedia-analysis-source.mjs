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

const wikidata = database
  .prepare("SELECT * FROM content_source_policy_snapshots WHERE id = ?")
  .get("source-policy:wikidata:2026-08-13.1:catalog_metadata");
assert.ok(wikidata, "Wikidata catalog policy was lost during policy-table rebuild.");
assert.equal(wikidata.use_scope, "catalog_metadata");
assert.equal(wikidata.license_label, "CC0 1.0");

const wikipedia = database
  .prepare("SELECT * FROM content_source_policy_snapshots WHERE id = ?")
  .get("source-policy:wikipedia:2026-08-13.1:analysis_evidence");
assert.ok(wikipedia, "Wikipedia analysis-evidence policy was not seeded.");
assert.equal(wikipedia.source_key, "wikipedia");
assert.equal(wikipedia.use_scope, "analysis_evidence");
assert.equal(wikipedia.decision, "allow_with_attribution");
assert.equal(wikipedia.license_label, "CC BY-SA 4.0");
assert.equal(wikipedia.license_url, "https://creativecommons.org/licenses/by-sa/4.0/");
assert.equal(wikipedia.attribution_required, 1);
assert.equal(wikipedia.share_alike, 1);
assert.equal(wikipedia.automated_ingestion_allowed, 1);
assert.equal(wikipedia.commercial_use_allowed, 1);

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
        "source-policy:tmdb:forged:analysis_evidence",
        "tmdb",
        "forged",
        "analysis_evidence",
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
  "Expanded policy allowlist accepted a forged commercial TMDB policy.",
);

database
  .prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
  .run("wiki-evidence-title", "عنوان دليل ويكيبيديا", "movie", 2026);
database
  .prepare(
    `INSERT INTO title_versions
      (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  .run(
    "wiki-evidence-version",
    "wiki-evidence-title",
    "نسخة اختبار",
    "test",
    "ar",
    6000,
    "wiki-evidence-fingerprint",
    "active",
  );

const insertEvidence = database.prepare(
  `INSERT INTO version_evidence_sources
    (id, version_id, policy_snapshot_id, source_url, source_revision, source_license,
     license_url, attribution_text, retrieved_at, content_sha256, ingestion_mode)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

const attribution =
  "مساهمو Wikipedia، صفحة اختبار، revision 987654321، CC BY-SA 4.0؛ استُخدمت كمصدر دليل وتم تعديل/استخلاص الوقائع.";
insertEvidence.run(
  "wiki-evidence-1",
  "wiki-evidence-version",
  wikipedia.id,
  "https://ar.wikipedia.org/wiki/Test",
  "987654321",
  "CC BY-SA 4.0",
  "https://creativecommons.org/licenses/by-sa/4.0/",
  attribution,
  "2026-08-13T05:00:00.000Z",
  "a".repeat(64),
  "automated",
);

const stored = database
  .prepare("SELECT * FROM version_evidence_sources WHERE id = ?")
  .get("wiki-evidence-1");
assert.equal(stored.source_revision, "987654321");
assert.equal(stored.source_license, "CC BY-SA 4.0");
assert.equal(stored.attribution_text, attribution);

assert.throws(
  () =>
    insertEvidence.run(
      "wiki-evidence-no-attribution",
      "wiki-evidence-version",
      wikipedia.id,
      "https://ar.wikipedia.org/wiki/Test",
      "987654322",
      "CC BY-SA 4.0",
      "https://creativecommons.org/licenses/by-sa/4.0/",
      "",
      "2026-08-13T05:01:00.000Z",
      "b".repeat(64),
      "automated",
    ),
  /analysis-evidence policy snapshot|Wikipedia evidence requires/i,
  "Wikipedia evidence was accepted without attribution.",
);

assert.throws(
  () =>
    insertEvidence.run(
      "wiki-evidence-wrong-license",
      "wiki-evidence-version",
      wikipedia.id,
      "https://ar.wikipedia.org/wiki/Test",
      "987654323",
      "CC0 1.0",
      "https://creativecommons.org/publicdomain/zero/1.0/",
      attribution,
      "2026-08-13T05:02:00.000Z",
      "c".repeat(64),
      "automated",
    ),
  /analysis-evidence policy snapshot/i,
  "Wikipedia evidence was accepted with a license that does not match its policy snapshot.",
);

assert.throws(
  () =>
    insertEvidence.run(
      "wiki-evidence-catalog-policy",
      "wiki-evidence-version",
      wikidata.id,
      "https://ar.wikipedia.org/wiki/Test",
      "987654324",
      "CC0 1.0",
      "https://creativecommons.org/publicdomain/zero/1.0/",
      attribution,
      "2026-08-13T05:03:00.000Z",
      "d".repeat(64),
      "automated",
    ),
  /analysis-evidence policy snapshot/i,
  "Catalog policy was accepted as analysis evidence.",
);

assert.throws(
  () =>
    insertEvidence.run(
      "wiki-evidence-wrong-domain",
      "wiki-evidence-version",
      wikipedia.id,
      "https://example.com/wiki/Test",
      "987654325",
      "CC BY-SA 4.0",
      "https://creativecommons.org/licenses/by-sa/4.0/",
      attribution,
      "2026-08-13T05:04:00.000Z",
      "e".repeat(64),
      "automated",
    ),
  /Wikipedia evidence requires/i,
  "Wikipedia policy accepted evidence from an unrelated domain.",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE version_evidence_sources SET attribution_text = ? WHERE id = ?")
      .run("tampered attribution", "wiki-evidence-1"),
  /append-only/i,
  "Wikipedia evidence provenance was mutable.",
);
assert.throws(
  () => database.prepare("DELETE FROM version_evidence_sources WHERE id = ?").run("wiki-evidence-1"),
  /append-only/i,
  "Wikipedia evidence provenance was deletable.",
);

const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Foreign-key validation failed after Wikipedia policy migration.");

console.log("Verified P3S-05 Wikipedia CC BY-SA analysis-evidence policy, attribution, and DB guards.");
