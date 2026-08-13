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

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
for (const migrationFile of migrationFiles) {
  const sql = await readFile(path.join(migrationDirectory, migrationFile), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) {
    db.exec(statement);
  }
}

const CATEGORIES = [
  "fear",
  "violence",
  "language",
  "bullying",
  "sexualContent",
  "substances",
  "discrimination",
  "selfHarm",
  "grief",
  "flashingLights",
];
const WIKIPEDIA_POLICY = "source-policy:wikipedia:2026-08-13.1:analysis_evidence";

seedVersion("version-a", "title-a");
seedVersion("version-b", "title-b");
seedVersion("version-c", "title-c");
seedVersion("version-d", "title-d");
seedVersion("version-e", "title-e");
seedSource("source-a", "version-a", "a");
seedSource("source-b", "version-b", "b");
seedSource("source-c", "version-c", "c");
seedSource("source-d", "version-d", "d");
seedSource("source-e1", "version-e", "e");
seedSource("source-e2", "version-e", "f");

assert.throws(
  () =>
    db.prepare(
      `INSERT INTO evidence_review_publications
         (id, version_id, revision, review_method, human_watch_confirmed, publication_gate_version, published_at)
       VALUES (?, ?, 1, 'evidence_based', 1, ?, ?)`,
    ).run("pub-human-claim", "version-a", "gate-1", "2026-08-13T09:00:00.000Z"),
  /constraint|human_watch/i,
  "Evidence publication accepted a fabricated human-watch claim.",
);

insertPublication("pub-a1", "version-a", 1, null);
linkSource("pub-a1", "source-a");
insertCoverage("pub-a1", "source-a", { violence: "present" });
insertFact("pub-a1", "source-a", "violence", 2, null, null);
insertHead("version-a", "pub-a1", 1, "transition-a1");

const headA1 = db
  .prepare(
    "SELECT current_publication_id AS publicationId, revision FROM evidence_review_publication_heads WHERE version_id = ?",
  )
  .get("version-a");
assert.equal(headA1.publicationId, "pub-a1");
assert.equal(headA1.revision, 1);

assert.throws(
  () => db.prepare("UPDATE evidence_review_publications SET publication_gate_version = 'tampered' WHERE id = ?").run("pub-a1"),
  /append-only/i,
  "Database allowed an evidence publication snapshot to be updated.",
);
assert.throws(
  () => db.prepare("DELETE FROM evidence_review_publications WHERE id = ?").run("pub-a1"),
  /append-only/i,
  "Database allowed an evidence publication snapshot to be deleted.",
);
assert.throws(
  () =>
    db.prepare(
      `INSERT INTO evidence_publication_sources (publication_id, evidence_source_id)
       VALUES (?, ?)`,
    ).run("pub-a1", "source-b"),
  /same version|licensed analysis evidence/i,
  "Database allowed a publication to link evidence from another version.",
);

insertPublication("pub-model", "version-b", 1, null);
linkSource("pub-model", "source-b");
assert.throws(
  () =>
    db.prepare(
      `INSERT INTO evidence_publication_assertions
         (id, publication_id, evidence_source_id, source_assertion_id, category, result,
          extraction_method, extractor_version, source_locator, summary_ar)
       VALUES (?, ?, ?, ?, 'fear', 'none', 'model_assisted', ?, ?, ?)`,
    ).run(
      "pub-model:assert:fear",
      "pub-model",
      "source-b",
      "source:model:none",
      "model-1",
      "P0001",
      "The model cannot turn silence into none.",
    ),
  /constraint/i,
  "Database accepted model-assisted none coverage.",
);

assert.throws(
  () =>
    db.prepare(
      `INSERT INTO evidence_publication_assertions
         (id, publication_id, evidence_source_id, source_assertion_id, category, result,
          extraction_method, extractor_version, source_locator, summary_ar)
       VALUES (?, ?, ?, ?, 'fear', 'present', 'manual', ?, ?, ?)`,
    ).run(
      "pub-a1:unlinked",
      "pub-a1",
      "source-e1",
      "unlinked-source-assertion",
      "fixture-1",
      "section:fear",
      "Unlinked source must be rejected.",
    ),
  /must link to a publication source/i,
  "Database accepted a claim whose evidence source was not linked to the publication.",
);

insertPublication("pub-c1", "version-c", 1, null);
linkSource("pub-c1", "source-c");
insertCoverage("pub-c1", "source-c", {}, CATEGORIES.slice(0, 9));
assert.throws(
  () => insertHead("version-c", "pub-c1", 1, "transition-c1"),
  /cover every content category/i,
  "Database finalized an evidence publication with a missing category.",
);

insertPublication("pub-d1", "version-d", 1, null);
linkSource("pub-d1", "source-d");
insertCoverage("pub-d1", "source-d", { violence: "present" });
assert.throws(
  () => insertHead("version-d", "pub-d1", 1, "transition-d1"),
  /present evidence claim requires at least one structured fact/i,
  "Database finalized a present claim without a structured fact.",
);

insertPublication("pub-e1", "version-e", 1, null);
linkSource("pub-e1", "source-e1");
linkSource("pub-e1", "source-e2");
insertCoverage("pub-e1", "source-e1", { violence: "present" });
insertCoverage("pub-e1", "source-e2", { violence: "present" });
insertFact("pub-e1", "source-e1", "violence", 1, null, null);
insertFact("pub-e1", "source-e2", "violence", 3, null, null);
assert.throws(
  () => insertHead("version-e", "pub-e1", 1, "transition-e1"),
  /severity conflict/i,
  "Database finalized evidence sources with a severity delta of two.",
);

