import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(projectRoot, "drizzle");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+.*\.sql$/u.test(name))
  .sort();

assert.equal(migrationFiles.length, 22, "P3S-07 expects exactly 22 migration files.");

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
for (const migrationFile of migrationFiles) {
  const sql = await readFile(path.join(migrationDirectory, migrationFile), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) {
    db.exec(statement);
  }
}

assert.equal(
  db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get().count,
  33,
  "P3S-07 must not add product tables; only flag constraints are rebuilt.",
);

const triggerNames = new Set(
  db.prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'trigger'
       AND name IN (
         'observation_flags_p3s07_category_guard',
         'evidence_publication_fact_flags_p3s07_category_guard',
         'observation_flags_immutable_update',
         'observation_flags_immutable_delete',
         'evidence_publication_fact_flags_no_update',
         'evidence_publication_fact_flags_no_delete',
         'review_audit_selections_insert_guard'
       )`,
  ).all().map((row) => row.name),
);
for (const expected of [
  "observation_flags_p3s07_category_guard",
  "evidence_publication_fact_flags_p3s07_category_guard",
  "observation_flags_immutable_update",
  "observation_flags_immutable_delete",
  "evidence_publication_fact_flags_no_update",
  "evidence_publication_fact_flags_no_delete",
  "review_audit_selections_insert_guard",
]) {
  assert.ok(triggerNames.has(expected), `Missing P3S-07/immutability/audit trigger: ${expected}`);
}

const restoredAuditGuardSql = String(
  db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'review_audit_selections_insert_guard'",
  ).get().sql,
);
for (const token of [
  "observation_flags",
  "flashing_sequence",
  "blood",
  "weapon",
  "physical_bullying",
  "5000",
  "1000",
]) {
  assert.ok(
    restoredAuditGuardSql.includes(token),
    `Restored P2Q-01 audit-selection guard lost required logic token: ${token}`,
  );
}

const humanTableSql = String(
  db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'observation_flags'").get().sql,
);
const evidenceTableSql = String(
  db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'evidence_publication_fact_flags'").get().sql,
);
for (const flag of ["nudity", "gambling_activity", "religious_reference_or_practice"]) {
  assert.ok(humanTableSql.includes(`'${flag}'`), `Human flag CHECK is missing ${flag}.`);
  assert.ok(evidenceTableSql.includes(`'${flag}'`), `Evidence flag CHECK is missing ${flag}.`);
}

seedHumanReview();
insertHumanObservation("obs-sexual", "sexualContent");
insertHumanObservation("obs-substances", "substances");
insertHumanObservation("obs-fear", "fear");

db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-sexual", "nudity");
db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-sexual", "kissing");
db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-sexual", "intimate_touching");
db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-sexual", "sexual_dialogue");

db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-substances", "smoking_or_vaping");
db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-substances", "alcohol_use");
db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-substances", "drug_use");
db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-substances", "gambling_activity");

db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run(
  "obs-fear",
  "religious_reference_or_practice",
);

assert.throws(
  () => db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-sexual", "alcohol_use"),
  /incompatible with observation category/i,
  "Human review storage accepted alcohol_use under sexualContent.",
);
assert.throws(
  () => db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-substances", "nudity"),
  /incompatible with observation category/i,
  "Human review storage accepted nudity under substances.",
);
assert.throws(
  () => db.prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)").run("obs-fear", "unknown_flag"),
  /incompatible with observation category|constraint/i,
  "Human review storage accepted an unknown flag.",
);
assert.throws(
  () => db.prepare("UPDATE observation_flags SET flag = 'jump_scare' WHERE observation_id = ? AND flag = ?").run("obs-sexual", "nudity"),
  /immutable revisions/i,
  "Rebuilding observation_flags removed immutable-update protection.",
);
assert.throws(
  () => db.prepare("DELETE FROM observation_flags WHERE observation_id = ? AND flag = ?").run("obs-sexual", "nudity"),
  /immutable revisions/i,
  "Rebuilding observation_flags removed immutable-delete protection.",
);

seedEvidencePublication();
db.prepare("INSERT INTO evidence_publication_fact_flags (fact_id, flag) VALUES (?, ?)").run("evidence-fact-sexual", "nudity");
db.prepare("INSERT INTO evidence_publication_fact_flags (fact_id, flag) VALUES (?, ?)").run(
  "evidence-fact-sexual",
  "religious_reference_or_practice",
);

assert.throws(
  () => db.prepare("INSERT INTO evidence_publication_fact_flags (fact_id, flag) VALUES (?, ?)").run("evidence-fact-sexual", "alcohol_use"),
  /incompatible with fact category/i,
  "Evidence publication storage accepted alcohol_use under sexualContent.",
);
assert.throws(
  () => db.prepare("INSERT INTO evidence_publication_fact_flags (fact_id, flag) VALUES (?, ?)").run("evidence-fact-sexual", "unknown_flag"),
  /incompatible with fact category|constraint/i,
  "Evidence publication storage accepted an unknown flag.",
);
assert.throws(
  () => db.prepare("UPDATE evidence_publication_fact_flags SET flag = 'kissing' WHERE fact_id = ? AND flag = ?").run("evidence-fact-sexual", "nudity"),
  /append-only/i,
  "Rebuilding evidence publication flags removed immutable-update protection.",
);
assert.throws(
  () => db.prepare("DELETE FROM evidence_publication_fact_flags WHERE fact_id = ? AND flag = ?").run("evidence-fact-sexual", "nudity"),
  /append-only/i,
  "Rebuilding evidence publication flags removed immutable-delete protection.",
);

assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

db.close();
console.log("Verified P3S-07 objective taxonomy: 22 migrations / 33 tables, expanded subtype CHECKs, category guards, preserved P2Q-01 audit selection logic, cross-cutting religious marker, and immutable flag history.");

function seedHumanReview() {
  db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, 'movie', 2026)").run(
    "taxonomy-title",
    "Taxonomy title",
  );
  db.prepare(
    `INSERT INTO title_versions
       (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status)
     VALUES (?, ?, 'Test edition', 'test', 'ar', 6000, ?, 'active')`,
  ).run("taxonomy-version", "taxonomy-title", "taxonomy-fingerprint-2026");
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
  ).run("taxonomy-reviewer", "Taxonomy reviewer", "taxonomy-group");
  db.prepare(
    `INSERT INTO internal_users (id, auth_email, role, status)
     VALUES (?, ?, 'review_coordinator', 'active')`,
  ).run("taxonomy-coordinator", "taxonomy-coordinator@example.com");
  db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES (?, ?, 'under_review')").run(
    "taxonomy-bundle",
    "taxonomy-version",
  );
  db.prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
     VALUES (?, ?, ?, ?, ?, 'in_progress', 0)`,
  ).run(
    "taxonomy-assignment",
    "taxonomy-bundle",
    "taxonomy-version",
    "taxonomy-reviewer",
    "taxonomy-coordinator",
  );
  db.prepare(
    `INSERT INTO review_submissions
       (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
        started_at, completed_at, watched_seconds, declared_complete)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, 5900, 1)`,
  ).run(
    "taxonomy-submission",
    "taxonomy-bundle",
    "taxonomy-version",
    "taxonomy-reviewer",
    "taxonomy-assignment",
    "2026-08-13T08:00:00.000Z",
    "2026-08-13T09:40:00.000Z",
  );
}

