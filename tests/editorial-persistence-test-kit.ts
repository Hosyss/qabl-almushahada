import { readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const migrations = [
  "0021_editorial_publication_revisions.sql",
  "0022_editorial_publication_children.sql",
  "0023_editorial_publication_heads.sql",
  "0024_editorial_publication_immutability.sql",
  "0025_editorial_publication_head_insert_gate.sql",
  "0026_editorial_publication_head_update_gate.sql",
];
const categories = ["fear", "violence", "language", "bullying", "sexualContent", "substances", "discrimination", "selfHarm", "grief", "flashingLights"] as const;

export function makeEditorialDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE titles (id TEXT PRIMARY KEY NOT NULL)");
  for (const name of migrations) {
    const sql = readFileSync(path.join(process.cwd(), "drizzle", name), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  }
  db.prepare("INSERT INTO titles (id) VALUES ('wd:Q1')").run();
  return db;
}

export function stageCompleteRevision(db: DatabaseSync, revision: number, predecessor: string | null = null) {
  const snapshotId = `editorial:test:r${revision}`;
  db.prepare(`INSERT INTO editorial_publication_revisions
    (id, public_id, title_id, revision, supersedes_revision_id, revision_kind, publication_state,
     title_label, title_ar, title_en, release_year, kind, policy_version, published_at, updated_at,
     scope_ar, analysis_ar, decision_status, decision_eligible, content_fingerprint)
    VALUES (?, 'editorial:test', 'wd:Q1', ?, ?, ?, 'published', 'Test', 'اختبار', 'Test', 2000, 'movie',
      'test-policy', '2026-08-13T10:00:00Z', '2026-08-13T10:00:00Z',
      'نطاق تحريري تجريبي طويل بما يكفي للاختبار فقط.',
      'هذا تحليل تحريري تجريبي طويل بما يكفي لاختبار عقد التخزين دون إصدار أي حكم ملاءمة.',
      'insufficient_data', 0, ?)`)
    .run(snapshotId, revision, predecessor, predecessor ? "revision" : "initial", `sha256:${"a".repeat(64)}`);
  const sourceId = `${snapshotId}:source:s1`;
  db.prepare(`INSERT INTO editorial_publication_sources
    (id, publication_revision_id, source_key, publisher, source_type, source_url, accessed_on, independence_group_id,
     usage_basis, rights_label, rights_url, usage_note_ar)
    VALUES (?, ?, 's1', 'Publisher', 'published_review', 'https://example.com/review', '2026-08-13', 'publisher-group',
      'link_only_factual_reference', 'Link-only factual reference', 'https://example.com/terms',
      'نستخدم الرابط كمرجع للوقائع فقط دون نقل التعبير الأصلي.')`).run(sourceId, snapshotId);
  const claimId = `${snapshotId}:claim:c1`;
  db.prepare(`INSERT INTO editorial_publication_claims
    (id, publication_revision_id, claim_key, category, summary_ar, verification)
    VALUES (?, ?, 'c1', 'fear', 'توجد لحظة خوف موصوفة بوضوح في المرجع المرتبط.', 'single_source')`).run(claimId, snapshotId);
  db.prepare("INSERT INTO editorial_publication_claim_sources (publication_revision_id, claim_id, source_id) VALUES (?, ?, ?)").run(snapshotId, claimId, sourceId);
  for (const category of categories.filter((value) => value !== "fear")) {
    db.prepare("INSERT INTO editorial_publication_uncertain_categories (publication_revision_id, category) VALUES (?, ?)").run(snapshotId, category);
  }
  return snapshotId;
}

export function insertEditorialHead(db: DatabaseSync, snapshotId: string, revision: number) {
  return db.prepare(`INSERT INTO editorial_publication_heads
    (title_id, public_id, current_revision_id, revision, last_transition_id, updated_at)
    VALUES ('wd:Q1', 'editorial:test', ?, ?, ?, '2026-08-13T10:00:00Z')`).run(snapshotId, revision, `transition-${revision}`);
}