insertPublication("pub-a2", "version-a", 2, "pub-a1");
linkSource("pub-a2", "source-a");
insertCoverage("pub-a2", "source-a", { violence: "present" });
insertFact("pub-a2", "source-a", "violence", 2, null, null);
db.prepare(
  `UPDATE evidence_review_publication_heads
   SET current_publication_id = ?, revision = 2, last_transition_id = ?, updated_at = ?
   WHERE version_id = ? AND revision = 1 AND current_publication_id = ?`,
).run("pub-a2", "transition-a2", "2026-08-13T10:00:00.000Z", "version-a", "pub-a1");

const headA2 = db
  .prepare(
    "SELECT current_publication_id AS publicationId, revision FROM evidence_review_publication_heads WHERE version_id = ?",
  )
  .get("version-a");
assert.equal(headA2.publicationId, "pub-a2");
assert.equal(headA2.revision, 2);
assert.equal(
  db.prepare("SELECT COUNT(*) AS count FROM evidence_review_publications WHERE version_id = ?").get("version-a").count,
  2,
  "Advancing the head erased an older publication snapshot.",
);

assert.throws(
  () => insertPublication("pub-a4-invalid", "version-a", 4, "pub-a2"),
  /lineage is invalid/i,
  "Database accepted a publication revision that skipped its direct predecessor.",
);

const nullTiming = db
  .prepare(
    "SELECT start_second AS startSecond, end_second AS endSecond FROM evidence_publication_facts WHERE publication_id = ? LIMIT 1",
  )
  .get("pub-a2");
assert.equal(nullTiming.startSecond, null);
assert.equal(nullTiming.endSecond, null);

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, []);

db.close();
console.log("Verified P3S-06 immutable evidence publication snapshots, licensed claim links, coverage/conflict finalization, and non-human disclosure guards.");

function seedVersion(versionId, titleId) {
  db.prepare(
    "INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, 'movie', 2026)",
  ).run(titleId, `Title ${titleId}`);
  db.prepare(
    `INSERT INTO title_versions
       (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status)
     VALUES (?, ?, 'Test edition', 'test', 'ar', 6000, ?, 'active')`,
  ).run(versionId, titleId, `fingerprint-${versionId}`);
}

function seedSource(sourceId, versionId, hashChar) {
  db.prepare(
    `INSERT INTO version_evidence_sources
       (id, version_id, policy_snapshot_id, source_url, source_revision, source_license,
        license_url, attribution_text, retrieved_at, content_sha256, ingestion_mode)
     VALUES (?, ?, ?, ?, ?, 'CC BY-SA 4.0', ?, ?, ?, ?, 'automated')`,
  ).run(
    sourceId,
    versionId,
    WIKIPEDIA_POLICY,
    `https://en.wikipedia.org/wiki/${encodeURIComponent(sourceId)}`,
    "100",
    "https://creativecommons.org/licenses/by-sa/4.0/",
    `Wikipedia contributors for ${sourceId}; revision 100; CC BY-SA 4.0 attribution.`,
    "2026-08-13T08:00:00.000Z",
    hashChar.repeat(64),
  );
}

function insertPublication(id, versionId, revision, supersedesPublicationId) {
  db.prepare(
    `INSERT INTO evidence_review_publications
       (id, version_id, revision, supersedes_publication_id, review_method,
        human_watch_confirmed, publication_gate_version, published_at)
     VALUES (?, ?, ?, ?, 'evidence_based', 0, 'gate-1', ?)`,
  ).run(id, versionId, revision, supersedesPublicationId, `2026-08-13T0${Math.min(revision + 8, 9)}:00:00.000Z`);
}

function linkSource(publicationId, sourceId) {
  db.prepare(
    "INSERT INTO evidence_publication_sources (publication_id, evidence_source_id) VALUES (?, ?)",
  ).run(publicationId, sourceId);
}

function insertCoverage(publicationId, sourceId, overrides = {}, categories = CATEGORIES) {
  for (const category of categories) {
    const result = overrides[category] ?? "none";
    db.prepare(
      `INSERT INTO evidence_publication_assertions
         (id, publication_id, evidence_source_id, source_assertion_id, category, result,
          extraction_method, extractor_version, source_locator, summary_ar)
       VALUES (?, ?, ?, ?, ?, ?, 'manual', 'fixture-1', ?, ?)`,
    ).run(
      `${publicationId}:${sourceId}:assert:${category}`,
      publicationId,
      sourceId,
      `source:${sourceId}:${category}`,
      category,
      result,
      `section:${category}`,
      result === "present" ? `Present evidence for ${category}.` : `Explicit none evidence for ${category}.`,
    );
  }
}

function insertFact(publicationId, sourceId, category, severity, startSecond, endSecond) {
  db.prepare(
    `INSERT INTO evidence_publication_facts
       (id, publication_id, assertion_id, source_fact_id, category, severity, frequency,
        context, spoiler_level, summary_ar, start_second, end_second)
     VALUES (?, ?, ?, ?, ?, ?, 'unknown', 'unknown', 'contextual', ?, ?, ?)`,
  ).run(
    `${publicationId}:${sourceId}:fact:${category}`,
    publicationId,
    `${publicationId}:${sourceId}:assert:${category}`,
    `source-fact:${sourceId}:${category}`,
    category,
    severity,
    `Structured fact for ${category}.`,
    startSecond,
    endSecond,
  );
}

function insertHead(versionId, publicationId, revision, transitionId) {
  db.prepare(
    `INSERT INTO evidence_review_publication_heads
       (version_id, current_publication_id, revision, last_transition_id, updated_at)
     VALUES (?, ?, ?, ?, '2026-08-13T10:00:00.000Z')`,
  ).run(versionId, publicationId, revision, transitionId);
}
