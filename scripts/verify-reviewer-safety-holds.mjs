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

for (const [id, email, role] of [
  ["safety-admin", "safety-admin@example.com", "admin"],
  ["safety-coordinator", "safety-coordinator@example.com", "review_coordinator"],
]) {
  db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, ?, 'active')")
    .run(id, email, role);
}

for (const [reviewerId, label, group] of [
  ["safety-subject", "Safety subject", "subject-group"],
  ["safety-auditor", "Safety auditor", "auditor-group"],
  ["manual-target", "Manual target", "manual-target-group"],
]) {
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
  ).run(reviewerId, label, group);
}
for (const [userId, email, role, reviewerId] of [
  ["safety-subject-user", "safety-subject@example.com", "reviewer", "safety-subject"],
  ["safety-auditor-user", "safety-auditor@example.com", "editorial_reviewer", "safety-auditor"],
  ["manual-target-user", "manual-target@example.com", "reviewer", "manual-target"],
]) {
  db.prepare(
    `INSERT INTO internal_users (id, auth_email, role, reviewer_id, status)
     VALUES (?, ?, ?, ?, 'active')`,
  ).run(userId, email, role, reviewerId);
}

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES ('safety-title', 'Safety fixture', 'movie', 2026)").run();
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES ('safety-version', 'safety-title', 'A', 'test', 'ar', 6000, 'safety-hold-fingerprint')`,
).run();

function createSelectedAuditFixture(prefix, reviewerId) {
  const bundleId = `${prefix}-bundle`;
  const assignmentId = `${prefix}-assignment`;
  const submissionId = `${prefix}-submission`;
  const selectionId = `${prefix}-selection`;
  db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES (?, 'safety-version', 'under_review')")
    .run(bundleId);
  db.prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
     VALUES (?, ?, 'safety-version', ?, 'safety-coordinator', 'in_progress', 0)`,
  ).run(assignmentId, bundleId, reviewerId);
  db.prepare(
    `INSERT INTO review_submissions
       (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
        started_at, completed_at, watched_seconds, declared_complete)
     VALUES (?, ?, 'safety-version', ?, ?, 1,
             '2026-08-12T10:00:00.000Z', '2026-08-12T12:00:00.000Z', 5900, 1)`,
  ).run(submissionId, bundleId, reviewerId, assignmentId);
  db.prepare(
    `UPDATE review_assignments
     SET state = 'submitted', submission_id = ?, revision = revision + 1
     WHERE id = ?`,
  ).run(submissionId, assignmentId);
  db.prepare(
    `INSERT INTO review_audit_selections
       (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
        risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
     VALUES (?, ?, ?, ?, 'safety-version', ?, 'baseline', 1000, 0, 1, '[]')`,
  ).run(selectionId, submissionId, assignmentId, bundleId, reviewerId);
  return { bundleId, assignmentId, submissionId, selectionId };
}

const automatic = createSelectedAuditFixture("automatic", "safety-subject");
db.prepare(
  `INSERT INTO review_audit_outcomes
     (id, selection_id, submission_id, assignment_id, bundle_id, version_id,
      subject_reviewer_id, auditor_user_id, auditor_reviewer_id, status, notes, revision)
   VALUES ('automatic-outcome', ?, ?, ?, ?, 'safety-version',
           'safety-subject', 'safety-auditor-user', 'safety-auditor', 'pending', '', 0)`,
).run(automatic.selectionId, automatic.submissionId, automatic.assignmentId, automatic.bundleId);
db.prepare(
  `INSERT INTO review_audit_findings
     (id, outcome_id, finding_type, category, auditor_severity,
      start_second, end_second, summary)
   VALUES ('automatic-sensitive-miss', 'automatic-outcome', 'missed_event', 'selfHarm', 1,
           100, 110, 'Independent audit found a high-sensitivity event that was missed')`,
).run();
db.prepare(
  `UPDATE review_audit_outcomes
   SET status = 'correction_required', revision = 1,
       final_transition_id = 'automatic-outcome-final',
       completed_at = '2026-08-12T12:30:00.000Z'
   WHERE id = 'automatic-outcome'`,
).run();

