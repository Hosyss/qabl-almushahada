import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY } from "../db/public-editorial-head-query.ts";
import { buildEditorialPublicationFingerprint } from "../lib/editorial-publication-integrity.ts";
import { buildEditorialBootstrapSql, loadEditorialBootstrapFixtures } from "../scripts/editorial-bootstrap-sql.mjs";

async function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const migrationDir = path.join(process.cwd(), "drizzle");
  for (const name of (await readdir(migrationDir)).filter((value) => /^\d+.*\.sql$/u.test(value)).sort()) {
    const sql = await readFile(path.join(migrationDir, name), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  }
  const fixtures = await loadEditorialBootstrapFixtures();
  for (const { review } of fixtures) {
    db.prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
      .run(review.titleId, review.titleLabel, review.kind, review.releaseYear);
  }
  db.exec(buildEditorialBootstrapSql(fixtures));
  return { db, fixtures };
}

test("public editorial lookup can resolve only the current head, never an arbitrary snapshot id", async () => {
  const { db, fixtures } = await makeDb();
  const fixture = fixtures[0];
  const currentId = `${fixture.review.id}:r${fixture.presentation.revision}`;
  const current = db.prepare(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY).get(fixture.review.id) as { snapshotId: string; revision: number };
  assert.equal(current.snapshotId, currentId);
  assert.equal(current.revision, fixture.presentation.revision);

  const arbitrarySnapshotLookup = db.prepare(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY).get(currentId);
  assert.equal(arbitrarySnapshotLookup, undefined);
  assert.match(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY, /h\.public_id=\?1/u);
  assert.match(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY, /r\.id=h\.current_revision_id/u);
  assert.doesNotMatch(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY, /r\.id\s*=\s*\?1/u);
  db.close();
});

test("a staged successor does not become public until the head moves", async () => {
  const { db, fixtures } = await makeDb();
  const fixture = fixtures[0];
  const currentId = `${fixture.review.id}:r${fixture.presentation.revision}`;
  const nextRevision = fixture.presentation.revision + 1;
  const nextId = `${fixture.review.id}:r${nextRevision}`;
  db.prepare(`INSERT INTO editorial_publication_revisions
    (id,public_id,title_id,revision,supersedes_revision_id,revision_kind,publication_state,title_label,title_ar,title_en,
     release_year,kind,policy_version,published_at,updated_at,scope_ar,analysis_ar,decision_status,decision_eligible,content_fingerprint)
    VALUES (?,?,?,?,?,'revision','published',?,?,?,?,?,?,?,?,?,?,'insufficient_data',0,?)`)
    .run(
      nextId, fixture.review.id, fixture.review.titleId, nextRevision, currentId,
      fixture.review.titleLabel, fixture.presentation.titleAr, fixture.presentation.titleEn,
      fixture.review.releaseYear, fixture.review.kind, fixture.review.policyVersion,
      fixture.review.publishedAt, fixture.presentation.updatedAt, fixture.review.scopeAr,
      fixture.review.analysisAr, fixture.fingerprint,
    );
  const current = db.prepare(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY).get(fixture.review.id) as { snapshotId: string };
  assert.equal(current.snapshotId, currentId);
  assert.notEqual(current.snapshotId, nextId);
  db.close();
});

test("content tampering changes the canonical fingerprint and the hydrator keeps a mismatch fail-closed guard", async () => {
  const fixtures = await loadEditorialBootstrapFixtures();
  const fixture = fixtures[0];
  const tampered = { ...fixture.review, analysisAr: `${fixture.review.analysisAr} تغيير غير معتمد` };
  const fingerprint = await buildEditorialPublicationFingerprint(tampered, fixture.presentation);
  assert.notEqual(fingerprint, fixture.fingerprint);
  const hydrator = await readFile(path.join(process.cwd(), "lib", "editorial-publication-hydrate.ts"), "utf8");
  assert.match(hydrator, /fingerprint !== head\.contentFingerprint\) return null/u);
});
