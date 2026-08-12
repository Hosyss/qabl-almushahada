import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMigrationImportSql,
  compareMigrationPaths,
  getPendingMigrationNames,
  parseAppliedMigrationNames,
} from "../scripts/cloudflare-migrate.mjs";

test("Cloudflare migration order matches Wrangler numeric order with lexical ties", () => {
  const names = [
    "0011_reviewer.sql",
    "0010_z.sql",
    "0009_gate.sql",
    "0010_a.sql",
    "0011_reference.sql",
  ];
  assert.deepEqual(names.sort(compareMigrationPaths), [
    "0009_gate.sql",
    "0010_a.sql",
    "0010_z.sql",
    "0011_reference.sql",
    "0011_reviewer.sql",
  ]);
});

test("file-ingestion payload preserves trigger SQL, normalizes LF, and records migration atomically", () => {
  const source = [
    "CREATE TRIGGER guard BEFORE DELETE ON thing",
    "BEGIN",
    "  SELECT RAISE(ABORT, 'no');",
    "END;",
    "",
  ].join("\r\n");

  const output = buildMigrationImportSql(source, "0009_gate.sql");
  assert.equal(output.includes("\r"), false);
  assert.match(output, /CREATE TRIGGER guard/);
  assert.match(output, /END;\nINSERT INTO "d1_migrations" \(name\)/);
  assert.match(output, /VALUES \('0009_gate\.sql'\);\n$/);
});

test("migration payload escapes a quote in a migration filename", () => {
  const output = buildMigrationImportSql("SELECT 1;", "0001_owner's.sql");
  assert.match(output, /VALUES \('0001_owner''s\.sql'\);/);
});

test("applied migration parser accepts Wrangler result arrays and rejects malformed rows", () => {
  const payload = JSON.stringify([
    {
      results: [{ name: "0000_init.sql" }, { name: "0001_next.sql" }],
      success: true,
    },
  ]);

  assert.deepEqual(parseAppliedMigrationNames(payload), ["0000_init.sql", "0001_next.sql"]);
  assert.throws(
    () => parseAppliedMigrationNames(JSON.stringify([{ results: [{ nope: "x" }] }])),
    /row without a string name/,
  );
});

test("pending migration calculation requires a contiguous repository prefix", () => {
  const local = ["0002_c.sql", "0000_a.sql", "0001_b.sql"];
  assert.deepEqual(getPendingMigrationNames(local, ["0000_a.sql"]), ["0001_b.sql", "0002_c.sql"]);
  assert.throws(
    () => getPendingMigrationNames(local, ["0000_a.sql", "0002_c.sql"]),
    /history diverged/,
  );
  assert.throws(
    () => getPendingMigrationNames(local, ["9999_unknown.sql"]),
    /history diverged/,
  );
});

test("empty or unterminated migration payloads fail closed", () => {
  assert.throws(() => buildMigrationImportSql("", "0001_empty.sql"), /empty/);
  assert.throws(() => buildMigrationImportSql("SELECT 1", "0001_bad.sql"), /semicolon/);
});
