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

database.close();
console.log(`Verified ${migrationFiles.length} migration files and ${tables.length} product tables.`);
