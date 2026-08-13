import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { buildEditorialBootstrapSql, loadEditorialBootstrapFixtures } from "../scripts/editorial-bootstrap-sql.mjs";

test("bootstrap loads exactly the four frozen publications and is idempotent", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of (await readdir(path.join(process.cwd(), "drizzle"))).filter((v) => /^\d+.*\.sql$/.test(v)).sort()) {
    const sql = await readFile(path.join(process.cwd(), "drizzle", name), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((v) => v.trim()).filter(Boolean)) db.exec(statement);
  }
  const fixtures = await loadEditorialBootstrapFixtures();
  assert.equal(fixtures.length, 4);
  for (const { review } of fixtures) {
    db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
      .run(review.titleId, review.titleLabel, review.kind, review.releaseYear);
  }
  const bootstrapSql = buildEditorialBootstrapSql(fixtures);
  db.exec(bootstrapSql);
  db.exec(bootstrapSql);

  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_heads").get().count, 4);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_revisions").get().count, 4);
  for (const fixture of fixtures) {
    const { review, presentation, fingerprint } = fixture;
    const row = db.prepare(`SELECT h.public_id AS publicId,h.title_id AS titleId,h.revision AS headRevision,
      r.revision AS snapshotRevision,r.content_fingerprint AS fingerprint,r.publication_state AS state,
      r.decision_status AS decisionStatus,r.decision_eligible AS decisionEligible
      FROM editorial_publication_heads h JOIN editorial_publication_revisions r ON r.id=h.current_revision_id
      WHERE h.title_id=?`).get(review.titleId) as Record<string, unknown>;
    assert.equal(row.publicId, review.id);
    assert.equal(row.headRevision, presentation.revision);
    assert.equal(row.snapshotRevision, presentation.revision);
    assert.equal(row.fingerprint, fingerprint);
    assert.equal(row.state, "published");
    assert.equal(row.decisionStatus, "insufficient_data");
    assert.equal(row.decisionEligible, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_sources WHERE publication_revision_id=?").get(`${review.id}:r${presentation.revision}`).count, review.sources.length);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_claims WHERE publication_revision_id=?").get(`${review.id}:r${presentation.revision}`).count, review.claims.length);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_uncertain_categories WHERE publication_revision_id=?").get(`${review.id}:r${presentation.revision}`).count, review.uncertainCategories.length);
  }
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  db.close();
});

test("missing catalog title fails closed and creates no public head", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of (await readdir(path.join(process.cwd(), "drizzle"))).filter((v) => /^\d+.*\.sql$/.test(v)).sort()) {
    const sql = await readFile(path.join(process.cwd(), "drizzle", name), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((v) => v.trim()).filter(Boolean)) db.exec(statement);
  }
  const fixtures = await loadEditorialBootstrapFixtures();
  db.exec(buildEditorialBootstrapSql([fixtures[0]]));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_heads").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM editorial_publication_revisions").get().count, 0);
  db.close();
});
