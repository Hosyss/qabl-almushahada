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

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, 'movie', 2026)")
  .run("outcome-title", "Audit outcome fixture");
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES (?, ?, 'A', 'test', 'ar', 6000, ?)`,
).run("outcome-version", "outcome-title", "audit-outcome-fingerprint");

for (const [reviewerId, label, group] of [
  ["subject-reviewer", "Subject reviewer", "subject-group"],
  ["independent-auditor", "Independent auditor", "auditor-group"],
  ["same-group-auditor", "Same group auditor", "subject-group"],
]) {
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
  ).run(reviewerId, label, group);
}

db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, 'review_coordinator', 'active')")
  .run("outcome-coordinator", "outcome-coordinator@example.com");
for (const [userId, email, reviewerId] of [
  ["subject-auditor-user", "subject-auditor@example.com", "subject-reviewer"],
  ["independent-auditor-user", "independent-auditor@example.com", "independent-auditor"],
  ["same-group-auditor-user", "same-group-auditor@example.com", "same-group-auditor"],
]) {
  db.prepare(
    `INSERT INTO internal_users (id, auth_email, role, reviewer_id, status)
     VALUES (?, ?, 'editorial_reviewer', ?, 'active')`,
  ).run(userId, email, reviewerId);
}

function createSelectedFixture(suffix) {
  const bundleId = `outcome-bundle-${suffix}`;
  const assignmentId = `outcome-assignment-${suffix}`;
  const submissionId = `outcome-submission-${suffix}`;
  const observationId = `outcome-observation-${suffix}`;
  const selectionId = `outcome-selection-${suffix}`;

  db.prepare(
    "INSERT INTO review_bundles (id, version_id, status) VALUES (?, 'outcome-version', 'under_review')",
  ).run(bundleId);
  db.prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
     VALUES (?, ?, 'outcome-version', 'subject-reviewer', 'outcome-coordinator', 'in_progress', 0)`,
  ).run(assignmentId, bundleId);
  db.prepare(
    `INSERT INTO review_submissions
       (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
        started_at, completed_at, watched_seconds, declared_complete)
     VALUES (?, ?, 'outcome-version', 'subject-reviewer', ?, 1,
             '2026-08-12T10:00:00.000Z', '2026-08-12T12:00:00.000Z', 5900, 1)`,
  ).run(submissionId, bundleId, assignmentId);
  db.prepare(
    `INSERT INTO observations
       (id, submission_id, category, severity, start_second, end_second,
        frequency, context, spoiler_level, summary)
     VALUES (?, ?, 'fear', 2, 100, 120, 'single', 'threatening', 'none', ?)`,
  ).run(observationId, submissionId, `Fear fixture ${suffix}`);
  db.prepare(
    `UPDATE review_assignments
     SET state = 'submitted', submission_id = ?, revision = revision + 1
     WHERE id = ?`,
  ).run(submissionId, assignmentId);
  db.prepare(
    `INSERT INTO review_audit_selections
       (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
        risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
     VALUES (?, ?, ?, ?, 'outcome-version', 'subject-reviewer',
             'baseline', 1000, 0, 1, '[]')`,
  ).run(selectionId, submissionId, assignmentId, bundleId);

  return { bundleId, assignmentId, submissionId, observationId, selectionId };
}

function insertPendingOutcome({ outcomeId, fixture, auditorUserId, auditorReviewerId }) {
  return db.prepare(
    `INSERT INTO review_audit_outcomes
       (id, selection_id, submission_id, assignment_id, bundle_id, version_id,
        subject_reviewer_id, auditor_user_id, auditor_reviewer_id, status, notes, revision)
     VALUES (?, ?, ?, ?, ?, 'outcome-version', 'subject-reviewer', ?, ?, 'pending', '', 0)`,
  ).run(
    outcomeId,
    fixture.selectionId,
    fixture.submissionId,
    fixture.assignmentId,
    fixture.bundleId,
    auditorUserId,
    auditorReviewerId,
  );
}

const correctionFixture = createSelectedFixture("correction");

assert.throws(
  () =>
    db.prepare(
      `INSERT INTO editorial_approvals
         (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
       VALUES ('blocked-approval', ?, 'independent-auditor', 'approved', 1, 1,
               '2026-08-12T12:10:00.000Z')`,
    ).run(correctionFixture.bundleId),
  /selected audit must be confirmed/i,
  "Editorial approval was created before a selected audit was completed.",
);

assert.throws(
  () =>
    insertPendingOutcome({
      outcomeId: "self-outcome",
      fixture: correctionFixture,
      auditorUserId: "subject-auditor-user",
      auditorReviewerId: "subject-reviewer",
    }),
  /opening context is invalid/i,
  "A reviewer was allowed to audit their own selected submission.",
);

