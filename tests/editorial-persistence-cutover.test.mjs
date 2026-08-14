import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY } from "../db/public-editorial-head-query.ts";
import { buildEditorialPublicationFingerprint } from "../lib/editorial-publication-integrity.ts";
import { buildEditorialBootstrapSql, loadEditorialBootstrapFixtures } from "../scripts/editorial-bootstrap-sql.mjs";
import { verifyEditorialProductionRows } from "../scripts/cloudflare-migrate.mjs";

const root = process.cwd();

async function sourceFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await sourceFiles(fullPath));
    else if (/\.(?:ts|tsx|mjs)$/u.test(entry.name)) output.push(fullPath);
  }
  return output;
}

async function editorialDb() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const migrationDir = path.join(root, "drizzle");
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

function getByPublicId(db, publicId) {
  return db.prepare(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY).get({ "?1": publicId });
}

test("production runtime has no TypeScript editorial registry or bootstrap-data fallback", async () => {
  assert.equal(existsSync(path.join(root, "lib", "editorial-review-registry.ts")), false);
  assert.equal(existsSync(path.join(root, "lib", "editorial-review-publications")), false);

  for (const directoryName of ["app", "db", "lib"]) {
    for (const file of await sourceFiles(path.join(root, directoryName))) {
      const source = await readFile(file, "utf8");
      assert.equal(source.includes("editorial-review-registry"), false, file);
      assert.equal(source.includes("data/editorial-bootstrap"), false, file);
    }
  }
});

test("public editorial lookup resolves only the current head and never an arbitrary snapshot id", async () => {
  const { db, fixtures } = await editorialDb();
  const fixture = fixtures[0];
  const currentId = `${fixture.review.id}:r${fixture.presentation.revision}`;
  const current = getByPublicId(db, fixture.review.id);
  assert.equal(current?.snapshotId, currentId);
  assert.equal(current?.revision, fixture.presentation.revision);
  assert.equal(getByPublicId(db, currentId), undefined);
  assert.match(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY, /h\.public_id=\?1/u);
  assert.match(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY, /r\.id=h\.current_revision_id/u);
  assert.doesNotMatch(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY, /r\.id\s*=\s*\?1/u);
  db.close();
});

test("a staged successor is not public until the current head moves", async () => {
  const { db, fixtures } = await editorialDb();
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
  const current = getByPublicId(db, fixture.review.id);
  assert.equal(current?.snapshotId, currentId);
  assert.notEqual(current?.snapshotId, nextId);
  db.close();
});

test("fingerprint tampering changes canonical content and hydrator keeps mismatch fail-closed", async () => {
  const fixtures = await loadEditorialBootstrapFixtures();
  const fixture = fixtures[0];
  const tampered = { ...fixture.review, analysisAr: `${fixture.review.analysisAr} تغيير غير معتمد` };
  const fingerprint = await buildEditorialPublicationFingerprint(tampered, fixture.presentation);
  assert.notEqual(fingerprint, fixture.fingerprint);
  const hydrator = await readFile(path.join(root, "lib", "editorial-publication-hydrate.ts"), "utf8");
  assert.match(hydrator, /fingerprint !== head\.contentFingerprint\) return null/u);
});

test("production verification requires exact frozen current-head parity and insufficient-data authority", async () => {
  const fixtures = await loadEditorialBootstrapFixtures();
  const rows = fixtures.map((fixture) => ({
    titleId: fixture.review.titleId,
    publicId: fixture.review.id,
    revision: fixture.presentation.revision,
    publicationState: "published",
    decisionStatus: "insufficient_data",
    decisionEligible: 0,
    contentFingerprint: fixture.fingerprint,
    sourceCount: fixture.review.sources.length,
    claimCount: fixture.review.claims.length,
    claimSourceCount: fixture.review.claims.reduce((sum, claim) => sum + claim.sourceIds.length, 0),
    uncertainCount: fixture.review.uncertainCategories.length,
  }));

  assert.equal(verifyEditorialProductionRows(rows, fixtures), true);

  const promoted = structuredClone(rows);
  promoted[0].decisionEligible = 1;
  promoted[0].decisionStatus = "suitable";
  assert.throws(() => verifyEditorialProductionRows(promoted, fixtures), /decision gate/u);

  const tampered = structuredClone(rows);
  tampered[1].contentFingerprint = "sha256:" + "0".repeat(64);
  assert.throws(() => verifyEditorialProductionRows(tampered, fixtures), /fingerprint mismatch/u);

  const incomplete = structuredClone(rows);
  incomplete[2].claimCount -= 1;
  assert.throws(() => verifyEditorialProductionRows(incomplete, fixtures), /claimCount mismatch/u);

  assert.throws(
    () => verifyEditorialProductionRows([...rows, { ...rows[0], publicId: "unexpected-publication" }], fixtures),
    /exactly 7 current editorial heads/u,
  );
});
