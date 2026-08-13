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

db.prepare(
  `INSERT INTO title_versions (
     id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status
   ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
).run(
  "search-public-version",
  "search-arabic",
  "نسخة عربية موثقة",
  "test",
  "ar",
  5760,
  "search-public-fingerprint-0001",
);
db.prepare(
  "INSERT INTO reviewers (id, display_label, independence_group_id, status) VALUES (?, ?, ?, 'active')",
).run("search-public-editor", "Public search editor", "search-public-editor-group");
db.prepare(
  `INSERT INTO review_bundles (id, version_id, status, revision, published_at)
   VALUES (?, ?, 'verified', 1, ?)`,
).run("search-public-bundle", "search-public-version", "2026-08-12T17:30:00.000Z");
db.prepare(
  `INSERT INTO editorial_approvals
     (id, bundle_id, approver_id, status, revision, version_fingerprint_confirmed, approved_at)
   VALUES (?, ?, ?, 'approved', 1, 1, ?)`,
).run(
  "search-public-approval",
  "search-public-bundle",
  "search-public-editor",
  "2026-08-12T17:25:00.000Z",
);
db.prepare(
  "UPDATE review_bundles SET current_approval_id = ? WHERE id = ?",
).run("search-public-approval", "search-public-bundle");

db.prepare(
  `INSERT INTO title_versions (
     id, title_id, edition_label, platform, language, runtime_seconds, content_fingerprint, status
   ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
).run(
  "search-version",
  "search-original",
  "نسخة اختبار",
  "test",
  "ar",
  6000,
  "search-fingerprint-0001",
);
db.prepare(
  `INSERT INTO review_bundles (id, version_id, status)
   VALUES (?, ?, 'under_review')`,
).run("search-bundle", "search-version");

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
    hasReviewInProgress: number;
    verifiedBundleId: string | null;
    verifiedMaxSeverity: number | null;
  }>;
  const candidates: PublicTitleSearchCandidate[] = rows.map((row) => ({
    id: row.id,
    canonicalName: row.canonicalName,
    originalName: row.originalName,
    kind: row.kind,
    releaseYear: row.releaseYear,
    hasVerifiedReview: row.hasVerifiedReview === 1,
    hasReviewInProgress: row.hasReviewInProgress === 1,
    verifiedBundleId: row.verifiedBundleId,
    verifiedMaxSeverity:
      row.verifiedMaxSeverity === null
        ? null
        : (row.verifiedMaxSeverity as PublicTitleSearchCandidate["verifiedMaxSeverity"]),
  }));
  return rankPublicTitleSearchCandidates(parsed, candidates);
}

const arabicResults = executeSearch("انسايد اوت 2");
assert.equal(arabicResults[0]?.id, "search-arabic", "Arabic normalization candidate query missed the title.");
assert.equal(arabicResults[0]?.matchKind, "canonical_exact");
assert.equal(arabicResults[0]?.hasVerifiedReview, true);
assert.equal(arabicResults[0]?.hasReviewInProgress, false);
assert.equal(
  arabicResults[0]?.verifiedBundleId,
  "search-public-bundle",
  "Verified search result did not carry the exact public bundle locator.",
);
assert.equal(
  arabicResults[0]?.verifiedMaxSeverity,
  0,
  "A verified approval with no observations should expose a zero maximum severity, not an invented age rating.",
);

const originalResults = executeSearch("FINDING NEMO");
assert.equal(originalResults[0]?.id, "search-original", "Original-name search missed the title.");
assert.equal(originalResults[0]?.matchKind, "original_exact");
assert.equal(originalResults[0]?.hasVerifiedReview, false);
assert.equal(
  originalResults[0]?.hasReviewInProgress,
  true,
  "Active under-review workflow was not exposed as in-progress.",
);
assert.equal(originalResults[0]?.verifiedBundleId, null);
assert.equal(originalResults[0]?.verifiedMaxSeverity, null);

const arabicNameResults = executeSearch("نيمو");
assert.deepEqual(
  arabicNameResults.map((row) => row.id),
  ["search-original"],
  "Arabic-name search should resolve the same D1 record as the English original name.",
);

const injectionLikeResults = executeSearch("نيمو' OR 1=1 --");
assert.deepEqual(injectionLikeResults, [], "Injection-like text changed SQL search semantics.");

const foreignKeyErrors = db.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Public title-search verifier broke foreign keys.");

db.close();
console.log("Verified P3 public title-search SQL, bilingual record resolution, bundle locator, review-progress state, and age-filter severity evidence against the migrated SQLite schema.");
