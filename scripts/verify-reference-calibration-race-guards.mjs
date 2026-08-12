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

db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES ('race-admin', 'race-admin@example.com', 'admin', 'active')").run();
db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES ('race-coordinator', 'race-coordinator@example.com', 'review_coordinator', 'active')").run();
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('race-reference-reviewer', 'Reference reviewer', 'race-reference-group', 'active')").run();
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('race-editor', 'Reference editor', 'race-editor-group', 'active')").run();
db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES ('race-title', 'Reference race fixture', 'movie', 2026)").run();
db.prepare(`INSERT INTO title_versions
  (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
  VALUES ('race-version', 'race-title', 'A', 'test', 'ar', 6000, 'race-reference-fingerprint')`).run();

function createVerifiedFixture(index) {
  const bundleId = `race-bundle-${index}`;
  const assignmentId = `race-assignment-${index}`;
  const submissionId = `race-submission-${index}`;
  const approvalId = `race-approval-${index}`;

  db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES (?, 'race-version', 'under_review')").run(bundleId);
  db.prepare(`INSERT INTO review_assignments
    (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
    VALUES (?, ?, 'race-version', 'race-reference-reviewer', 'race-coordinator', 'in_progress', 0)`).run(assignmentId, bundleId);
  db.prepare(`INSERT INTO review_submissions
    (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
     started_at, completed_at, watched_seconds, declared_complete)
    VALUES (?, ?, 'race-version', 'race-reference-reviewer', ?, 1,
            '2026-08-12T08:00:00.000Z', '2026-08-12T10:00:00.000Z', 5900, 1)`).run(submissionId, bundleId, assignmentId);
  db.prepare("UPDATE review_assignments SET state = 'submitted', submission_id = ?, revision = revision + 1 WHERE id = ?").run(submissionId, assignmentId);
  db.prepare(`INSERT INTO review_audit_selections
    (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
     risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
    VALUES (?, ?, ?, ?, 'race-version', 'race-reference-reviewer', 'baseline', 1000, 4294967295, 0, '[]')`).run(
      `race-selection-${index}`,
      submissionId,
      assignmentId,
      bundleId,
    );
  db.prepare("UPDATE review_assignments SET state = 'approved' WHERE id = ?").run(assignmentId);
  db.prepare(`INSERT INTO editorial_approvals
    (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
    VALUES (?, ?, 'race-editor', 'approved', 1, 1, '2026-08-12T10:05:00.000Z')`).run(approvalId, bundleId);
  db.prepare("INSERT INTO editorial_approval_submissions (approval_id, submission_id) VALUES (?, ?)").run(approvalId, submissionId);
  db.prepare("UPDATE review_bundles SET current_approval_id = ?, status = 'verified' WHERE id = ?").run(approvalId, bundleId);
  return { bundleId, submissionId };
}

const fixtures = Array.from({ length: 10 }, (_, index) => createVerifiedFixture(index + 1));

db.prepare(`INSERT INTO reviewer_reference_sets
  (id, label, status, minimum_cases, revision, created_by_user_id)
  VALUES ('race-set', 'Race-safe reference set', 'draft', 10, 0, 'race-admin')`).run();
for (let index = 0; index < fixtures.length; index += 1) {
  db.prepare(`INSERT INTO reviewer_reference_cases
    (id, set_id, bundle_id, reference_submission_id, sequence, created_by_user_id)
    VALUES (?, 'race-set', ?, ?, ?, 'race-admin')`).run(
      `race-case-${index + 1}`,
      fixtures[index].bundleId,
      fixtures[index].submissionId,
      index + 1,
    );
}
db.prepare(`UPDATE reviewer_reference_sets
  SET status = 'active', revision = revision + 1,
      activated_by_user_id = 'race-admin', activated_at = '2026-08-12T11:00:00.000Z'
  WHERE id = 'race-set'`).run();

// A candidate may not be calibrated against their own work or the work of their independence group.
db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('race-same-group', 'Same group candidate', 'race-reference-group', 'probation')").run();
assert.throws(
  () => db.prepare(`INSERT INTO reviewer_reference_attempts
    (id, reviewer_id, set_id, purpose, status, blockers_json, started_at)
    VALUES ('same-group-attempt', 'race-same-group', 'race-set', 'initial', 'in_progress', '[]', '2026-08-12T12:00:00.000Z')`).run(),
  /independent reference reviewers/i,
  "A candidate was calibrated against a reference reviewer from the same independence group.",
);

for (const [reviewerId, label, group] of [
  ["race-candidate-a", "Candidate A", "race-candidate-a-group"],
  ["race-candidate-b", "Candidate B", "race-candidate-b-group"],
]) {
  db.prepare("INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'probation')").run(reviewerId, label, group);
}
for (const [attemptId, reviewerId] of [
  ["race-attempt-a", "race-candidate-a"],
  ["race-attempt-b", "race-candidate-b"],
]) {
  db.prepare(`INSERT INTO reviewer_reference_attempts
    (id, reviewer_id, set_id, purpose, status, blockers_json, started_at)
    VALUES (?, ?, 'race-set', 'initial', 'in_progress', '[]', '2026-08-12T12:00:00.000Z')`).run(attemptId, reviewerId);
}

function insertPerfectCaseResult(attemptId, caseNumber) {
  return db.prepare(`INSERT INTO reviewer_reference_case_results
    (attempt_id, case_id, candidate_payload_json,
     category_matches, category_total,
     reference_observation_count, candidate_observation_count, matched_observation_count,
     missed_observation_count, false_positive_observation_count,
     missed_high_sensitivity_count, max_severity_delta)
    VALUES (?, ?, '{}', 10, 10, 1, 1, 1, 0, 0, 0, 0)`).run(attemptId, `race-case-${caseNumber}`);
}

for (let index = 1; index <= 9; index += 1) insertPerfectCaseResult("race-attempt-a", index);
for (let index = 1; index <= 10; index += 1) insertPerfectCaseResult("race-attempt-b", index);

// Simulate a report/correction invalidating one of the gold references after attempts started.
db.prepare("UPDATE review_bundles SET status = 'conflicted', current_approval_id = NULL WHERE id = ?").run(fixtures[9].bundleId);

assert.throws(
  () => insertPerfectCaseResult("race-attempt-a", 10),
  /no longer current verified evidence/i,
  "A case result was written after its reference evidence became stale.",
);

assert.throws(
  () => db.prepare(`UPDATE reviewer_reference_attempts
    SET status = 'passed', category_agreement_bps = 10000,
        observation_recall_bps = 10000, observation_precision_bps = 10000,
        missed_high_sensitivity_count = 0, max_severity_delta = 0,
        blockers_json = '[]', completed_at = '2026-08-12T13:00:00.000Z'
    WHERE id = 'race-attempt-b'`).run(),
  /cannot finalize with stale reference evidence/i,
  "A completed attempt passed after one reference case ceased to be current verified evidence.",
);

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Reference-calibration race fixtures broke foreign keys.");

db.close();
console.log("Verified P2Q-03 independent reference evidence and write/finalization race guards.");
