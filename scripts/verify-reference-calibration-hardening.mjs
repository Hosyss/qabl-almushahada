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
  for (const statement of sql
    .split("--> statement-breakpoint")
    .map((item) => item.trim())
    .filter(Boolean)) {
    db.exec(statement);
  }
}

db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES ('hard-admin', 'hard-admin@example.com', 'admin', 'active')").run();
db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES ('hard-coordinator', 'hard-coordinator@example.com', 'review_coordinator', 'active')").run();
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('hard-subject', 'Reference subject', 'hard-subject-group', 'active')").run();
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('hard-editor', 'Reference editor', 'hard-editor-group', 'active')").run();
db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES ('hard-title', 'Reference hardening fixture', 'movie', 2026)").run();
db.prepare(`INSERT INTO title_versions
  (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
  VALUES ('hard-version', 'hard-title', 'A', 'test', 'ar', 6000, 'hard-reference-fingerprint')`).run();

function createVerifiedFixture(index) {
  const bundleId = `hard-bundle-${index}`;
  const assignmentId = `hard-assignment-${index}`;
  const submissionId = `hard-submission-${index}`;
  const selectionId = `hard-selection-${index}`;
  const approvalId = `hard-approval-${index}`;

  db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES (?, 'hard-version', 'under_review')").run(bundleId);
  db.prepare(`INSERT INTO review_assignments
    (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
    VALUES (?, ?, 'hard-version', 'hard-subject', 'hard-coordinator', 'in_progress', 0)`).run(assignmentId, bundleId);
  db.prepare(`INSERT INTO review_submissions
    (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
     started_at, completed_at, watched_seconds, declared_complete)
    VALUES (?, ?, 'hard-version', 'hard-subject', ?, 1,
            '2026-08-12T08:00:00.000Z', '2026-08-12T10:00:00.000Z', 5900, 1)`).run(submissionId, bundleId, assignmentId);
  db.prepare(`UPDATE review_assignments
    SET state = 'submitted', submission_id = ?, revision = revision + 1
    WHERE id = ?`).run(submissionId, assignmentId);
  db.prepare(`INSERT INTO review_audit_selections
    (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
     risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
    VALUES (?, ?, ?, ?, 'hard-version', 'hard-subject', 'baseline', 1000, 4294967295, 0, '[]')`).run(
      selectionId,
      submissionId,
      assignmentId,
      bundleId,
    );
  db.prepare("UPDATE review_assignments SET state = 'approved' WHERE id = ?").run(assignmentId);
  db.prepare(`INSERT INTO editorial_approvals
    (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
    VALUES (?, ?, 'hard-editor', 'approved', 1, 1, '2026-08-12T10:05:00.000Z')`).run(approvalId, bundleId);
  db.prepare("INSERT INTO editorial_approval_submissions (approval_id, submission_id) VALUES (?, ?)").run(approvalId, submissionId);
  db.prepare("UPDATE review_bundles SET current_approval_id = ?, status = 'verified' WHERE id = ?").run(approvalId, bundleId);

  return { bundleId, submissionId };
}

const fixtures = Array.from({ length: 10 }, (_, index) => createVerifiedFixture(index + 1));

db.prepare(`INSERT INTO reviewer_reference_sets
  (id, label, status, minimum_cases, revision, created_by_user_id)
  VALUES ('hard-set', 'Hardening set', 'draft', 10, 0, 'hard-admin')`).run();
for (let index = 0; index < fixtures.length; index += 1) {
  db.prepare(`INSERT INTO reviewer_reference_cases
    (id, set_id, bundle_id, reference_submission_id, sequence, created_by_user_id)
    VALUES (?, 'hard-set', ?, ?, ?, 'hard-admin')`).run(
      `hard-case-${index + 1}`,
      fixtures[index].bundleId,
      fixtures[index].submissionId,
      index + 1,
    );
}
db.prepare(`UPDATE reviewer_reference_sets
  SET status = 'active', revision = revision + 1,
      activated_by_user_id = 'hard-admin', activated_at = '2026-08-12T11:00:00.000Z'
  WHERE id = 'hard-set' AND status = 'draft' AND revision = 0`).run();