const automaticHold = db.prepare(
  `SELECT id, payload_json AS payloadJson
   FROM internal_audit_events
   WHERE event_type = 'reviewer_safety_hold_placed' AND entity_id = 'safety-subject'`,
).get();
assert.ok(automaticHold, "A high-sensitivity missed event did not create an automatic safety hold.");
const automaticPayload = JSON.parse(automaticHold.payloadJson);
assert.equal(automaticPayload.source, "automatic_audit_pattern");
assert.ok(automaticPayload.triggerCodes.includes("HIGH_SENSITIVITY_EVENT_MISSED"));
assert.equal(
  db.prepare("SELECT status FROM reviewers WHERE id = 'safety-subject'").get().status,
  "suspended",
  "Automatic safety hold did not suspend reviewer capability.",
);
assert.equal(
  db.prepare("SELECT status FROM internal_users WHERE id = 'safety-subject-user'").get().status,
  "suspended",
  "Automatic safety hold did not suspend the internal reviewer account.",
);
assert.equal(
  db.prepare("SELECT status FROM review_bundles WHERE id = ?").get(automatic.bundleId).status,
  "under_review",
  "The triggering bundle was mutated before its audit workflow could finish.",
);

// A hold must be resolved by an active admin before reference reactivation can even start.
db.prepare(
  `INSERT INTO reviewer_reference_sets
     (id, label, status, minimum_cases, revision, created_by_user_id, activated_by_user_id, activated_at)
   VALUES ('safety-active-set', 'Safety active set', 'active', 10, 1,
           'safety-admin', 'safety-admin', '2026-08-12T12:31:00.000Z')`,
).run();
assert.throws(
  () => db.prepare(
    `INSERT INTO reviewer_reference_attempts
       (id, reviewer_id, set_id, purpose, status, blockers_json)
     VALUES ('blocked-reactivation', 'safety-subject', 'safety-active-set', 'reactivation', 'in_progress', '[]')`,
  ).run(),
  /blocked until human safety-hold resolution/i,
  "A reviewer started reactivation while the automatic hold was unresolved.",
);

assert.throws(
  () => db.prepare(
    `INSERT INTO internal_audit_events
       (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
     VALUES ('bad-resolution', 'safety-auditor-user', 'reviewer_safety_hold_resolved',
             'reviewer', 'safety-subject', ?)`,
  ).run(JSON.stringify({ holdEventId: automaticHold.id, resolution: "cleared", note: "This actor is not an admin and must be rejected." })),
  /requires an active admin/i,
  "A non-admin resolved a reviewer safety hold.",
);

db.prepare(
  `INSERT INTO internal_audit_events
     (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
   VALUES ('good-resolution', 'safety-admin', 'reviewer_safety_hold_resolved',
           'reviewer', 'safety-subject', ?)`,
).run(JSON.stringify({ holdEventId: automaticHold.id, resolution: "remediation_required", note: "Human review confirmed remediation is required before reactivation." }));

assert.throws(
  () => db.prepare(
    `INSERT INTO internal_audit_events
       (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
     VALUES ('duplicate-resolution', 'safety-admin', 'reviewer_safety_hold_resolved',
             'reviewer', 'safety-subject', ?)`,
  ).run(JSON.stringify({ holdEventId: automaticHold.id, resolution: "cleared", note: "Duplicate resolution must not rewrite the decision." })),
  /already resolved/i,
  "A safety hold accepted two human resolutions.",
);

