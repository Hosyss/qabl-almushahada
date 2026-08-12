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

assert.ok(migrationFiles.length > 0, "No SQL migrations were found.");

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

const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Foreign-key validation failed after applying migrations.");

const tables = database
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();
assert.equal(tables.length, 17, "Unexpected number of product tables.");
const tableNames = new Set(tables.map((table) => table.name));
for (const requiredTable of [
  "internal_users",
  "review_assignments",
  "review_assignment_drafts",
  "internal_audit_events",
]) {
  assert.ok(tableNames.has(requiredTable), `Missing P2-02 table: ${requiredTable}`);
}

const reviewBundleColumns = database.prepare("PRAGMA table_info('review_bundles')").all();
assert.ok(reviewBundleColumns.some((column) => column.name === "revision"), "Missing optimistic-lock revision.");
assert.ok(
  reviewBundleColumns.some((column) => column.name === "published_transition_id"),
  "Missing publication transition id.",
);
assert.ok(
  reviewBundleColumns.some((column) => column.name === "workflow_transition_id"),
  "Missing internal workflow transition id.",
);
assert.ok(
  reviewBundleColumns.some((column) => column.name === "current_approval_id"),
  "Missing current editorial approval pointer.",
);

const submissionColumns = database.prepare("PRAGMA table_info('review_submissions')").all();
for (const requiredColumn of ["assignment_id", "revision", "supersedes_submission_id"]) {
  assert.ok(
    submissionColumns.some((column) => column.name === requiredColumn),
    `Missing immutable submission revision column: ${requiredColumn}`,
  );
}

const approvalColumns = database.prepare("PRAGMA table_info('editorial_approvals')").all();
for (const requiredColumn of ["revision", "supersedes_approval_id"]) {
  assert.ok(
    approvalColumns.some((column) => column.name === requiredColumn),
    `Missing immutable editorial approval revision column: ${requiredColumn}`,
  );
}

const assignmentColumns = database.prepare("PRAGMA table_info('review_assignments')").all();
assert.ok(assignmentColumns.some((column) => column.name === "revision"), "Missing assignment revision lock.");
assert.ok(
  assignmentColumns.some((column) => column.name === "last_transition_id"),
  "Missing assignment transition id.",
);

const internalUserColumns = database.prepare("PRAGMA table_info('internal_users')").all();
assert.ok(internalUserColumns.some((column) => column.name === "revision"), "Missing internal-user revision lock.");
assert.ok(
  internalUserColumns.some((column) => column.name === "last_transition_id"),
  "Missing internal-user transition id.",
);

assert.throws(
  () =>
    database
      .prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
      .run("invalid-title", "Invalid", "unknown-kind", 2026),
  /constraint/i,
  "Database accepted an invalid title kind.",
);

assert.throws(
  () =>
    database
      .prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, ?, ?)")
      .run("invalid-role", "invalid@example.com", "superuser", "active"),
  /constraint/i,
  "Database accepted an unknown internal role.",
);

assert.throws(
  () =>
    database
      .prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, ?, ?)")
      .run("invalid-email", "UPPER@EXAMPLE.COM", "review_coordinator", "active"),
  /constraint/i,
  "Database accepted a non-normalized auth email.",
);

database
  .prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
  .run("workflow-title", "Workflow title", "movie", 2026);
database
  .prepare(
    `INSERT INTO title_versions
       (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  .run("workflow-version-a", "workflow-title", "A", "test", "ar", 6000, "workflow-fingerprint-a");
database
  .prepare(
    `INSERT INTO title_versions
       (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  .run("workflow-version-b", "workflow-title", "B", "test", "ar", 6000, "workflow-fingerprint-b");
database
  .prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, ?)",
  )
  .run("workflow-reviewer-a", "Reviewer A", "group-a", "active");
database
  .prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, ?)",
  )
  .run("workflow-reviewer-b", "Reviewer B", "group-b", "active");
database
  .prepare("INSERT INTO review_bundles (id, version_id) VALUES (?, ?)")
  .run("workflow-bundle", "workflow-version-a");
database
  .prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, ?, ?)")
  .run("workflow-coordinator", "coordinator@example.com", "review_coordinator", "active");
database
  .prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  .run(
    "workflow-assignment",
    "workflow-bundle",
    "workflow-version-a",
    "workflow-reviewer-a",
    "workflow-coordinator",
    "assigned",
  );

