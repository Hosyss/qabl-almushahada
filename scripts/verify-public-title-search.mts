import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parsePublicTitleSearchRequest, rankPublicTitleSearchCandidates, type PublicTitleSearchCandidate } from "../lib/public-title-search.ts";
import { buildPublicTitleCandidateQuery } from "../db/public-title-search-query.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(root, "drizzle");
const migrationFiles = (await readdir(migrationDirectory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
for (const migrationFile of migrationFiles) {
  const sql = await readFile(path.join(migrationDirectory, migrationFile), "utf8");
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) db.exec(statement);
}

const insertTitle = db.prepare(`INSERT INTO titles (id, canonical_name, original_name, kind, release_year) VALUES (?, ?, ?, ?, ?)`);
insertTitle.run("search-arabic", "إِنْسَايْد—آوْت ٢", "Inside Out 2", "movie", 2024);
insertTitle.run("search-original", "البحث عن نيمو", "Finding Nemo", "movie", 2003);
insertTitle.run("search-unrelated", "مدينة الغيم", "Cloud City", "series", 2025);

db.prepare(`INSERT INTO title_versions (id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`).run(
  "search-version", "search-original", "نسخة اختبار", "test", "ar", 6000, "search-fingerprint-0001",
);
db.prepare(`INSERT INTO review_bundles (id, version_id, status) VALUES (?, ?, 'under_review')`).run("search-bundle", "search-version");

function executeSearch(query: string) {
  const parsed = parsePublicTitleSearchRequest({ query });
  const candidateQuery = buildPublicTitleCandidateQuery(parsed);
  const rows = db.prepare(candidateQuery.sql).all(...candidateQuery.bindings) as Array<{
    id: string; canonicalName: string; originalName: string | null; kind: "movie" | "series" | "episode" | "special";
    releaseYear: number; hasVerifiedReview: number; hasReviewInProgress: number;
  }>;
  const candidates: PublicTitleSearchCandidate[] = rows.map((row) => ({
    id: row.id, canonicalName: row.canonicalName, originalName: row.originalName, kind: row.kind, releaseYear: row.releaseYear,
    hasVerifiedReview: row.hasVerifiedReview === 1, hasReviewInProgress: row.hasReviewInProgress === 1,
  }));
  return rankPublicTitleSearchCandidates(parsed, candidates);
}

const arabicResults = executeSearch("انسايد اوت 2");
assert.equal(arabicResults[0]?.id, "search-arabic");
assert.equal(arabicResults[0]?.matchKind, "canonical_exact");
assert.equal(arabicResults[0]?.hasReviewInProgress, false);

const originalResults = executeSearch("FINDING NEMO");
assert.equal(originalResults[0]?.id, "search-original");
assert.equal(originalResults[0]?.matchKind, "original_exact");
assert.equal(originalResults[0]?.hasVerifiedReview, false);
assert.equal(originalResults[0]?.hasReviewInProgress, true, "Active under-review workflow was not exposed as in-progress.");

assert.deepEqual(executeSearch("نيمو finding").map((row) => row.id), ["search-original"]);
assert.deepEqual(executeSearch("نيمو' OR 1=1 --"), []);
assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

db.close();
console.log("Verified P3 public title-search SQL and review-progress state against the migrated SQLite schema.");
