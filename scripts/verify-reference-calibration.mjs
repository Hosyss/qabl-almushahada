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

db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, 'admin', 'active')")
  .run("reference-admin", "reference-admin@example.com");
db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, 'review_coordinator', 'active')")
  .run("reference-coordinator", "reference-coordinator@example.com");

db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
).run("reference-subject", "Reference subject", "reference-subject-group");
db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
).run("reference-editor", "Reference editor", "reference-editor-group");

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, 'movie', 2026)")
  .run("reference-title", "Reference calibration fixture");
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES (?, ?, 'A', 'test', 'ar', 6000, ?)`,
).run("reference-version", "reference-title", "reference-calibration-fingerprint");

function createVerifiedReferenceFixture(index) {
  const bundleId = `reference-bundle-${index}`;
  const assignmentId = `reference-assignment-${index}`;
  const submissionId = `reference-submission-${index}`;
  const selectionId = `reference-selection-${index}`;
  const approvalId = `reference-approval-${index}`;

  db.prepare(
    "INSERT INTO review_bundles (id, version_id, status) VALUES (?, 'reference-version', 'under_review')",
  ).run(bundleId);
  db.prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
     VALUES (?, ?, 'reference-version', 'reference-subject', 'reference-coordinator', 'in_progress', 0)`,
  ).run(assignmentId, bundleId);
  db.prepare(
    `INSERT INTO review_submissions
       (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
        started_at, completed_at, watched_seconds, declared_complete)
     VALUES (?, ?, 'reference-version', 'reference-subject', ?, 1,
             '2026-08-12T08:00:00.000Z', '2026-08-12T10:00:00.000Z', 5900, 1)`,
  ).run(submissionId, bundleId, assignmentId);
  db.prepare(
    `UPDATE review_assignments
     SET state = 'submitted', submission_id = ?, revision = revision + 1
     WHERE id = ?`,
  ).run(submissionId, assignmentId);
  db.prepare(
    `INSERT INTO review_audit_selections
       (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
        risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
     VALUES (?, ?, ?, ?, 'reference-version', 'reference-subject',
             'baseline', 1000, 4294967295, 0, '[]')`,
  ).run(selectionId, submissionId, assignmentId, bundleId);
  db.prepare("UPDATE review_assignments SET state = 'approved' WHERE id = ?")
    .run(assignmentId);
  db.prepare(
    `INSERT INTO editorial_approvals
       (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
     VALUES (?, ?, 'reference-editor', 'approved', 1, 1, '2026-08-12T10:05:00.000Z')`,
  ).run(approvalId, bundleId);
  db.prepare(
    "INSERT INTO editorial_approval_submissions (approval_id, submission_id) VALUES (?, ?)",
  ).run(approvalId, submissionId);
  db.prepare("UPDATE review_bundles SET current_approval_id = ? WHERE id = ?")
    .run(approvalId, bundleId);
  db.prepare("UPDATE review_bundles SET status = 'verified' WHERE id = ?")
    .run(bundleId);

  return { bundleId, submissionId };
}

const fixtures = Array.from({ length: 10 }, (_, index) => createVerifiedReferenceFixture(index + 1));

function createSet(id, minimumCases = 10) {
  db.prepare(
    `INSERT INTO reviewer_reference_sets
       (id, label, status, minimum_cases, revision, created_by_user_id)
     VALUES (?, ?, 'draft', ?, 0, 'reference-admin')`,
  ).run(id, `Set ${id}`, minimumCases);
}

function addCases(setId) {
  fixtures.forEach((fixture, index) => {
    db.prepare(
      `INSERT INTO reviewer_reference_cases
         (id, set_id, bundle_id, reference_submission_id, sequence, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, 'reference-admin')`,
    ).run(`case-${setId}-${index + 1}`, setId, fixture.bundleId, fixture.submissionId, index + 1);
  });
}

function activateSet(setId, at = "2026-08-12T11:00:00.000Z") {
  return db.prepare(
    `UPDATE reviewer_reference_sets
     SET status = 'active', revision = revision + 1,
         activated_by_user_id = 'reference-admin', activated_at = ?
     WHERE id = ? AND status = 'draft' AND revision = 0`,
  ).run(at, setId);
}

