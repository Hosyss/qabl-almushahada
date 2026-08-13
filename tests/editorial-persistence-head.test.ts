import assert from "node:assert/strict";
import test from "node:test";
import { insertEditorialHead, makeEditorialDb, stageCompleteRevision } from "./editorial-persistence-test-kit.ts";

test("head moves only to the direct complete successor and stale concurrent writers lose", () => {
  const db = makeEditorialDb();
  const r1 = stageCompleteRevision(db, 1);
  insertEditorialHead(db, r1, 1);
  const r2 = stageCompleteRevision(db, 2, r1);
  const first = db.prepare(`UPDATE editorial_publication_heads
    SET current_revision_id = ?, revision = revision + 1, last_transition_id = ?, updated_at = ?
    WHERE title_id = ? AND revision = ?`).run(r2, "transition-2", "2026-08-13T11:00:00Z", "wd:Q1", 1);
  assert.equal(first.changes, 1);
  const stale = db.prepare(`UPDATE editorial_publication_heads
    SET current_revision_id = ?, revision = revision + 1, last_transition_id = ?
    WHERE title_id = ? AND revision = ?`).run(r2, "stale-transition", "wd:Q1", 1);
  assert.equal(stale.changes, 0);
  const head = db.prepare("SELECT current_revision_id AS id, revision FROM editorial_publication_heads WHERE title_id = 'wd:Q1'").get() as { id: string; revision: number };
  assert.deepEqual(head, { id: r2, revision: 2 });
  db.close();
});

test("failed next revision leaves the last good head current", () => {
  const db = makeEditorialDb();
  const r1 = stageCompleteRevision(db, 1);
  insertEditorialHead(db, r1, 1);
  const badR2 = "editorial:test:r2";
  db.prepare(`INSERT INTO editorial_publication_revisions
    (id, public_id, title_id, revision, supersedes_revision_id, revision_kind, publication_state,
     title_label, title_ar, title_en, release_year, kind, policy_version, published_at, updated_at,
     scope_ar, analysis_ar, decision_status, decision_eligible, content_fingerprint)
    VALUES (?, 'editorial:test', 'wd:Q1', 2, ?, 'revision', 'published', 'Test', 'اختبار', 'Test', 2000,
      'movie', 'test-policy', '2026-08-13T10:00:00Z', '2026-08-13T11:00:00Z',
      'نطاق تحريري تجريبي طويل بما يكفي للاختبار فقط.',
      'هذا تحليل تحريري تجريبي طويل بما يكفي لاختبار بقاء الرأس القديم عند فشل النسخة الجديدة.',
      'insufficient_data', 0, ?)`).run(badR2, r1, `sha256:${"c".repeat(64)}`);
  assert.throws(() => db.prepare(`UPDATE editorial_publication_heads
    SET current_revision_id = ?, revision = 2, last_transition_id = 'bad-r2'
    WHERE title_id = 'wd:Q1'`).run(badR2), /requires at least one source/i);
  assert.equal((db.prepare("SELECT current_revision_id AS id FROM editorial_publication_heads WHERE title_id = 'wd:Q1'").get() as { id: string }).id, r1);
  db.close();
});

test("head rejects a skipped revision even if the row points at the same work", () => {
  const db = makeEditorialDb();
  const r1 = stageCompleteRevision(db, 1);
  insertEditorialHead(db, r1, 1);
  assert.throws(() => db.prepare(`INSERT INTO editorial_publication_revisions
    (id, public_id, title_id, revision, supersedes_revision_id, revision_kind, publication_state,
     title_label, title_ar, title_en, release_year, kind, policy_version, published_at, updated_at,
     scope_ar, analysis_ar, decision_status, decision_eligible, content_fingerprint)
    VALUES ('editorial:test:r3', 'editorial:test', 'wd:Q1', 3, ?, 'revision', 'published', 'Test', 'اختبار', 'Test', 2000,
      'movie', 'test-policy', '2026-08-13T10:00:00Z', '2026-08-13T12:00:00Z',
      'نطاق تحريري تجريبي طويل بما يكفي للاختبار فقط.',
      'هذا تحليل تحريري تجريبي طويل بما يكفي لاختبار منع تخطي التسلسل المباشر للرؤوس.',
      'insufficient_data', 0, ?)`).run(r1, `sha256:${"d".repeat(64)}`), /lineage is invalid/i);
  db.close();
});