assert.throws(
  () =>
    insertPendingOutcome({
      outcomeId: "same-group-outcome",
      fixture: correctionFixture,
      auditorUserId: "same-group-auditor-user",
      auditorReviewerId: "same-group-auditor",
    }),
  /opening context is invalid/i,
  "An auditor from the same independence group was accepted.",
);

insertPendingOutcome({
  outcomeId: "correction-outcome",
  fixture: correctionFixture,
  auditorUserId: "independent-auditor-user",
  auditorReviewerId: "independent-auditor",
});

assert.throws(
  () =>
    db.prepare(
      `INSERT INTO review_audit_findings
         (id, outcome_id, finding_type, category, target_observation_id,
          reviewer_severity, auditor_severity, summary)
       VALUES ('wrong-severity-finding', 'correction-outcome', 'severity_difference',
               'fear', ?, 1, 3, 'Stored reviewer severity was forged')`,
    ).run(correctionFixture.observationId),
  /does not match the selected submission/i,
  "Database accepted a client-forged reviewer severity.",
);

assert.throws(
  () =>
    db.prepare(
      `INSERT INTO review_audit_findings
         (id, outcome_id, finding_type, category, auditor_severity,
          start_second, end_second, summary)
       VALUES ('beyond-runtime-finding', 'correction-outcome', 'missed_event',
               'violence', 3, 5990, 6010, 'Event exceeds the selected version runtime')`,
    ).run(),
  /does not match the selected submission/i,
  "Database accepted a missed event beyond the exact version runtime.",
);

assert.throws(
  () =>
    db.prepare(
      `UPDATE review_audit_outcomes
       SET status = 'correction_required', revision = 1,
           final_transition_id = 'no-finding-transition',
           completed_at = '2026-08-12T12:20:00.000Z'
       WHERE id = 'correction-outcome'`,
    ).run(),
  /finalization is invalid/i,
  "A correction-required outcome finalized without any finding.",
);

db.prepare(
  `INSERT INTO review_audit_findings
     (id, outcome_id, finding_type, category, target_observation_id,
      reviewer_severity, auditor_severity, summary)
   VALUES ('valid-severity-finding', 'correction-outcome', 'severity_difference',
           'fear', ?, 2, 3, 'Independent auditor observed a higher severity')`,
).run(correctionFixture.observationId);

assert.throws(
  () =>
    db.prepare(
      `UPDATE review_audit_outcomes
       SET status = 'confirmed', revision = 1,
           final_transition_id = 'invalid-confirm-transition',
           completed_at = '2026-08-12T12:21:00.000Z'
       WHERE id = 'correction-outcome'`,
    ).run(),
  /finalization is invalid/i,
  "An audit containing findings was finalized as confirmed.",
);

db.prepare(
  `UPDATE review_audit_outcomes
   SET status = 'correction_required', revision = 1,
       final_transition_id = 'correction-transition',
       completed_at = '2026-08-12T12:22:00.000Z'
   WHERE id = 'correction-outcome'`,
).run();

assert.throws(
  () =>
    db.prepare(
      `UPDATE review_assignments SET state = 'approved'
       WHERE id = ?`,
    ).run(correctionFixture.assignmentId),
  /selected audit must be confirmed/i,
  "A selected submission with correction findings was approved.",
);
assert.throws(
  () => db.prepare("UPDATE review_audit_outcomes SET notes = 'tampered' WHERE id = 'correction-outcome'").run(),
  /finalization is invalid/i,
  "A finalized audit outcome was mutable.",
);
assert.throws(
  () => db.prepare("DELETE FROM review_audit_outcomes WHERE id = 'correction-outcome'").run(),
  /append-only/i,
  "A finalized audit outcome was deletable.",
);
assert.throws(
  () => db.prepare("UPDATE review_audit_findings SET summary = 'tampered' WHERE id = 'valid-severity-finding'").run(),
  /append-only/i,
  "A calibration finding was mutable.",
);

const confirmedFixture = createSelectedFixture("confirmed");
insertPendingOutcome({
  outcomeId: "confirmed-outcome",
  fixture: confirmedFixture,
  auditorUserId: "independent-auditor-user",
  auditorReviewerId: "independent-auditor",
});
db.prepare(
  `UPDATE review_audit_outcomes
   SET status = 'confirmed', revision = 1,
       final_transition_id = 'confirmed-transition',
       completed_at = '2026-08-12T12:30:00.000Z'
   WHERE id = 'confirmed-outcome'`,
).run();
const approved = db.prepare(
  "UPDATE review_assignments SET state = 'approved' WHERE id = ?",
).run(confirmedFixture.assignmentId);
assert.equal(approved.changes, 1, "Confirmed selected audit did not release assignment approval.");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Audit outcome fixtures broke foreign keys.");

db.close();
console.log("Verified P2Q-02 independent audit outcomes, immutable findings, and approval gates.");