createSet("short-set");
db.prepare(
  `INSERT INTO reviewer_reference_cases
     (id, set_id, bundle_id, reference_submission_id, sequence, created_by_user_id)
   VALUES ('short-case', 'short-set', ?, ?, 1, 'reference-admin')`,
).run(fixtures[0].bundleId, fixtures[0].submissionId);
assert.throws(
  () => activateSet("short-set"),
  /not ready for activation/i,
  "A reference set with fewer than ten cases was activated.",
);

createSet("invalid-case-set");
assert.throws(
  () =>
    db.prepare(
      `INSERT INTO reviewer_reference_cases
         (id, set_id, bundle_id, reference_submission_id, sequence, created_by_user_id)
       VALUES ('invalid-cross-case', 'invalid-case-set', ?, ?, 1, 'reference-admin')`,
    ).run(fixtures[0].bundleId, fixtures[1].submissionId),
  /current verified approved submission/i,
  "A reference case accepted a submission that did not belong to its verified bundle.",
);

createSet("active-set");
addCases("active-set");
assert.equal(activateSet("active-set").changes, 1, "The valid reference set did not activate.");

createSet("second-set");
addCases("second-set");
assert.throws(
  () => activateSet("second-set", "2026-08-12T11:01:00.000Z"),
  /unique/i,
  "More than one reference calibration set became active.",
);

// Real provisioning inserts the reviewer first and then the internal user with a transition id.
// The migration must ensure no production reviewer is externally observable as active after that batch.
db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
).run("provisioned-reviewer", "Provisioned reviewer", "provisioned-group");
db.prepare(
  `INSERT INTO internal_users
     (id, auth_email, role, reviewer_id, status, revision, last_transition_id)
   VALUES ('provisioned-user', 'provisioned@example.com', 'reviewer',
           'provisioned-reviewer', 'active', 0, 'provision-transition')`,
).run();
assert.equal(
  db.prepare("SELECT status FROM reviewers WHERE id = 'provisioned-reviewer'").get().status,
  "probation",
  "A newly provisioned reviewer did not start in probation.",
);

// Normal historical/test fixtures without a provisioning transition id remain untouched.
db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
).run("fixture-active-reviewer", "Fixture reviewer", "fixture-group");
db.prepare(
  `INSERT INTO internal_users (id, auth_email, role, reviewer_id, status)
   VALUES ('fixture-active-user', 'fixture-active@example.com', 'reviewer', 'fixture-active-reviewer', 'active')`,
).run();
assert.equal(
  db.prepare("SELECT status FROM reviewers WHERE id = 'fixture-active-reviewer'").get().status,
  "active",
  "The provisioning guard unexpectedly rewrote legacy/test fixtures.",
);

function insertAttempt(id, reviewerId, purpose, startedAt = "2026-08-12T12:00:00.000Z") {
  return db.prepare(
    `INSERT INTO reviewer_reference_attempts
       (id, reviewer_id, set_id, purpose, status, blockers_json, started_at)
     VALUES (?, ?, 'active-set', ?, 'in_progress', '[]', ?)`,
  ).run(id, reviewerId, purpose, startedAt);
}

function insertPerfectResults(attemptId, count = 10) {
  for (let index = 1; index <= count; index += 1) {
    db.prepare(
      `INSERT INTO reviewer_reference_case_results
         (attempt_id, case_id, candidate_payload_json,
          category_matches, category_total,
          reference_observation_count, candidate_observation_count, matched_observation_count,
          missed_observation_count, false_positive_observation_count,
          missed_high_sensitivity_count, max_severity_delta)
       VALUES (?, ?, '{}', 10, 10, 1, 1, 1, 0, 0, 0, 0)`,
    ).run(attemptId, `case-active-set-${index}`);
  }
}

function finalizePerfectAttempt(attemptId, completedAt) {
  return db.prepare(
    `UPDATE reviewer_reference_attempts
     SET status = 'passed',
         category_agreement_bps = 10000,
         observation_recall_bps = 10000,
         observation_precision_bps = 10000,
         missed_high_sensitivity_count = 0,
         max_severity_delta = 0,
         blockers_json = '[]',
         completed_at = ?
     WHERE id = ? AND status = 'in_progress'`,
  ).run(completedAt, attemptId);
}