function insertHumanObservation(id, category) {
  db.prepare(
    `INSERT INTO observations
       (id, submission_id, category, severity, start_second, end_second, frequency, context, spoiler_level, summary)
     VALUES (?, 'taxonomy-submission', ?, 1, 10, 20, 'single', 'neutral', 'contextual', ?)`,
  ).run(id, category, `Objective ${category} fixture.`);
}

function seedEvidencePublication() {
  const policyId = "source-policy:wikipedia:2026-08-13.1:analysis_evidence";
  db.prepare(
    `INSERT INTO version_evidence_sources
       (id, version_id, policy_snapshot_id, source_url, source_revision, source_license,
        license_url, attribution_text, retrieved_at, content_sha256, ingestion_mode)
     VALUES (?, ?, ?, ?, ?, 'CC BY-SA 4.0', ?, ?, ?, ?, 'automated')`,
  ).run(
    "taxonomy-evidence-source",
    "taxonomy-version",
    policyId,
    "https://en.wikipedia.org/wiki/Taxonomy_fixture",
    "456",
    "https://creativecommons.org/licenses/by-sa/4.0/",
    "Wikipedia contributors, Taxonomy fixture, revision 456, CC BY-SA 4.0.",
    "2026-08-13T10:00:00.000Z",
    "b".repeat(64),
  );
  db.prepare(
    `INSERT INTO evidence_review_publications
       (id, version_id, revision, review_method, human_watch_confirmed, publication_gate_version, published_at)
     VALUES (?, ?, 1, 'evidence_based', 0, 'taxonomy-gate-1', ?)`,
  ).run("taxonomy-publication", "taxonomy-version", "2026-08-13T10:05:00.000Z");
  db.prepare("INSERT INTO evidence_publication_sources (publication_id, evidence_source_id) VALUES (?, ?)").run(
    "taxonomy-publication",
    "taxonomy-evidence-source",
  );
  db.prepare(
    `INSERT INTO evidence_publication_assertions
       (id, publication_id, evidence_source_id, source_assertion_id, category, result,
        extraction_method, extractor_version, source_locator, summary_ar)
     VALUES (?, ?, ?, ?, 'sexualContent', 'present', 'manual', 'taxonomy-fixture-1', 'section:sexual', ?)`,
  ).run(
    "evidence-assertion-sexual",
    "taxonomy-publication",
    "taxonomy-evidence-source",
    "source-assertion-sexual",
    "المصدر يثبت واقعة ضمن المحتوى الجنسي والحميمي.",
  );
  db.prepare(
    `INSERT INTO evidence_publication_facts
       (id, publication_id, assertion_id, source_fact_id, category, severity, frequency,
        context, spoiler_level, summary_ar, start_second, end_second)
     VALUES (?, ?, ?, ?, 'sexualContent', 1, 'single', 'neutral', 'contextual', ?, NULL, NULL)`,
  ).run(
    "evidence-fact-sexual",
    "taxonomy-publication",
    "evidence-assertion-sexual",
    "source-fact-sexual",
    "واقعة موضوعية ضمن المحور.",
  );
}
