import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parsePublicTitleSearchRequest,
  rankPublicTitleSearchCandidates,
  type PublicTitleSearchCandidate,
} from "../lib/public-title-search.ts";
import { buildPublicTitleCandidateQuery } from "../db/public-title-search-query.ts";

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

db.prepare(
  `INSERT INTO titles (id, canonical_name, original_name, kind, release_year)
   VALUES (?, ?, ?, ?, ?)`,
).run("search-arabic", "إِنْسَايْد—آوْت ٢", "Inside Out 2", "movie", 2024);
db.prepare(
  `INSERT INTO titles (id, canonical_name, original_name, kind, release_year)
   VALUES (?, ?, ?, ?, ?)`,
).run("search-original", "البحث عن نيمو", "Finding Nemo", "movie", 2003);
db.prepare(
  `INSERT INTO titles (id, canonical_name, original_name, kind, release_year)
   VALUES (?, ?, ?, ?, ?)`,
).run("search-unrelated", "مدينة الغيم", "Cloud City", "series", 2025);

function executeSearch(query: string) {
  const parsed = parsePublicTitleSearchRequest({ query });
  const candidateQuery = buildPublicTitleCandidateQuery(parsed);
  const rows = db.prepare(candidateQuery.sql).all(...candidateQuery.bindings) as Array<{
    id: string;
    canonicalName: string;
    originalName: string | null;
    kind: "movie" | "series" | "episode" | "special";
    releaseYear: number;
    hasVerifiedReview: number;
  }>;
  const candidates: PublicTitleSearchCandidate[] = rows.map((row) => ({
    id: row.id,
    canonicalName: row.canonicalName,
    originalName: row.originalName,
    kind: row.kind,
    releaseYear: row.releaseYear,
    hasVerifiedReview: row.hasVerifiedReview === 1,
  }));
  return rankPublicTitleSearchCandidates(parsed, candidates);
}

const arabicResults = executeSearch("انسايد اوت 2");
assert.equal(arabicResults[0]?.id, "search-arabic", "Arabic normalization candidate query missed the title.");
assert.equal(arabicResults[0]?.matchKind, "canonical_exact");
assert.equal(arabicResults[0]?.hasVerifiedReview, false);

const originalResults = executeSearch("FINDING NEMO");
assert.equal(originalResults[0]?.id, "search-original", "Original-name search missed the title.");
assert.equal(originalResults[0]?.matchKind, "original_exact");

const unrelatedResults = executeSearch("نيمو finding");
assert.deepEqual(unrelatedResults.map((row) => row.id), ["search-original"]);

const injectionLikeResults = executeSearch("نيمو' OR 1=1 --");
assert.deepEqual(injectionLikeResults, [], "Injection-like text changed SQL search semantics.");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Public title-search verifier broke foreign keys.");

db.close();
console.log("Verified P3-01 public title-search SQL against the migrated SQLite schema.");
