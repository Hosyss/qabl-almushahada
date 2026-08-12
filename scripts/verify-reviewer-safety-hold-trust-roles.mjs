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
  ["trust-admin", "trust-admin@example.com", "admin"],
  ["trust-coordinator", "trust-coordinator@example.com", "review_coordinator"],
]) {
  db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, ?, 'active')")
    .run(id, email, role);
}
for (const [reviewerId, userId, email, role, group] of [
  ["held-editor", "held-editor-user", "held-editor@example.com", "editorial_reviewer", "held-editor-group"],
  ["other-editor", "other-editor-user", "other-editor@example.com", "editorial_reviewer", "other-editor-group"],
  ["trust-subject", "trust-subject-user", "trust-subject@example.com", "reviewer", "trust-subject-group"],
]) {
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status, updated_at) VALUES (?, ?, ?, 'active', '2026-08-12 00:00:00')",
  ).run(reviewerId, reviewerId, group);
  db.prepare(
    "INSERT INTO internal_users (id, auth_email, role, reviewer_id, status) VALUES (?, ?, ?, ?, 'active')",
  ).run(userId, email, role, reviewerId);
}

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES ('trust-title', 'Trust role fixture', 'movie', 2026)").run();
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES ('trust-version', 'trust-title', 'A', 'test', 'ar', 6000, 'trust-role-fingerprint')`,
).run();

function createBundle(prefix, selected) {
  const bundleId = `${prefix}-bundle`;
  const assignmentId = `${prefix}-assignment`;
  const submissionId = `${prefix}-submission`;
  const selectionId = `${prefix}-selection`;
  db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES (?, 'trust-version', 'under_review')")
    .run(bundleId);
  db.prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
     VALUES (?, ?, 'trust-version', 'trust-subject', 'trust-coordinator', 'in_progress', 0)`,
  ).run(assignmentId, bundleId);
  db.prepare(
    `INSERT INTO review_submissions
       (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
        started_at, completed_at, watched_seconds, declared_complete)
     VALUES (?, ?, 'trust-version', 'trust-subject', ?, 1,
             '2026-08-12T01:00:00.000Z', '2026-08-12T02:30:00.000Z', 5900, 1)`,
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
     VALUES (?, ?, ?, ?, 'trust-version', 'trust-subject',
             'baseline', 1000, ?, ?, '[]')`,
  ).run(selectionId, submissionId, assignmentId, selected ? 0 : 4294967295, selected ? 1 : 0);
  return { bundleId, assignmentId, submissionId, selectionId };
}

function approveBundle(fixture, approverId, approvalId) {
  db.prepare("UPDATE review_assignments SET state = 'approved' WHERE id = ?").run(fixture.assignmentId);
  db.prepare(
    `INSERT INTO editorial_approvals
       (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
     VALUES (?, ?, ?, 'approved', 1, 1, '2026-08-12T03:00:00.000Z')`,
  ).run(approvalId, fixture.bundleId, approverId);
  db.prepare(
    "INSERT INTO editorial_approval_submissions (approval_id, submission_id) VALUES (?, ?)",
  ).run(approvalId, fixture.submissionId);
  db.prepare("UPDATE review_bundles SET current_approval_id = ? WHERE id = ?")
    .run(approvalId, fixture.bundleId);
  db.prepare("UPDATE review_bundles SET status = 'verified' WHERE id = ?").run(fixture.bundleId);
}

// The held identity contributes only as current editorial approver here.
const approvalBundle = createBundle("approval-role", false);
approveBundle(approvalBundle, "held-editor", "approval-role-approval");

// The held identity contributes only as the independent auditor here; another
// editor owns the final approval.
const auditBundle = createBundle("audit-role", true);
db.prepare(
  `INSERT INTO review_audit_outcomes
     (id, selection_id, submission_id, assignment_id, bundle_id, version_id,
      subject_reviewer_id, auditor_user_id, auditor_reviewer_id, status, notes, revision)
   VALUES ('audit-role-outcome', ?, ?, ?, ?, 'trust-version', 'trust-subject',
           'held-editor-user', 'held-editor', 'pending', '', 0)`,
).run(auditBundle.selectionId, auditBundle.submissionId, auditBundle.assignmentId, auditBundle.bundleId);
db.prepare(
  `UPDATE review_audit_outcomes
   SET status = 'confirmed', revision = 1,
       final_transition_id = 'audit-role-outcome-final', completed_at = '2026-08-12T02:45:00.000Z'
   WHERE id = 'audit-role-outcome'`,
).run();
approveBundle(auditBundle, "other-editor", "audit-role-approval");

// This verified bundle has no current trust contribution from the held identity
// and must remain untouched.
const unrelatedBundle = createBundle("unrelated-role", false);
approveBundle(unrelatedBundle, "other-editor", "unrelated-role-approval");

db.prepare(
  `INSERT INTO internal_audit_events
     (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
   VALUES ('held-editor-evidence', 'trust-admin', 'manual_suspicion_evidence',
           'reviewer', 'held-editor', ?)`,
).run(JSON.stringify({ reviewerId: "held-editor", summary: "Stored evidence requiring a human trust-role investigation." }));

db.prepare(
  `INSERT INTO internal_audit_events
     (id, actor_user_id, event_type, entity_type, entity_id, payload_json)
   VALUES ('held-editor-hold', 'trust-admin', 'reviewer_safety_hold_placed',
           'reviewer', 'held-editor', ?)`,
).run(JSON.stringify({
  source: "manual_collusion_suspicion",
  policyVersion: "2026-08-12.v1",
  triggerCodes: ["COLLUSION_SUSPICION"],
  evidence: {
    note: "Human investigation is required before this identity can contribute trust in any internal role.",
    evidenceEventIds: ["held-editor-evidence"],
  },
}));

for (const bundleId of [approvalBundle.bundleId, auditBundle.bundleId]) {
  const row = db.prepare("SELECT status, current_approval_id AS currentApprovalId FROM review_bundles WHERE id = ?")
    .get(bundleId);
  assert.equal(row.status, "conflicted", `${bundleId} stayed publishable after a held identity remained a current trust contributor.`);
  assert.equal(row.currentApprovalId, null, `${bundleId} kept a current approval after a held trust contributor.`);
}

const unrelated = db.prepare(
  "SELECT status, current_approval_id AS currentApprovalId FROM review_bundles WHERE id = ?",
).get(unrelatedBundle.bundleId);
assert.equal(unrelated.status, "verified", "A bundle unrelated to the held identity was invalidated too broadly.");
assert.equal(unrelated.currentApprovalId, "unrelated-role-approval");
assert.equal(db.prepare("SELECT status FROM reviewers WHERE id = 'held-editor'").get().status, "suspended");
assert.equal(db.prepare("SELECT status FROM internal_users WHERE id = 'held-editor-user'").get().status, "suspended");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Trust-role safety-hold verifier broke foreign keys.");

db.close();
console.log("Verified P2Q-04 hold invalidation across reviewer, auditor, and editorial-approver trust roles.");