assert.equal(
  db.prepare(
    `INSERT INTO reviewer_reference_attempts
       (id, reviewer_id, set_id, purpose, status, blockers_json)
     VALUES ('allowed-reactivation', 'safety-subject', 'safety-active-set', 'reactivation', 'in_progress', '[]')`,
  ).run().changes,
  1,
  "Human resolution did not release the reviewer into the reference-calibration stage.",
);
assert.throws(
  () => db.prepare("UPDATE reviewers SET status = 'active' WHERE id = 'safety-subject'").run(),
  /current passed reference calibration/i,
  "Human resolution alone reactivated a reviewer without a fresh calibration pass.",
);

// Manual collusion suspicion is a temporary investigation hold, not a factual collusion verdict.
db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES ('manual-bundle', 'safety-version', 'under_review')").run();
db.prepare(
  `INSERT INTO review_assignments
     (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state)
   VALUES ('manual-assignment', 'manual-bundle', 'safety-version', 'manual-target', 'safety-coordinator', 'assigned')`,
).run();
db.prepare(
  `INSERT INTO internal_audit_events
     (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
   VALUES ('manual-target-evidence', 'safety-admin', 'manual_suspicion_evidence',
           'reviewer', 'manual-target', ?)`,
).run(JSON.stringify({ reviewerId: "manual-target", summary: "Stored operational anomaly for human investigation." }));
const manualPayload = JSON.stringify({
  source: "manual_collusion_suspicion",
  policyVersion: "2026-08-12.v1",
  triggerCodes: ["COLLUSION_SUSPICION"],
  evidence: {
    note: "Two independent operational anomalies require human investigation; no collusion conclusion is asserted.",
    evidenceEventIds: ["manual-target-evidence"],
  },
});
assert.throws(
  () => db.prepare(
    `INSERT INTO internal_audit_events
       (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
     VALUES ('bad-manual-hold', 'safety-auditor-user', 'reviewer_safety_hold_placed',
             'reviewer', 'manual-target', ?)`,
  ).run(manualPayload),
  /active admin/i,
  "A non-admin placed a manual collusion-suspicion hold.",
);

assert.throws(
  () => db.prepare(
    `INSERT INTO internal_audit_events
       (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
     VALUES ('unrelated-manual-hold', 'safety-admin', 'reviewer_safety_hold_placed',
             'reviewer', 'manual-target', ?)`,
  ).run(JSON.stringify({
    source: "manual_collusion_suspicion",
    policyVersion: "2026-08-12.v1",
    triggerCodes: ["COLLUSION_SUSPICION"],
    evidence: { note: "Unrelated evidence must not be enough.", evidenceEventIds: ["good-resolution"] },
  })),
  /not linked to the target reviewer/i,
  "Manual hold accepted audit evidence unrelated to the target reviewer.",
);

db.prepare(
  `INSERT INTO internal_audit_events
     (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
   VALUES ('manual-hold', 'safety-admin', 'reviewer_safety_hold_placed',
           'reviewer', 'manual-target', ?)`,
).run(manualPayload);
assert.equal(db.prepare("SELECT status FROM reviewers WHERE id = 'manual-target'").get().status, "suspended");
assert.equal(db.prepare("SELECT status FROM internal_users WHERE id = 'manual-target-user'").get().status, "suspended");
assert.equal(
  db.prepare("SELECT status FROM review_bundles WHERE id = 'manual-bundle'").get().status,
  "conflicted",
  "Manual investigation hold did not fail closed on an affected review bundle.",
);

assert.throws(
  () => db.prepare("UPDATE internal_audit_events SET payload_json = '{}' WHERE id = 'manual-hold'").run(),
  /append-only/i,
  "Safety-hold evidence was mutable.",
);
assert.throws(
  () => db.prepare("DELETE FROM internal_audit_events WHERE id = 'good-resolution'").run(),
  /append-only/i,
  "Safety-hold resolution history was deletable.",
);

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Safety-hold fixtures broke foreign keys.");

db.close();
console.log("Verified P2Q-04 automatic/manual safety holds, human resolution, and reactivation gates.");
