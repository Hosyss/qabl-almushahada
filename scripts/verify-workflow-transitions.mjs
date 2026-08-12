import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(root, "drizzle");
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

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
  .run("t1", "Workflow", "movie", 2026);
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES (?, ?, ?, ?, ?, ?, ?)`,
).run("v1", "t1", "A", "test", "ar", 6000, "workflow-transition-fingerprint");
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, ?)")
  .run("r1", "Reviewer 1", "g1", "active");
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, ?)")
  .run("r2", "Reviewer 2", "g2", "active");
db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, ?, ?)")
  .run("coord", "coord@example.com", "review_coordinator", "active");
db.prepare("INSERT INTO review_bundles (id, version_id, revision) VALUES (?, ?, ?)")
  .run("b1", "v1", 0);

const firstTransition = "transition-first";
const updateFirst = db.prepare(
  `UPDATE review_bundles
   SET status = 'under_review', revision = revision + 1, workflow_transition_id = ?
   WHERE id = ? AND revision = ?`,
).run(firstTransition, "b1", 0);
assert.equal(updateFirst.changes, 1);
const insertFirst = db.prepare(
  `INSERT INTO review_assignments
     (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision, last_transition_id)
   SELECT ?, id, version_id, ?, ?, 'assigned', 0, ?
   FROM review_bundles
   WHERE id = ? AND workflow_transition_id = ?`,
).run("a1", "r1", "coord", firstTransition, "b1", firstTransition);
assert.equal(insertFirst.changes, 1);

const staleTransition = "transition-stale";
const staleBundleUpdate = db.prepare(
  `UPDATE review_bundles
   SET revision = revision + 1, workflow_transition_id = ?
   WHERE id = ? AND revision = ?`,
).run(staleTransition, "b1", 0);
assert.equal(staleBundleUpdate.changes, 0, "Stale bundle revision unexpectedly updated the bundle.");
const staleAssignmentInsert = db.prepare(
  `INSERT INTO review_assignments
     (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision, last_transition_id)
   SELECT ?, id, version_id, ?, ?, 'assigned', 0, ?
   FROM review_bundles
   WHERE id = ? AND workflow_transition_id = ?`,
).run("a-stale", "r2", "coord", staleTransition, "b1", staleTransition);
assert.equal(staleAssignmentInsert.changes, 0, "Stale coordinator request created an assignment.");

const revisionBeforeSubmission = db.prepare("SELECT revision FROM review_bundles WHERE id = ?").get("b1").revision;
db.prepare("UPDATE review_assignments SET state = 'in_progress' WHERE id = ?").run("a1");
assert.equal(
  db.prepare("SELECT revision FROM review_bundles WHERE id = ?").get("b1").revision,
  revisionBeforeSubmission,
  "Starting a draft should not mutate engine-facing bundle revision.",
);
db.prepare("UPDATE review_assignments SET state = 'submitted' WHERE id = ?").run("a1");
assert.equal(
  db.prepare("SELECT revision FROM review_bundles WHERE id = ?").get("b1").revision,
  revisionBeforeSubmission + 1,
  "Locked submission did not bump bundle revision.",
);

db.close();
console.log("Verified P2-02 coordinator and submission revision transitions.");