assert.throws(
  () => db.prepare("UPDATE reviewer_reference_sets SET label = 'Tampered label' WHERE id = 'hard-set'").run(),
  /metadata is immutable/i,
  "Reference-set metadata was mutable after creation.",
);
assert.throws(
  () => db.prepare("DELETE FROM reviewer_reference_sets WHERE id = 'hard-set'").run(),
  /append-only/i,
  "A reference calibration set was deletable.",
);

db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('hard-candidate', 'Candidate', 'hard-candidate-group', 'probation')").run();
db.prepare(`INSERT INTO reviewer_reference_attempts
  (id, reviewer_id, set_id, purpose, status, blockers_json, started_at)
  VALUES ('hard-attempt', 'hard-candidate', 'hard-set', 'initial', 'in_progress', '[]', '2026-08-12T12:00:00.000Z')`).run();

assert.throws(
  () => db.prepare("UPDATE reviewer_reference_attempts SET purpose = 'drift' WHERE id = 'hard-attempt'").run(),
  /identity is immutable/i,
  "An open reference calibration attempt changed identity or purpose.",
);
assert.throws(
  () => db.prepare(`UPDATE reviewer_reference_sets
    SET status = 'retired', revision = revision + 1
    WHERE id = 'hard-set'`).run(),
  /open calibration attempts/i,
  "An active reference set retired while an attempt was still open.",
);

for (let index = 1; index <= 10; index += 1) {
  db.prepare(`INSERT INTO reviewer_reference_case_results
    (attempt_id, case_id, candidate_payload_json,
     category_matches, category_total,
     reference_observation_count, candidate_observation_count, matched_observation_count,
     missed_observation_count, false_positive_observation_count,
     missed_high_sensitivity_count, max_severity_delta)
    VALUES ('hard-attempt', ?, '{}', 10, 10, 1, 1, 1, 0, 0, 0, 0)`).run(`hard-case-${index}`);
}

assert.throws(
  () => db.prepare(`UPDATE reviewer_reference_attempts
    SET status = 'passed', category_agreement_bps = 10000,
        observation_recall_bps = 10000, observation_precision_bps = 10000,
        missed_high_sensitivity_count = 0, max_severity_delta = 0,
        blockers_json = '[]', completed_at = '2026-08-12T11:59:59.000Z'
    WHERE id = 'hard-attempt'`).run(),
  /completion time is invalid/i,
  "A calibration attempt completed before it started.",
);

assert.equal(
  db.prepare(`UPDATE reviewer_reference_attempts
    SET status = 'passed', category_agreement_bps = 10000,
        observation_recall_bps = 10000, observation_precision_bps = 10000,
        missed_high_sensitivity_count = 0, max_severity_delta = 0,
        blockers_json = '[]', completed_at = '2026-08-12T13:00:00.000Z'
    WHERE id = 'hard-attempt'`).run().changes,
  1,
  "A valid completed hardening attempt could not finalize.",
);

// If any reference case ceases to be the current verified approved evidence,
// a new attempt must fail closed rather than start with a partial/stale set.
db.prepare("UPDATE review_bundles SET status = 'conflicted', current_approval_id = NULL WHERE id = ?").run(fixtures[0].bundleId);
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('hard-candidate-2', 'Candidate two', 'hard-candidate-group-2', 'probation')").run();
assert.throws(
  () => db.prepare(`INSERT INTO reviewer_reference_attempts
    (id, reviewer_id, set_id, purpose, status, blockers_json, started_at)
    VALUES ('hard-invalid-attempt', 'hard-candidate-2', 'hard-set', 'initial', 'in_progress', '[]', '2026-08-12T14:00:00.000Z')`).run(),
  /invalid current reference case/i,
  "A calibration attempt started after one reference case became stale or unverified.",
);

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Reference-calibration hardening fixtures broke foreign keys.");

db.close();
console.log("Verified P2Q-03 reference lifecycle hardening and stale-reference fail-closed guards.");
