import assert from "node:assert/strict";
import test from "node:test";
import { insertEditorialHead, makeEditorialDb, stageCompleteRevision } from "./editorial-persistence-test-kit.ts";

test("incomplete editorial snapshots cannot become current", () => {
  const db = makeEditorialDb();
  db.prepare(`INSERT INTO editorial_publication_revisions
    (id, public_id, title_id, revision, revision_kind, publication_state, title_label, title_ar, title_en,
     release_year, kind, policy_version, published_at, updated_at, scope_ar, analysis_ar,
     decision_status, decision_eligible, content_fingerprint)
    VALUES ('bad:r1', 'editorial:bad', 'wd:Q1', 1, 'initial', 'published', 'Bad', 'اختبار', 'Bad', 2000,
      'movie', 'test-policy', '2026-08-13T10:00:00Z', '2026-08-13T10:00:00Z',
      'نطاق تحريري تجريبي طويل بما يكفي للاختبار فقط.',
      'هذا تحليل تحريري تجريبي طويل بما يكفي لاختبار فشل اللقطة الناقصة بشكل مغلق.',
      'insufficient_data', 0, ?)`).run(`sha256:${"b".repeat(64)}`);
  assert.throws(() => db.prepare(`INSERT INTO editorial_publication_heads
    (title_id, public_id, current_revision_id, revision, last_transition_id)
    VALUES ('wd:Q1', 'editorial:bad', 'bad:r1', 1, 'bad-transition')`).run(), /requires at least one source/i);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_heads").get().count, 0);
  db.close();
});

test("current and historical editorial records cannot be rewritten or deleted", () => {
  const db = makeEditorialDb();
  const r1 = stageCompleteRevision(db, 1);
  insertEditorialHead(db, r1, 1);
  assert.throws(() => db.prepare("UPDATE editorial_publication_revisions SET analysis_ar = analysis_ar || ' x' WHERE id = ?").run(r1), /append-only/i);
  assert.throws(() => db.prepare("DELETE FROM editorial_publication_revisions WHERE id = ?").run(r1), /append-only/i);
  assert.throws(() => db.prepare("DELETE FROM editorial_publication_sources WHERE publication_revision_id = ?").run(r1), /append-only/i);
  assert.throws(() => db.prepare("DELETE FROM editorial_publication_claims WHERE publication_revision_id = ?").run(r1), /append-only/i);
  assert.throws(() => db.prepare(`INSERT INTO editorial_publication_uncertain_categories
    (publication_revision_id, category) VALUES (?, 'fear')`).run(r1), /finalized.*immutable/i);
  assert.throws(() => db.prepare("DELETE FROM editorial_publication_heads WHERE title_id = 'wd:Q1'").run(), /cannot be deleted/i);
  db.close();
});
