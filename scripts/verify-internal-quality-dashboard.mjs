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

// Minimal fixtures make the read queries cross real foreign keys and return at
// least one conflict/calibration row without mutating any workflow state.
db.prepare(
  "INSERT INTO internal_users (id, auth_email, role, status) VALUES ('quality-admin', 'quality-admin@example.com', 'admin', 'active')",
).run();
db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES ('quality-reviewer', 'Quality reviewer', 'quality-group', 'active')",
).run();
db.prepare(
  `INSERT INTO internal_users
     (id, auth_email, role, reviewer_id, status)
   VALUES ('quality-reviewer-user', 'quality-reviewer@example.com', 'reviewer', 'quality-reviewer', 'active')`,
).run();
db.prepare(
  "INSERT INTO titles (id, canonical_name, kind, release_year) VALUES ('quality-title', 'Quality dashboard fixture', 'movie', 2026)",
).run();
db.prepare(
  `INSERT INTO title_versions
     (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint)
   VALUES ('quality-version', 'quality-title', 'A', 'test-platform', 'ar', 6000, 'quality-dashboard-fingerprint')`,
).run();
db.prepare(
  "INSERT INTO review_bundles (id, version_id, status, revision) VALUES ('quality-conflict', 'quality-version', 'conflicted', 3)",
).run();

const holdRows = db.prepare(
  `SELECT
     h.id AS holdEventId,
     h.entity_id AS reviewerId,
     r.display_label AS reviewerLabel,
     r.status AS reviewerStatus,
     (
       SELECT iu.auth_email FROM internal_users iu
       WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
       ORDER BY iu.created_at DESC, iu.id DESC LIMIT 1
     ) AS reviewerEmail,
     (
       SELECT iu.status FROM internal_users iu
       WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
       ORDER BY iu.created_at DESC, iu.id DESC LIMIT 1
     ) AS accountStatus,
     h.payload_json AS payloadJson,
     h.created_at AS createdAt,
     (
       SELECT x.payload_json FROM internal_audit_events x
       WHERE x.event_type = 'reviewer_safety_hold_resolved'
         AND json_extract(x.payload_json, '$.holdEventId') = h.id
       ORDER BY datetime(x.created_at) DESC, x.id DESC LIMIT 1
     ) AS resolutionPayloadJson,
     (
       SELECT x.created_at FROM internal_audit_events x
       WHERE x.event_type = 'reviewer_safety_hold_resolved'
         AND json_extract(x.payload_json, '$.holdEventId') = h.id
       ORDER BY datetime(x.created_at) DESC, x.id DESC LIMIT 1
     ) AS resolvedAt
   FROM internal_audit_events h
   INNER JOIN reviewers r ON r.id = h.entity_id
   WHERE h.event_type = 'reviewer_safety_hold_placed'
     AND h.entity_type = 'reviewer'
   ORDER BY CASE WHEN resolutionPayloadJson IS NULL THEN 0 ELSE 1 END,
            datetime(h.created_at) DESC, h.id DESC
   LIMIT 50`,
).all();
assert.deepEqual(holdRows, [], "Empty hold fixture unexpectedly returned hold rows.");

const conflictRows = db.prepare(
  `SELECT
     b.id AS bundleId,
     b.version_id AS versionId,
     t.canonical_name AS titleName,
     v.edition_label AS editionLabel,
     v.platform AS platform,
     v.language AS language,
     b.revision AS bundleRevision,
     b.updated_at AS updatedAt,
     (
       SELECT COUNT(*) FROM review_reports rr
       WHERE rr.bundle_id = b.id AND rr.status IN ('open', 'investigating')
     ) AS openReportCount,
     (
       SELECT rr.report_type FROM review_reports rr
       WHERE rr.bundle_id = b.id
       ORDER BY CASE WHEN rr.status IN ('open', 'investigating') THEN 0 ELSE 1 END,
                datetime(rr.created_at) DESC, rr.id DESC LIMIT 1
     ) AS latestReportType,
     (
       SELECT rr.status FROM review_reports rr
       WHERE rr.bundle_id = b.id
       ORDER BY CASE WHEN rr.status IN ('open', 'investigating') THEN 0 ELSE 1 END,
                datetime(rr.created_at) DESC, rr.id DESC LIMIT 1
     ) AS latestReportStatus
   FROM review_bundles b
   INNER JOIN title_versions v ON v.id = b.version_id
   INNER JOIN titles t ON t.id = v.title_id
   WHERE b.status = 'conflicted'
   ORDER BY datetime(b.updated_at) DESC, b.id DESC
   LIMIT 50`,
).all();
assert.equal(conflictRows.length, 1, "Quality dashboard conflict query missed the fixture bundle.");
assert.equal(conflictRows[0].bundleId, "quality-conflict");
assert.equal(conflictRows[0].openReportCount, 0);

