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

db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
  .run("report-title", "Report workflow", "movie", 2026);
for (const [id, label, fingerprint] of [
  ["report-version-a", "A", "report-version-fingerprint-a"],
  ["report-version-b", "B", "report-version-fingerprint-b"],
]) {
  db.prepare(
    `INSERT INTO title_versions
       (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
     VALUES (?, ?, ?, 'test', 'ar', 6000, ?)`,
  ).run(id, "report-title", label, fingerprint);
}

db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
).run("report-editor", "Editor", "editor-group");
db.prepare(
  `INSERT INTO internal_users (id, auth_email, role, reviewer_id, status)
   VALUES (?, ?, 'editorial_reviewer', ?, 'active')`,
).run("report-editor-user", "report-editor@example.com", "report-editor");

db.prepare(
  `INSERT INTO review_bundles (id, version_id, status, revision)
   VALUES (?, ?, 'verified', 5)`,
).run("report-bundle", "report-version-a");
db.prepare(
  `INSERT INTO editorial_approvals
     (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
   VALUES (?, ?, ?, 'approved', 1, 1, ?)`,
).run("report-approval-1", "report-bundle", "report-editor", "2026-08-12T09:00:00.000Z");
db.prepare(
  "UPDATE review_bundles SET current_approval_id = ? WHERE id = ?",
).run("report-approval-1", "report-bundle");

function insertOpenReport(id, versionId, approvalId, previousRevision) {
  db.prepare(
    `INSERT INTO review_reports
       (id, bundle_id, version_id, invalidated_approval_id,
        previous_bundle_status, previous_bundle_revision,
        report_type, message, status, revision)
     VALUES (?, 'report-bundle', ?, ?, 'verified', ?, 'missing_event',
             'بلاغ جوهري صالح للاختبار ويحتاج إلى مراجعة مستقلة.', 'open', 0)`,
  ).run(id, versionId, approvalId, previousRevision);
}

insertOpenReport("report-1", "report-version-a", "report-approval-1", 5);
db.prepare(
  `UPDATE review_bundles
   SET status = 'conflicted', current_approval_id = NULL, revision = 6
   WHERE id = 'report-bundle'`,
).run();

assert.throws(
  () =>
    db.prepare(
      `UPDATE review_bundles
       SET status = 'verified', current_approval_id = 'report-approval-1'
       WHERE id = 'report-bundle'`,
    ).run(),
  /active review report/i,
  "An active report allowed the old approval to become current again.",
);

assert.throws(
  () => insertOpenReport("report-duplicate", "report-version-a", "report-approval-1", 6),
  /unique/i,
  "A second active report was accepted for the same bundle.",
);

assert.throws(
  () =>
    db.prepare(
      `UPDATE review_reports
       SET message = 'tampered identity',
           status = 'investigating',
           revision = 1,
           last_transition_id = 'identity-tamper'
       WHERE id = 'report-1'`,
    ).run(),
  /immutable/i,
  "Report identity fields were mutable.",
);

assert.throws(
  () =>
    db.prepare(
      `UPDATE review_reports
       SET status = 'dismissed', revision = 1, last_transition_id = 'invalid-dismissal'
       WHERE id = 'report-1'`,
    ).run(),
  /transition is invalid/i,
  "A terminal report transition without resolution evidence was accepted.",
);

db.prepare(
  `UPDATE review_reports
   SET status = 'dismissed',
       resolution_kind = 'no_issue',
       resolution_note = 'أعيد فحص البلاغ ولم يظهر اختلاف جوهري في النسخة المعتمدة.',
       resolved_by_user_id = 'report-editor-user',
       resolved_at = '2026-08-12T10:00:00.000Z',
       revision = 1,
       last_transition_id = 'dismiss-transition'
   WHERE id = 'report-1'`,
).run();
db.prepare(
  `UPDATE review_bundles
   SET status = 'verified', current_approval_id = 'report-approval-1', revision = 7
   WHERE id = 'report-bundle'`,
).run();
assert.equal(
  db.prepare("SELECT current_approval_id FROM review_bundles WHERE id = 'report-bundle'").get().current_approval_id,
  "report-approval-1",
  "A dismissed false alarm did not restore the exact invalidated approval.",
);
assert.throws(
  () => db.prepare("DELETE FROM review_reports WHERE id = 'report-1'").run(),
  /cannot be deleted/i,
  "A resolved report could be deleted.",
);

insertOpenReport("report-2", "report-version-a", "report-approval-1", 7);
db.prepare(
  `UPDATE review_bundles
   SET status = 'conflicted', current_approval_id = NULL, revision = 8
   WHERE id = 'report-bundle'`,
).run();
db.prepare(
  `UPDATE review_reports
   SET status = 'resolved',
       resolution_kind = 'correction_required',
       resolution_note = 'أكد التدقيق وجود واقعة ناقصة ويجب إنشاء revisions جديدة ثم اعتماد جديد.',
       resolved_by_user_id = 'report-editor-user',
       resolved_at = '2026-08-12T11:00:00.000Z',
       revision = 1,
       last_transition_id = 'correction-transition'
   WHERE id = 'report-2'`,
).run();
db.prepare(
  `UPDATE review_bundles
   SET status = 'under_review', revision = 9
   WHERE id = 'report-bundle'`,
).run();

assert.throws(
  () =>
    db.prepare(
      `UPDATE review_bundles
       SET current_approval_id = 'report-approval-1'
       WHERE id = 'report-bundle'`,
    ).run(),
  /requires a new editorial approval revision/i,
  "A confirmed correction allowed the invalidated approval to be restored.",
);
assert.throws(
  () =>
    db.prepare(
      `UPDATE review_bundles
       SET status = 'verified'
       WHERE id = 'report-bundle'`,
    ).run(),
  /requires a current editorial approval/i,
  "A bundle became verified without a current approval.",
);

db.prepare(
  `INSERT INTO editorial_approvals
     (id, bundle_id, approver_id, status, revision, supersedes_approval_id,
      version_fingerprint_confirmed, approved_at)
   VALUES (?, ?, ?, 'approved', 2, ?, 1, ?)`,
).run(
  "report-approval-2",
  "report-bundle",
  "report-editor",
  "report-approval-1",
  "2026-08-12T12:00:00.000Z",
);
db.prepare(
  `UPDATE review_bundles
   SET current_approval_id = 'report-approval-2', status = 'verified', revision = 10
   WHERE id = 'report-bundle'`,
).run();
assert.equal(
  db.prepare("SELECT current_approval_id FROM review_bundles WHERE id = 'report-bundle'").get().current_approval_id,
  "report-approval-2",
  "A new approval revision could not become current after correction.",
);

assert.throws(
  () => insertOpenReport("report-wrong-version", "report-version-b", "report-approval-2", 10),
  /opening snapshot is invalid/i,
  "A report was linked to a version different from its bundle.",
);

db.close();
console.log("Verified P2-05 report invalidation, immutable resolution, and mandatory reapproval guards.");
