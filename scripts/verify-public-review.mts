import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPublicReviewGateQuery,
  type PublicReviewGateExpectation,
} from "../db/public-review-query.ts";

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

function seedPublicBundle(suffix: string) {
  const titleId = `public-title-${suffix}`;
  const versionId = `public-version-${suffix}`;
  const bundleId = `public-bundle-${suffix}`;
  const reviewerId = `public-editor-${suffix}`;
  const approvalId = `public-approval-${suffix}`;

  db.prepare(
    "INSERT INTO titles (id, canonical_name, original_name, kind, release_year) VALUES (?, ?, ?, 'movie', 2026)",
  ).run(titleId, `عنوان ${suffix}`, `Title ${suffix}`);
  db.prepare(
    `INSERT INTO title_versions
       (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status)
     VALUES (?, ?, 'نسخة اختبار', 'test-platform', 'ar', 6000, ?, 'active')`,
  ).run(versionId, titleId, `public-fingerprint-${suffix}-0001`);
  db.prepare(
    "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
  ).run(reviewerId, `Editor ${suffix}`, `editor-group-${suffix}`);
  db.prepare(
    `INSERT INTO review_bundles (id, version_id, status, revision, published_at)
     VALUES (?, ?, 'verified', 1, '2026-08-12T18:05:00.000Z')`,
  ).run(bundleId, versionId);
  db.prepare(
    `INSERT INTO editorial_approvals
       (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
     VALUES (?, ?, ?, 'approved', 1, 1, ?)`,
  ).run(approvalId, bundleId, reviewerId, "2026-08-12T18:00:00.000Z");
  db.prepare(
    `UPDATE review_bundles
     SET current_approval_id = ?
     WHERE id = ?`,
  ).run(approvalId, bundleId);

  return { titleId, versionId, bundleId, reviewerId, approvalId };
}

function readGate(bundleId: string, expectation?: PublicReviewGateExpectation) {
  const query = buildPublicReviewGateQuery(bundleId, expectation);
  return db.prepare(query.sql).get(...query.bindings) as
    | { bundleId: string; bundleRevision: number; approvalId: string }
    | undefined;
}

function expectationFrom(row: { bundleRevision: number; approvalId: string }): PublicReviewGateExpectation {
  return { bundleRevision: row.bundleRevision, approvalId: row.approvalId };
}

const valid = seedPublicBundle("valid");
const validRow = readGate(valid.bundleId);
assert.ok(validRow, "A current verified/active/published/approved bundle was blocked.");
assert.equal(validRow.bundleId, valid.bundleId);
assert.equal(validRow.approvalId, valid.approvalId);

const reportBlocked = seedPublicBundle("report");
db.prepare(
  `INSERT INTO review_reports
     (id, bundle_id, version_id, invalidated_approval_id,
      previous_bundle_status, previous_bundle_revision,
      report_type, message, status, revision)
   VALUES (?, ?, ?, ?, 'verified', 1, 'missing_event', ?, 'open', 0)`,
).run(
  "public-report-open",
  reportBlocked.bundleId,
  reportBlocked.versionId,
  reportBlocked.approvalId,
  "بلاغ جوهري صالح لاختبار بوابة العرض العام ويجب أن يمنع النشر.",
);
assert.equal(readGate(reportBlocked.bundleId), undefined, "An open report did not block the public gate.");
db.prepare(
  `UPDATE review_reports
   SET status = 'investigating', revision = 1, last_transition_id = 'public-report-investigating'
   WHERE id = 'public-report-open'`,
).run();
assert.equal(
  readGate(reportBlocked.bundleId),
  undefined,
  "An investigating report did not block the public gate.",
);

for (const status of ["conflicted", "withdrawn"] as const) {
  const stateBlocked = seedPublicBundle(status);
  db.prepare(
    `UPDATE review_bundles
     SET status = ?, current_approval_id = NULL, revision = revision + 1
     WHERE id = ?`,
  ).run(status, stateBlocked.bundleId);
  assert.equal(
    readGate(stateBlocked.bundleId),
    undefined,
    `A ${status} bundle passed the public gate.`,
  );
}

for (const status of ["superseded", "withdrawn"] as const) {
  const staleVersion = seedPublicBundle(`version-${status}`);
  db.prepare("UPDATE title_versions SET status = ? WHERE id = ?").run(status, staleVersion.versionId);
  assert.equal(
    readGate(staleVersion.bundleId),
    undefined,
    `A ${status} title version passed the public gate.`,
  );
}

const removedApproval = seedPublicBundle("approval-removed");
const removedSnapshot = readGate(removedApproval.bundleId);
assert.ok(removedSnapshot);
db.prepare(
  `UPDATE review_bundles
   SET status = 'conflicted', current_approval_id = NULL, revision = revision + 1
   WHERE id = ?`,
).run(removedApproval.bundleId);
assert.equal(
  readGate(removedApproval.bundleId, expectationFrom(removedSnapshot)),
  undefined,
  "A request survived removal of the current approval.",
);

const changedApproval = seedPublicBundle("approval-changed");
const changedSnapshot = readGate(changedApproval.bundleId);
assert.ok(changedSnapshot);
db.prepare(
  `INSERT INTO editorial_approvals
     (id, bundle_id, approver_id, status, revision, supersedes_approval_id,
      version_fingerprint_confirmed, approved_at)
   VALUES (?, ?, ?, 'approved', 2, ?, 1, ?)`,
).run(
  "public-approval-changed-v2",
  changedApproval.bundleId,
  changedApproval.reviewerId,
  changedApproval.approvalId,
  "2026-08-12T19:00:00.000Z",
);
db.prepare(
  `UPDATE review_bundles
   SET current_approval_id = 'public-approval-changed-v2', revision = revision + 1
   WHERE id = ?`,
).run(changedApproval.bundleId);
assert.equal(
  readGate(changedApproval.bundleId, expectationFrom(changedSnapshot)),
  undefined,
  "A stale request survived a current-approval change.",
);
const freshChangedRow = readGate(changedApproval.bundleId);
assert.ok(freshChangedRow);
assert.equal(freshChangedRow.approvalId, "public-approval-changed-v2");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Public-review verifier broke foreign-key invariants.");

db.close();
console.log(
  "Verified P3-03 public-review final DB gate against migrated SQLite, including stale state and approval races.",
);
