import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { loadEditorialBootstrapFixtures } from "../scripts/editorial-bootstrap-sql.mjs";
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
    /exactly 4 current editorial heads/u,
  );
});
