import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildMigrationImportSql,
  compareMigrationPaths,
  getPendingMigrationNames,
  parseAppliedMigrationNames,
} from "../scripts/cloudflare-migrate.mjs";
import {
  parsePublicReportRemoteSchemaPayload,
  verifyPublicReportRemoteSchemaRows,
} from "../scripts/verify-public-report-remote-schema.mjs";

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

test("public report production schema verifier requires the table and both history guards", () => {
  const rows = [
    {
      type: "table",
      name: "public_report_intakes",
      sql: "CREATE TABLE public_report_intakes (target_kind TEXT, target_public_id TEXT, target_snapshot_ref TEXT, client_key_hash TEXT, material_report_id TEXT, triaged_by_user_id TEXT, CONSTRAINT public_report_intakes_triage_state_check CHECK (1))",
    },
    {
      type: "trigger",
      name: "public_report_intakes_payload_immutable_update",
      sql: "CREATE TRIGGER public_report_intakes_payload_immutable_update BEFORE UPDATE ON public_report_intakes WHEN NEW.target_kind <> OLD.target_kind OR NEW.target_public_id <> OLD.target_public_id OR NEW.report_reason <> OLD.report_reason OR NEW.client_key_hash <> OLD.client_key_hash OR NEW.created_at <> OLD.created_at BEGIN SELECT RAISE(ABORT, 'public report intake payload is immutable'); END",
    },
    {
      type: "trigger",
      name: "public_report_intakes_no_delete",
      sql: "CREATE TRIGGER public_report_intakes_no_delete BEFORE DELETE ON public_report_intakes BEGIN SELECT RAISE(ABORT, 'public report intake history is append-only'); END",
    },
  ];

  assert.equal(verifyPublicReportRemoteSchemaRows(rows), true);
  assert.deepEqual(
    parsePublicReportRemoteSchemaPayload(JSON.stringify([{ success: true, results: rows }])),
    rows,
  );
  assert.throws(
    () => verifyPublicReportRemoteSchemaRows(rows.filter((row) => row.name !== "public_report_intakes_no_delete")),
    /no-delete trigger/,
  );
  assert.throws(() => parsePublicReportRemoteSchemaPayload("not-json"), /invalid JSON/);
});

test("cloudflare:migrate keeps the public-report remote schema verification in the production path", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(
    packageJson.scripts["cloudflare:migrate"],
    /cloudflare-migrate\.mjs && node scripts\/verify-public-report-remote-schema\.mjs/u,
  );
});