const calibrationRows = db.prepare(
  `WITH outcome_stats AS (
     SELECT
       o.id AS outcomeId,
       o.subject_reviewer_id AS reviewerId,
       o.status AS status,
       SUM(CASE WHEN f.finding_type = 'missed_event' THEN 1 ELSE 0 END) AS missedEventCount,
       SUM(CASE WHEN f.finding_type = 'severity_difference' THEN 1 ELSE 0 END) AS severityDifferenceCount,
       COALESCE(MAX(CASE
         WHEN f.finding_type = 'severity_difference'
           THEN abs(f.auditor_severity - f.reviewer_severity)
         ELSE 0
       END), 0) AS maxSeverityDelta
     FROM review_audit_outcomes o
     LEFT JOIN review_audit_findings f ON f.outcome_id = o.id
     WHERE o.status IN ('confirmed', 'correction_required')
     GROUP BY o.id, o.subject_reviewer_id, o.status
   )
   SELECT
     r.id AS reviewerId,
     r.display_label AS reviewerLabel,
     r.status AS reviewerStatus,
     (
       SELECT iu.status FROM internal_users iu
       WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
       ORDER BY iu.created_at DESC, iu.id DESC LIMIT 1
     ) AS accountStatus,
     COUNT(os.outcomeId) AS sampleSize,
     SUM(CASE WHEN os.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedAudits,
     SUM(CASE WHEN os.status = 'correction_required' THEN 1 ELSE 0 END) AS correctionRequiredAudits,
     SUM(CASE WHEN os.missedEventCount > 0 THEN 1 ELSE 0 END) AS auditsWithMissedEvents,
     SUM(CASE WHEN os.severityDifferenceCount > 0 THEN 1 ELSE 0 END) AS auditsWithSeverityDifferences,
     COALESCE(SUM(os.missedEventCount), 0) AS totalMissedEvents,
     COALESCE(SUM(os.severityDifferenceCount), 0) AS totalSeverityDifferences,
     COALESCE(MAX(os.maxSeverityDelta), 0) AS maxObservedSeverityDelta
   FROM reviewers r
   LEFT JOIN outcome_stats os ON os.reviewerId = r.id
   WHERE EXISTS (
     SELECT 1 FROM internal_users iu
     WHERE iu.reviewer_id = r.id AND iu.role IN ('reviewer', 'editorial_reviewer')
   )
   GROUP BY r.id, r.display_label, r.status
   ORDER BY lower(r.display_label), r.id`,
).all();
assert.equal(calibrationRows.length, 1, "Quality dashboard calibration query missed the reviewer fixture.");
assert.equal(calibrationRows[0].sampleSize, 0);
assert.equal(calibrationRows[0].confirmedAudits, 0);
assert.equal(calibrationRows[0].correctionRequiredAudits, 0);

const referenceRows = db.prepare(
  `SELECT
     a.id AS attemptId,
     a.reviewer_id AS reviewerId,
     r.display_label AS reviewerLabel,
     r.status AS reviewerStatus,
     a.purpose AS purpose,
     a.status AS status,
     a.category_agreement_bps AS categoryAgreementBps,
     a.observation_recall_bps AS observationRecallBps,
     a.observation_precision_bps AS observationPrecisionBps,
     a.missed_high_sensitivity_count AS missedHighSensitivityCount,
     a.max_severity_delta AS maxSeverityDelta,
     a.blockers_json AS blockersJson,
     a.started_at AS startedAt,
     a.completed_at AS completedAt
   FROM reviewer_reference_attempts a
   INNER JOIN reviewers r ON r.id = a.reviewer_id
   WHERE a.id = (
     SELECT a2.id FROM reviewer_reference_attempts a2
     WHERE a2.reviewer_id = a.reviewer_id
     ORDER BY datetime(COALESCE(a2.completed_at, a2.started_at)) DESC, a2.id DESC
     LIMIT 1
   )
   ORDER BY lower(r.display_label), r.id`,
).all();
assert.deepEqual(referenceRows, [], "Reference-attempt fixture should be empty in the read-query verifier.");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Quality dashboard query verifier broke foreign keys.");

db.close();
console.log("Verified P2Q-05 quality dashboard read queries against the migrated SQLite schema.");