assert.throws(
  () =>
    database
      .prepare("UPDATE review_assignments SET reviewer_id = ? WHERE id = ?")
      .run("workflow-reviewer-b", "workflow-assignment"),
  /immutable/i,
  "Database allowed an assignment reviewer to be swapped after assignment.",
);

assert.throws(
  () =>
    database
      .prepare(
        `INSERT INTO review_assignments
           (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "workflow-version-mismatch",
        "workflow-bundle",
        "workflow-version-b",
        "workflow-reviewer-b",
        "workflow-coordinator",
        "assigned",
      ),
  /version mismatch/i,
  "Database allowed an assignment to point at the wrong version for its bundle.",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE internal_users SET role = 'admin' WHERE id = ?")
      .run("workflow-coordinator"),
  /immutable/i,
  "Database allowed an internal account role to be rewritten after provisioning.",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE internal_users SET revision = -1 WHERE id = ?")
      .run("workflow-coordinator"),
  /nonnegative/i,
  "Database accepted a negative internal-user revision.",
);

database
  .prepare(
    `INSERT INTO internal_audit_events
       (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
  .run("internal-audit-1", "workflow-coordinator", "test_event", "internal_user", "workflow-coordinator", "{}");
assert.throws(
  () =>
    database
      .prepare("UPDATE internal_audit_events SET event_type = 'tampered' WHERE id = ?")
      .run("internal-audit-1"),
  /append-only/i,
  "Database allowed an internal audit event to be updated.",
);
assert.throws(
  () => database.prepare("DELETE FROM internal_audit_events WHERE id = ?").run("internal-audit-1"),
  /append-only/i,
  "Database allowed an internal audit event to be deleted.",
);

database
  .prepare(
    `INSERT INTO review_audit_events
       (id, bundle_id, actor_id, event_type, entity_type, entity_id, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  .run("review-audit-1", "workflow-bundle", "workflow-coordinator", "test_event", "review_bundle", "workflow-bundle", "{}");
assert.throws(
  () =>
    database
      .prepare("UPDATE review_audit_events SET event_type = 'tampered' WHERE id = ?")
      .run("review-audit-1"),
  /append-only/i,
  "Database allowed a review audit event to be updated.",
);
assert.throws(
  () => database.prepare("DELETE FROM review_audit_events WHERE id = ?").run("review-audit-1"),
  /append-only/i,
  "Database allowed a review audit event to be deleted.",
);

const submissionInsert = database.prepare(
  `INSERT INTO review_submissions
     (id, bundle_id, version_id, reviewer_id, assignment_id, revision, supersedes_submission_id,
      started_at, completed_at, watched_seconds, declared_complete)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
);
submissionInsert.run(
  "submission-r1",
  "workflow-bundle",
  "workflow-version-a",
  "workflow-reviewer-a",
  "workflow-assignment",
  1,
  null,
  "2026-08-12T10:00:00.000Z",
  "2026-08-12T11:40:00.000Z",
  5900,
);
database
  .prepare(
    "INSERT INTO review_category_checks (submission_id, category, result) VALUES (?, ?, ?)",
  )
  .run("submission-r1", "fear", "present");
database
  .prepare(
    `INSERT INTO observations
       (id, submission_id, category, severity, start_second, end_second, frequency, context, spoiler_level, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  .run(
    "observation-r1",
    "submission-r1",
    "fear",
    2,
    10,
    20,
    "single",
    "threatening",
    "none",
    "Immutable revision fixture",
  );
database
  .prepare("INSERT INTO observation_flags (observation_id, flag) VALUES (?, ?)")
  .run("observation-r1", "jump_scare");

assert.throws(
  () =>
    database
      .prepare("UPDATE review_submissions SET watched_seconds = 5800 WHERE id = ?")
      .run("submission-r1"),
  /immutable revisions/i,
  "Database allowed an immutable submission revision to be updated.",
);
assert.throws(
  () => database.prepare("DELETE FROM review_submissions WHERE id = ?").run("submission-r1"),
  /immutable revisions/i,
  "Database allowed an immutable submission revision to be deleted.",
);
assert.throws(
  () =>
    database
      .prepare("UPDATE review_category_checks SET result = 'none' WHERE submission_id = ? AND category = ?")
      .run("submission-r1", "fear"),
  /immutable revisions/i,
  "Database allowed an immutable category check to be updated.",
);
assert.throws(
  () => database.prepare("DELETE FROM observations WHERE id = ?").run("observation-r1"),
  /immutable revisions/i,
  "Database allowed an immutable observation to be deleted.",
);
assert.throws(
  () => database.prepare("DELETE FROM observation_flags WHERE observation_id = ?").run("observation-r1"),
  /immutable revisions/i,
  "Database allowed an immutable observation flag to be deleted.",
);

submissionInsert.run(
  "submission-r2",
  "workflow-bundle",
  "workflow-version-a",
  "workflow-reviewer-a",
  "workflow-assignment",
  2,
  "submission-r1",
  "2026-08-12T12:00:00.000Z",
  "2026-08-12T13:40:00.000Z",
  5950,
);
assert.equal(
  database
    .prepare("SELECT supersedes_submission_id AS previousId FROM review_submissions WHERE id = ?")
    .get("submission-r2").previousId,
  "submission-r1",
  "Second submission revision did not preserve lineage to revision one.",
);
assert.throws(
  () =>
    submissionInsert.run(
      "submission-r3-invalid",
      "workflow-bundle",
      "workflow-version-a",
      "workflow-reviewer-a",
      "workflow-assignment",
      3,
      "submission-r1",
      "2026-08-12T14:00:00.000Z",
      "2026-08-12T15:40:00.000Z",
      5950,
    ),
  /lineage is invalid/i,
  "Database accepted a submission revision that skipped its direct predecessor.",
);

const approvalInsert = database.prepare(
  `INSERT INTO editorial_approvals
     (id, bundle_id, approver_id, status, revision, supersedes_approval_id,
      version_fingerprint_confirmed, notes, approved_at)
   VALUES (?, ?, ?, 'approved', ?, ?, 1, ?, ?)`,
);
approvalInsert.run(
  "approval-r1",
  "workflow-bundle",
  "workflow-reviewer-b",
  1,
  null,
  "first approval",
  "2026-08-12T16:00:00.000Z",
);
database
  .prepare("UPDATE review_bundles SET current_approval_id = ? WHERE id = ?")
  .run("approval-r1", "workflow-bundle");
database
  .prepare(
    "INSERT INTO editorial_approval_submissions (approval_id, submission_id) VALUES (?, ?)",
  )
  .run("approval-r1", "submission-r1");
database
  .prepare(
    "INSERT INTO editorial_spot_checks (approval_id, observation_id, result) VALUES (?, ?, ?)",
  )
  .run("approval-r1", "observation-r1", "confirmed");

approvalInsert.run(
  "approval-r2",
  "workflow-bundle",
  "workflow-reviewer-b",
  2,
  "approval-r1",
  "second approval",
  "2026-08-12T17:00:00.000Z",
);
database
  .prepare("UPDATE review_bundles SET current_approval_id = ? WHERE id = ?")
  .run("approval-r2", "workflow-bundle");
assert.equal(
  database.prepare("SELECT current_approval_id AS approvalId FROM review_bundles WHERE id = ?").get("workflow-bundle")
    .approvalId,
  "approval-r2",
  "Bundle did not point to the latest editorial approval revision.",
);
assert.throws(
  () =>
    database
      .prepare("UPDATE editorial_approvals SET notes = 'tampered' WHERE id = ?")
      .run("approval-r1"),
  /immutable revisions/i,
  "Database allowed an immutable editorial approval revision to be updated.",
);
assert.throws(
  () => database.prepare("DELETE FROM editorial_approvals WHERE id = ?").run("approval-r1"),
  /immutable revisions/i,
  "Database allowed an immutable editorial approval revision to be deleted.",
);
assert.throws(
  () =>
    database
      .prepare("DELETE FROM editorial_approval_submissions WHERE approval_id = ?")
      .run("approval-r1"),
  /immutable revisions/i,
  "Database allowed an immutable approval-submission link to be deleted.",
);
assert.throws(
  () => database.prepare("DELETE FROM editorial_spot_checks WHERE approval_id = ?").run("approval-r1"),
  /immutable revisions/i,
  "Database allowed an immutable editorial spot check to be deleted.",
);
assert.throws(
  () =>
    approvalInsert.run(
      "approval-r3-invalid",
      "workflow-bundle",
      "workflow-reviewer-b",
      3,
      "approval-r1",
      "invalid skipped approval",
      "2026-08-12T18:00:00.000Z",
    ),
  /lineage is invalid/i,
  "Database accepted an approval revision that skipped its direct predecessor.",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE review_bundles SET current_approval_id = ? WHERE id = ?")
      .run("missing-approval", "workflow-bundle"),
  /must belong to the same bundle/i,
  "Database accepted a current approval pointer that does not belong to the bundle.",
);

database.close();
console.log(`Verified ${migrationFiles.length} migration files and ${tables.length} product tables.`);
