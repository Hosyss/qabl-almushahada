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
  .run("audit-title", "Random audit fixture");
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES (?, ?, 'A', 'test', 'ar', 6000, ?)`,
).run("audit-version", "audit-title", "random-audit-fingerprint");

db.prepare("INSERT INTO review_bundles (id, version_id, status) VALUES (?, ?, 'under_review')")
  .run("audit-bundle", "audit-version");
db.prepare("INSERT INTO internal_users (id, auth_email, role, status) VALUES (?, ?, 'review_coordinator', 'active')")
  .run("audit-coordinator", "audit-coordinator@example.com");

for (const [reviewerId, label, group] of [
  ["audit-reviewer-high", "High risk reviewer", "audit-group-high"],
  ["audit-reviewer-base", "Baseline reviewer", "audit-group-base"],
  ["audit-reviewer-missing", "Missing decision reviewer", "audit-group-missing"],
]) {
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
  ).run(reviewerId, label, group);
}

function makeSubmittedAssignment({ assignmentId, reviewerId, submissionId }) {
  db.prepare(
    `INSERT INTO review_assignments
       (id, bundle_id, version_id, reviewer_id, assigned_by_user_id, state, revision)
     VALUES (?, 'audit-bundle', 'audit-version', ?, 'audit-coordinator', 'in_progress', 0)`,
  ).run(assignmentId, reviewerId);
  db.prepare(
    `INSERT INTO review_submissions
       (id, bundle_id, version_id, reviewer_id, assignment_id, revision,
        started_at, completed_at, watched_seconds, declared_complete)
     VALUES (?, 'audit-bundle', 'audit-version', ?, ?, 1,
             '2026-08-12T10:00:00.000Z', '2026-08-12T12:00:00.000Z', 5900, 1)`,
  ).run(submissionId, reviewerId, assignmentId);
  db.prepare(
    `UPDATE review_assignments
     SET state = 'submitted', submission_id = ?, revision = revision + 1
     WHERE id = ?`,
  ).run(submissionId, assignmentId);
}

makeSubmittedAssignment({
  assignmentId: "audit-assignment-high",
  reviewerId: "audit-reviewer-high",
  submissionId: "audit-submission-high",
});
db.prepare(
  `INSERT INTO observations
     (id, submission_id, category, severity, start_second, end_second,
      frequency, context, spoiler_level, summary)
   VALUES ('audit-observation-high', 'audit-submission-high', 'selfHarm', 1, 100, 120,
           'single', 'distressing', 'contextual', 'High-sensitivity audit fixture')`,
).run();

const insertDecision = db.prepare(
  `INSERT INTO review_audit_selections
     (id, submission_id, assignment_id, bundle_id, version_id, reviewer_id,
      risk_tier, sample_rate_bps, draw_u32, selected, risk_triggers_json)
   VALUES (?, ?, ?, 'audit-bundle', 'audit-version', ?, ?, ?, ?, ?, ?)`,
);

assert.throws(
  () =>
    insertDecision.run(
      "audit-decision-downrated",
      "audit-submission-high",
      "audit-assignment-high",
      "audit-reviewer-high",
      "baseline",
      1000,
      0,
      1,
      "[]",
    ),
  /selection decision is invalid/i,
  "Database allowed a high-risk submission to be downgraded to baseline sampling.",
);

assert.throws(
  () =>
    insertDecision.run(
      "audit-decision-empty-risk",
      "audit-submission-high",
      "audit-assignment-high",
      "audit-reviewer-high",
      "high_risk",
      5000,
      0,
      1,
      "[]",
    ),
  /selection decision is invalid/i,
  "Database accepted a high-risk decision without a recorded trigger.",
);

insertDecision.run(
  "audit-decision-high",
  "audit-submission-high",
  "audit-assignment-high",
  "audit-reviewer-high",
  "high_risk",
  5000,
  2147483648,
  0,
  '["sensitive_category_threshold"]',
);
assert.equal(
  db.prepare("SELECT selected FROM review_audit_selections WHERE id = 'audit-decision-high'").get().selected,
  0,
  "High-risk threshold boundary should not select a draw equal to the exclusive threshold.",
);
assert.throws(
  () => db.prepare("UPDATE review_audit_selections SET selected = 1 WHERE id = 'audit-decision-high'").run(),
  /append-only/i,
  "Audit selection decision could be modified after insertion.",
);
assert.throws(
  () => db.prepare("DELETE FROM review_audit_selections WHERE id = 'audit-decision-high'").run(),
  /append-only/i,
  "Audit selection decision could be deleted after insertion.",
);

makeSubmittedAssignment({
  assignmentId: "audit-assignment-base",
  reviewerId: "audit-reviewer-base",
  submissionId: "audit-submission-base",
});
assert.throws(
  () =>
    insertDecision.run(
      "audit-decision-forged-draw",
      "audit-submission-base",
      "audit-assignment-base",
      "audit-reviewer-base",
      "baseline",
      1000,
      0,
      0,
      "[]",
    ),
  /selection decision is invalid/i,
  "Database accepted a forged non-selected result for draw zero.",
);
insertDecision.run(
  "audit-decision-base",
  "audit-submission-base",
  "audit-assignment-base",
  "audit-reviewer-base",
  "baseline",
  1000,
  0,
  1,
  "[]",
);
assert.equal(
  db.prepare("SELECT selected FROM review_audit_selections WHERE id = 'audit-decision-base'").get().selected,
  1,
  "Baseline draw zero should be selected.",
);

makeSubmittedAssignment({
  assignmentId: "audit-assignment-missing",
  reviewerId: "audit-reviewer-missing",
  submissionId: "audit-submission-missing",
});
assert.throws(
  () =>
    db.prepare("UPDATE review_assignments SET state = 'approved' WHERE id = 'audit-assignment-missing'").run(),
  /no post-submission audit selection decision/i,
  "An assignment was approved without any audit-selection decision.",
);

insertDecision.run(
  "audit-decision-missing-now-recorded",
  "audit-submission-missing",
  "audit-assignment-missing",
  "audit-reviewer-missing",
  "baseline",
  1000,
  4294967295,
  0,
  "[]",
);
const approvalTransition = db
  .prepare("UPDATE review_assignments SET state = 'approved' WHERE id = 'audit-assignment-missing'")
  .run();
assert.equal(approvalTransition.changes, 1, "Assignment could not proceed after a valid audit decision existed.");

assert.throws(
  () =>
    insertDecision.run(
      "audit-decision-duplicate",
      "audit-submission-base",
      "audit-assignment-base",
      "audit-reviewer-base",
      "baseline",
      1000,
      4294967295,
      0,
      "[]",
    ),
  /unique/i,
  "A submission received more than one random-audit selection decision.",
);

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Random audit migration fixtures broke foreign keys.");

db.close();
console.log("Verified P2Q-01 unpredictable post-submission audit selection guards.");
