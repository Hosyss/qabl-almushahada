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

db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES ('threshold-coordinator', 'threshold-coordinator@example.com', 'review_coordinator', 'active')").run();

db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status, updated_at) VALUES ('threshold-auditor', 'Threshold auditor', 'threshold-auditor-group', 'active', '2026-08-12 00:00:00')",
).run();
db.prepare(
  "INSERT INTO internal_users (id, auth_email, role, reviewer_id, status) VALUES ('threshold-auditor-user', 'threshold-auditor@example.com', 'editorial_reviewer', 'threshold-auditor', 'active')",
).run();

for (const [reviewerId, userId, email, group] of [
  ["threshold-subject", "threshold-subject-user", "threshold-subject@example.com", "threshold-subject-group"],
  ["confirmed-window-subject", "confirmed-window-user", "confirmed-window@example.com", "confirmed-window-group"],
]) {
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status, updated_at) VALUES (?, ?, ?, 'active', '2026-08-12 00:00:00')",
  ).run(reviewerId, reviewerId, group);
  db.prepare(
    "INSERT INTO internal_users (id, auth_email, role, reviewer_id, status) VALUES (?, ?, 'reviewer', ?, 'active')",
  ).run(userId, email, reviewerId);
}

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES ('threshold-title', 'Safety hold threshold fixture', 'movie', 2026)").run();
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES ('threshold-version', 'threshold-title', 'A', 'test', 'ar', 6000, 'threshold-fingerprint')`,
).run();

let serial = 0;
function createAuditFixture(subjectReviewerId, prefix) {
  serial += 1;
  const token = `${prefix}-${serial}`;
  const bundleId = `${token}-bundle`;
  const assignmentId = `${token}-assignment`;
  const submissionId = `${token}-submission`;
  const observationId = `${token}-observation`;
  const selectionId = `${token}-selection`;
  const outcomeId = `${token}-outcome`;

  db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES (?, 'threshold-version', 'under_review')")
    .run(bundleId);
  db.prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
     VALUES (?, ?, 'threshold-version', ?, 'threshold-coordinator', 'in_progress', 0)`,
  ).run(assignmentId, bundleId, subjectReviewerId);
  db.prepare(
    `INSERT INTO review_submissions
       (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
        started_at, completed_at, watched_seconds, declared_complete)
     VALUES (?, ?, 'threshold-version', ?, ?, 1,
             '2026-08-12T00:10:00.000Z', '2026-08-12T00:50:00.000Z', 5900, 1)`,
  ).run(submissionId, bundleId, subjectReviewerId, assignmentId);
  db.prepare(
    `INSERT INTO observations
       (id, submission_id, category, severity, start_second, end_second,
        frequency, context, spoiler_level, summary)
     VALUES (?, ?, 'fear', 2, 100, 120, 'single', 'threatening', 'none', ?)`,
  ).run(observationId, submissionId, `Threshold observation ${token}`);
  db.prepare(
    `UPDATE review_assignments
     SET state = 'submitted', submission_id = ?, revision = revision + 1
     WHERE id = ?`,
  ).run(submissionId, assignmentId);
  db.prepare(
    `INSERT INTO review_audit_selections
       (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
        risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
     VALUES (?, ?, ?, ?, 'threshold-version', ?, 'baseline', 1000, 0, 1, '[]')`,
  ).run(selectionId, submissionId, assignmentId, bundleId, subjectReviewerId);
  db.prepare(
    `INSERT INTO review_audit_outcomes
       (id, selection_id, submission_id, assignment_id, bundle_id, version_id,
        subject_reviewer_id, auditor_user_id, auditor_reviewer_id, status, notes, revision)
     VALUES (?, ?, ?, ?, ?, 'threshold-version', ?,
             'threshold-auditor-user', 'threshold-auditor', 'pending', '', 0)`,
  ).run(outcomeId, selectionId, submissionId, assignmentId, bundleId, subjectReviewerId);

  return { bundleId, assignmentId, submissionId, observationId, outcomeId };
}

function completeConfirmed(fixture, minute) {
  db.prepare(
    `UPDATE review_audit_outcomes
     SET status = 'confirmed', revision = 1,
         final_transition_id = ?, completed_at = ?
     WHERE id = ? AND status = 'pending'`,
  ).run(
    `${fixture.outcomeId}-confirmed-transition`,
    `2026-08-12T01:${String(minute).padStart(2, "0")}:00.000Z`,
    fixture.outcomeId,
  );
}

