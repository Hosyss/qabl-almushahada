import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(projectRoot, "drizzle");
const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();

assert.ok(migrationFiles.length > 0, "No SQL migrations were found.");

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");

for (const migrationFile of migrationFiles) {
  const sql = await readFile(path.join(migrationDirectory, migrationFile), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    database.exec(statement);
  }
}

const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all();
assert.deepEqual(foreignKeyErrors, [], "Foreign-key validation failed after applying migrations.");

const tables = database
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();
assert.equal(tables.length, 13, "Unexpected number of product tables.");

const reviewBundleColumns = database.prepare("PRAGMA table_info('review_bundles')").all();
assert.ok(reviewBundleColumns.some((column) => column.name === "revision"), "Missing optimistic-lock revision.");
assert.ok(
  reviewBundleColumns.some((column) => column.name === "published_transition_id"),
  "Missing publication transition id.",
);

assert.throws(
  () =>
    database
      .prepare("INSERT INTO titles (id, canonical_name, kind, release_year) VALUES (?, ?, ?, ?)")
      .run("invalid-title", "Invalid", "unknown-kind", 2026),
  /constraint/i,
  "Database accepted an invalid title kind.",
);

database.close();
console.log(`Verified ${migrationFiles.length} migration files and ${tables.length} product tables.`);