// Initial activation path.
db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'probation')",
).run("candidate-reviewer", "Candidate reviewer", "candidate-group");
insertAttempt("candidate-attempt", "candidate-reviewer", "initial");
assert.throws(
  () => db.prepare("UPDATE reviewers SET status = 'active' WHERE id = 'candidate-reviewer'").run(),
  /requires a current passed reference calibration/i,
  "A probation reviewer activated before passing reference calibration.",
);
insertPerfectResults("candidate-attempt", 9);
assert.throws(
  () => finalizePerfectAttempt("candidate-attempt", "2026-08-12T12:30:00.000Z"),
  /all reference calibration cases must be completed/i,
  "An attempt finalized before all reference cases were completed.",
);
db.prepare(
  `INSERT INTO reviewer_reference_case_results
     (attempt_id, case_id, candidate_payload_json,
      category_matches, category_total,
      reference_observation_count, candidate_observation_count, matched_observation_count,
      missed_observation_count, false_positive_observation_count,
      missed_high_sensitivity_count, max_severity_delta)
   VALUES ('candidate-attempt', 'case-active-set-10', '{}', 10, 10, 1, 1, 1, 0, 0, 0, 0)`,
).run();
assert.throws(
  () =>
    db.prepare(
      `UPDATE reviewer_reference_attempts
       SET status = 'passed',
           category_agreement_bps = 9999,
           observation_recall_bps = 10000,
           observation_precision_bps = 10000,
           missed_high_sensitivity_count = 0,
           max_severity_delta = 0,
           blockers_json = '[]',
           completed_at = '2026-08-12T12:31:00.000Z'
       WHERE id = 'candidate-attempt'`,
    ).run(),
  /metrics do not match stored case results/i,
  "A forged aggregate metric snapshot was accepted.",
);
assert.equal(
  finalizePerfectAttempt("candidate-attempt", "2026-08-12T12:32:00.000Z").changes,
  1,
  "A complete perfect reference calibration did not finalize.",
);
assert.throws(
  () => db.prepare("UPDATE reviewer_reference_attempts SET completed_at = '2026-08-12T13:00:00Z' WHERE id = 'candidate-attempt'").run(),
  /immutable/i,
  "A finalized reference calibration attempt was mutable.",
);
assert.throws(
  () => db.prepare("UPDATE reviewer_reference_case_results SET category_matches = 9 WHERE attempt_id = 'candidate-attempt' AND case_id = 'case-active-set-1'").run(),
  /append-only/i,
  "A stored reference calibration case result was mutable.",
);
assert.equal(
  db.prepare("UPDATE reviewers SET status = 'active' WHERE id = 'candidate-reviewer'").run().changes,
  1,
  "A probation reviewer with a current passed calibration could not activate.",
);

// Initial attempts are not valid for already-active reviewers.
assert.throws(
  () => insertAttempt("invalid-active-initial", "candidate-reviewer", "initial"),
  /requires a probation reviewer/i,
  "An active reviewer started a new initial calibration attempt.",
);

// Suspended reviewers need a passed attempt completed after their suspension timestamp.
db.prepare(
  `INSERT INTO reviewers
     (id, display_label, independence_group_id, status, updated_at)
   VALUES ('suspended-reviewer', 'Suspended reviewer', 'suspended-group', 'suspended', '2026-08-12 14:00:00')`,
).run();
insertAttempt("stale-reactivation", "suspended-reviewer", "reactivation", "2026-08-12T12:00:00.000Z");
insertPerfectResults("stale-reactivation");
finalizePerfectAttempt("stale-reactivation", "2026-08-12T13:00:00.000Z");
assert.throws(
  () => db.prepare("UPDATE reviewers SET status = 'active' WHERE id = 'suspended-reviewer'").run(),
  /requires a current passed reference calibration/i,
  "A stale pre-suspension calibration reactivated a suspended reviewer.",
);
insertAttempt("fresh-reactivation", "suspended-reviewer", "reactivation", "2026-08-12T14:10:00.000Z");
insertPerfectResults("fresh-reactivation");
finalizePerfectAttempt("fresh-reactivation", "2026-08-12T15:00:00.000Z");
assert.equal(
  db.prepare("UPDATE reviewers SET status = 'active' WHERE id = 'suspended-reviewer'").run().changes,
  1,
  "A fresh post-suspension passed calibration did not permit reactivation.",
);

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Reference calibration fixtures broke foreign keys.");

db.close();
console.log("Verified P2Q-03 reference-set integrity, exact calibration metrics, and activation gates.");