function completeSmallCorrection(fixture, minute) {
  db.prepare(
    `INSERT INTO review_audit_findings
       (id, outcome_id, finding_type, category, target_observation_id,
        reviewer_severity, auditor_severity, summary)
     VALUES (?, ?, 'severity_difference', 'fear', ?, 2, 3, ?)`,
  ).run(
    `${fixture.outcomeId}-delta-one`,
    fixture.outcomeId,
    fixture.observationId,
    "Independent audit found a one-level severity difference for threshold testing",
  );
  db.prepare(
    `UPDATE review_audit_outcomes
     SET status = 'correction_required', revision = 1,
         final_transition_id = ?, completed_at = ?
     WHERE id = ? AND status = 'pending'`,
  ).run(
    `${fixture.outcomeId}-correction-transition`,
    `2026-08-12T01:${String(minute).padStart(2, "0")}:00.000Z`,
    fixture.outcomeId,
  );
}

function unresolvedHold(reviewerId) {
  return db.prepare(
    `SELECT id, payload_json AS payloadJson
     FROM internal_audit_events h
     WHERE h.event_type = 'reviewer_safety_hold_placed'
       AND h.entity_type = 'reviewer'
       AND h.entity_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM internal_audit_events r
         WHERE r.event_type = 'reviewer_safety_hold_resolved'
           AND json_extract(r.payload_json, '$.holdEventId') = h.id
       )
     ORDER BY h.created_at DESC, h.id DESC
     LIMIT 1`,
  ).get(reviewerId);
}

// Exact correction boundary: 4/20 must remain active, then 5 in the rolling
// latest-20 window must place a hold. Delta=1 avoids all immediate/large-gap rules.
for (let index = 1; index <= 15; index += 1) {
  completeConfirmed(createAuditFixture("threshold-subject", `boundary-confirmed-${index}`), index);
}
for (let index = 16; index <= 19; index += 1) {
  completeSmallCorrection(createAuditFixture("threshold-subject", `boundary-correction-${index}`), index);
}
completeConfirmed(createAuditFixture("threshold-subject", "boundary-confirmed-20"), 20);
assert.equal(unresolvedHold("threshold-subject"), undefined, "Four corrections in twenty incorrectly placed a safety hold.");
assert.equal(db.prepare("SELECT status FROM reviewers WHERE id = 'threshold-subject'").get().status, "active");

completeSmallCorrection(createAuditFixture("threshold-subject", "boundary-correction-21"), 21);
const boundaryHold = unresolvedHold("threshold-subject");
assert.ok(boundaryHold, "Five corrections in the latest twenty did not place a safety hold.");
assert.ok(JSON.parse(boundaryHold.payloadJson).triggerCodes.includes("REPEATED_CORRECTIONS"));
assert.equal(db.prepare("SELECT status FROM reviewers WHERE id = 'threshold-subject'").get().status, "suspended");

// Confirmed-window parity: five corrections may already exist among the first
// nineteen audits, but aggregate rules are disabled below the minimum sample.
// A clean twentieth confirmed audit must evaluate the now-complete window.
for (let index = 1; index <= 14; index += 1) {
  completeConfirmed(createAuditFixture("confirmed-window-subject", `window-confirmed-${index}`), index + 25);
}
for (let index = 15; index <= 19; index += 1) {
  completeSmallCorrection(createAuditFixture("confirmed-window-subject", `window-correction-${index}`), index + 25);
}
assert.equal(
  unresolvedHold("confirmed-window-subject"),
  undefined,
  "Aggregate safety hold was placed before the twentieth completed audit.",
);
completeConfirmed(createAuditFixture("confirmed-window-subject", "window-confirmed-20"), 45);
const confirmedWindowHold = unresolvedHold("confirmed-window-subject");
assert.ok(confirmedWindowHold, "A confirmed twentieth audit failed to evaluate the five-correction pattern.");
const confirmedWindowPayload = JSON.parse(confirmedWindowHold.payloadJson);
assert.ok(confirmedWindowPayload.triggerCodes.includes("REPEATED_CORRECTIONS"));
assert.equal(confirmedWindowPayload.evidence.triggeredOnConfirmedWindowCompletion, 1);
assert.equal(db.prepare("SELECT status FROM reviewers WHERE id = 'confirmed-window-subject'").get().status, "suspended");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Threshold verifier broke foreign keys.");

db.close();
console.log("Verified P2Q-04 rolling-window correction thresholds and confirmed-audit parity.");
