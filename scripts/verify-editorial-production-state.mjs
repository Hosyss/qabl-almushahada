import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadEditorialBootstrapFixtures } from "./editorial-bootstrap-sql.mjs";

const resultPath = process.argv[2];
if (!resultPath) throw new Error("Usage: node scripts/verify-editorial-production-state.mjs <wrangler-json>");

const fixtures = await loadEditorialBootstrapFixtures();
if (fixtures.length !== 4) throw new Error(`Expected 4 frozen editorial fixtures, found ${fixtures.length}.`);

const payload = JSON.parse(await readFile(path.resolve(resultPath), "utf8"));
const rows = collectRows(payload).filter((row) => typeof row.publicId === "string");
if (rows.length !== 4) throw new Error(`Expected exactly 4 current editorial heads in production, found ${rows.length}.`);

const expected = new Map(fixtures.map((fixture) => [fixture.review.id, {
  titleId: fixture.review.titleId,
  revision: fixture.presentation.revision,
  fingerprint: fixture.fingerprint,
  sourceCount: fixture.review.sources.length,
  claimCount: fixture.review.claims.length,
  claimSourceCount: fixture.review.claims.reduce((sum, claim) => sum + claim.sourceIds.length, 0),
  uncertainCount: fixture.review.uncertainCategories.length,
}]));

for (const row of rows) {
  const wanted = expected.get(row.publicId);
  if (!wanted) throw new Error(`Unexpected current editorial publication in production: ${row.publicId}.`);
  if (row.titleId !== wanted.titleId) throw new Error(`${row.publicId}: title_id mismatch.`);
  if (Number(row.revision) !== wanted.revision) throw new Error(`${row.publicId}: revision mismatch.`);
  if (row.publicationState !== "published") throw new Error(`${row.publicId}: current revision is not published.`);
  if (row.decisionStatus !== "insufficient_data" || Number(row.decisionEligible) !== 0) {
    throw new Error(`${row.publicId}: suitability decision gate changed.`);
  }
  if (row.contentFingerprint !== wanted.fingerprint) throw new Error(`${row.publicId}: fingerprint mismatch.`);
  for (const [field, expectedCount] of [
    ["sourceCount", wanted.sourceCount],
    ["claimCount", wanted.claimCount],
    ["claimSourceCount", wanted.claimSourceCount],
    ["uncertainCount", wanted.uncertainCount],
  ]) {
    if (Number(row[field]) !== expectedCount) throw new Error(`${row.publicId}: ${field} mismatch.`);
  }
  expected.delete(row.publicId);
}

if (expected.size) throw new Error(`Missing production editorial heads: ${[...expected.keys()].join(", ")}.`);
console.log("Verified 4 production editorial current heads exactly match the frozen P4-03B4 bootstrap fixtures.");

function collectRows(value, rows = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRows(item, rows);
    return rows;
  }
  if (!value || typeof value !== "object") return rows;
  if (typeof value.publicId === "string") rows.push(value);
  for (const child of Object.values(value)) collectRows(child, rows);
  return rows;
}
