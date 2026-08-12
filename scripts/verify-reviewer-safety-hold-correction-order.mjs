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

db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES ('order-coordinator', 'order-coordinator@example.com', 'review_coordinator', 'active')").run();
for (const [reviewerId, userId, email, role, group] of [
  ["order-subject", "order-subject-user", "order-subject@example.com", "reviewer", "order-subject-group"],
  ["order-auditor", "order-auditor-user", "order-auditor@example.com", "editorial_reviewer", "order-auditor-group"],
]) {
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status, updated_at) VALUES (?, ?, ?, 'active', '2026-08-12 00:00:00')",
  ).run(reviewerId, reviewerId, group);
  db.prepare(
    "INSERT INTO internal_users (id, auth_email, role, reviewer_id, status) VALUES (?, ?, ?, ?, 'active')",
  ).run(userId, email, role, reviewerId);
}

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES ('order-title', 'Correction order fixture', 'movie', 2026)").run();
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES ('order-version', 'order-title', 'A', 'test', 'ar', 6000, 'order-fingerprint')`,
).run();
db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES ('order-bundle', 'order-version', 'under_review')").run();
db.prepare(
  `INSERT INTO review_assignments
     (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
   VALUES ('order-assignment', 'order-bundle', 'order-version', 'order-subject', 'order-coordinator', 'in_progress', 0)`,
).run();
db.prepare(
  `INSERT INTO review_submissions
     (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
      started_at, completed_at, watched_seconds, declared_complete)
   VALUES ('order-submission', 'order-bundle', 'order-version', 'order-subject', 'order-assignment', 1,
           '2026-08-12T01:00:00.000Z', '2026-08-12T02:30:00.000Z', 5900, 1)`,
).run();
db.prepare(
  `UPDATE review_assignments
   SET state = 'submitted', submission_id = 'order-submission', revision = revision + 1
   WHERE id = 'order-assignment'`,
).run();
db.prepare(
  `INSERT INTO review_audit_selections
     (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
      risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
   VALUES ('order-selection', 'order-submission', 'order-assignment', 'order-bundle',
           'order-version', 'order-subject', 'baseline', 1000, 0, 1, '[]')`,
).run();
db.prepare(
  `INSERT INTO review_audit_outcomes
     (id, selection_id, submission_id, assignment_id, bundle_id, version_id,
      subject_reviewer_id, auditor_user_id, auditor_reviewer_id, status, notes, revision)
   VALUES ('order-outcome', 'order-selection', 'order-submission', 'order-assignment', 'order-bundle',
           'order-version', 'order-subject', 'order-auditor-user', 'order-auditor', 'pending', '', 0)`,
).run();
db.prepare(
  `INSERT INTO review_audit_findings
     (id, outcome_id, finding_type, category, auditor_severity, start_second, end_second, summary)
   VALUES ('order-sensitive-miss', 'order-outcome', 'missed_event', 'selfHarm', 1, 100, 110,
           'Independent audit found a high-sensitivity event that requires correction')`,
).run();

const assignmentBefore = db.prepare(
  "SELECT revision, state FROM review_assignments WHERE id = 'order-assignment'",
).get();
const bundleBefore = db.prepare(
  "SELECT revision, status FROM review_bundles WHERE id = 'order-bundle'",
).get();
assert.equal(assignmentBefore.state, "submitted");
assert.equal(bundleBefore.status, "under_review");

// This is the same ordering used by recordReviewAuditOutcome: finalizing the
// outcome fires the automatic hold first, then the batch must still be able to
// move the triggering assignment/bundle into the correction workflow.
db.prepare(
  `UPDATE review_audit_outcomes
   SET status = 'correction_required', revision = 1,
       final_transition_id = 'order-transition', completed_at = '2026-08-12T02:45:00.000Z'
   WHERE id = 'order-outcome' AND status = 'pending' AND revision = 0`,
).run();

assert.equal(db.prepare("SELECT status FROM reviewers WHERE id = 'order-subject'").get().status, "suspended");
assert.equal(db.prepare("SELECT status FROM internal_users WHERE id = 'order-subject-user'").get().status, "suspended");
assert.equal(
  db.prepare("SELECT status FROM review_bundles WHERE id = 'order-bundle'").get().status,
  "under_review",
  "Generic hold invalidation mutated the triggering bundle before its correction transition.",
);

const assignmentCorrection = db.prepare(
  `UPDATE review_assignments
   SET state = 'changes_requested', revision = revision + 1,
       last_transition_id = 'order-transition', updated_at = '2026-08-12T02:45:00.000Z'
   WHERE id = 'order-assignment'
     AND revision = ?
     AND state = 'submitted'
     AND submission_id = 'order-submission'
     AND EXISTS (
       SELECT 1 FROM review_audit_outcomes
       WHERE id = 'order-outcome'
         AND status = 'correction_required'
         AND final_transition_id = 'order-transition'
     )`,
).run(assignmentBefore.revision);
assert.equal(assignmentCorrection.changes, 1, "Automatic hold blocked the triggering assignment correction transition.");

const bundleCorrection = db.prepare(
  `UPDATE review_bundles
   SET status = 'under_review', revision = revision + 1,
       workflow_transition_id = 'order-transition', updated_at = '2026-08-12T02:45:00.000Z'
   WHERE id = 'order-bundle'
     AND revision = ?
     AND status = 'under_review'
     AND current_approval_id IS NULL
     AND EXISTS (
       SELECT 1 FROM review_assignments
       WHERE id = 'order-assignment'
         AND state = 'changes_requested'
         AND last_transition_id = 'order-transition'
     )`,
).run(bundleBefore.revision);
assert.equal(bundleCorrection.changes, 1, "Automatic hold blocked the triggering bundle correction transition.");

const finalAssignment = db.prepare(
  "SELECT state, revision FROM review_assignments WHERE id = 'order-assignment'",
).get();
const finalBundle = db.prepare(
  "SELECT status, revision, workflow_transition_id AS transitionId FROM review_bundles WHERE id = 'order-bundle'",
).get();
assert.equal(finalAssignment.state, "changes_requested");
assert.equal(finalAssignment.revision, assignmentBefore.revision + 1);
assert.equal(finalBundle.status, "under_review");
assert.equal(finalBundle.revision, bundleBefore.revision + 1);
assert.equal(finalBundle.transitionId, "order-transition");

const hold = db.prepare(
  `SELECT id FROM internal_audit_events
   WHERE event_type = 'reviewer_safety_hold_placed' AND entity_id = 'order-subject'`,
).get();
assert.ok(hold, "Correction ordering fixture lost the automatic safety-hold evidence.");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Correction-order verifier broke foreign keys.");

db.close();
console.log("Verified P2Q-04 automatic hold ordering does not block the triggering correction workflow.");
