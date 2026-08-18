import assert from "node:assert/strict";
import { rename, readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = path.join(projectRoot, "drizzle");
const intakeMigrationName = "0027_public_report_intake.sql";
const intakeMigrationPath = path.join(migrationDirectory, intakeMigrationName);
const heldMigrationPath = `${intakeMigrationPath}.public-report-verifier-hold`;

// Keep the existing 39-table verifier authoritative for every legacy migration.
// Temporarily hide only the additive P4-03C4 migration, restore it even when the
// legacy verifier fails, then verify the complete 40-table schema below.
await rename(intakeMigrationPath, heldMigrationPath);
let legacyResult;
try {
  legacyResult = spawnSync(process.execPath, [path.join(projectRoot, "scripts/verify-migrations.mjs")], {
    cwd: projectRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
} finally {
  await rename(heldMigrationPath, intakeMigrationPath);
}

if (legacyResult.status !== 0) {
  process.stderr.write(legacyResult.stdout ?? "");
  process.stderr.write(legacyResult.stderr ?? "");
  throw new Error(`Legacy migration verification failed with exit code ${legacyResult.status ?? "unknown"}.`);
}
process.stdout.write(legacyResult.stdout ?? "");

const migrationFiles = (await readdir(migrationDirectory))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
assert.ok(migrationFiles.includes(intakeMigrationName), "Public report intake migration is missing after restore.");

const database = new DatabaseSync(":memory:");
database.exec("PRAGMA foreign_keys = ON");

for (const migrationFile of migrationFiles) {
  const sql = await readFile(path.join(migrationDirectory, migrationFile), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) database.exec(statement);
}

assert.deepEqual(database.prepare("PRAGMA foreign_key_check").all(), []);

const tables = database
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all();
assert.equal(tables.length, 40, "P4-03C4 must add exactly one product table.");
assert.ok(
  tables.some((table) => table.name === "public_report_intakes"),
  "Missing public_report_intakes table.",
);

const columns = database.prepare("PRAGMA table_info('public_report_intakes')").all();
const columnNames = new Set(columns.map((column) => column.name));
for (const requiredColumn of [
  "id",
  "target_kind",
  "target_public_id",
  "target_revision",
  "target_snapshot_ref",
  "target_version_id",
  "report_reason",
  "message",
  "client_key_hash",
  "status",
  "material_report_id",
  "triaged_by_user_id",
  "triage_note",
  "revision",
  "created_at",
  "triaged_at",
]) {
  assert.ok(columnNames.has(requiredColumn), `Missing public intake column: ${requiredColumn}`);
}

const triggerRows = database
  .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'public_report_intakes' ORDER BY name")
  .all();
const triggerNames = new Set(triggerRows.map((row) => row.name));
assert.ok(
  triggerNames.has("public_report_intakes_payload_immutable_update"),
  "Missing immutable public-intake payload trigger.",
);
assert.ok(
  triggerNames.has("public_report_intakes_no_delete"),
  "Missing append-only public-intake history trigger.",
);

const receivedInsert = database.prepare(
  `INSERT INTO public_report_intakes
     (id, target_kind, target_public_id, target_revision, target_snapshot_ref,
      target_version_id, report_reason, message, client_key_hash)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
receivedInsert.run(
  "public-intake-editorial-1",
  "editorial_publication",
  "editorial-public-id",
  1,
  "editorial-snapshot-id",
  null,
  "missing_content",
  "هذا بلاغ تجريبي طويل بما يكفي لاختبار عقد التخزين العام.",
  "a".repeat(64),
);

assert.equal(
  database
    .prepare("SELECT status FROM public_report_intakes WHERE id = ?")
    .get("public-intake-editorial-1").status,
  "received",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE public_report_intakes SET message = ? WHERE id = ?")
      .run("تم العبث بالرسالة بعد الاستقبال بما يكفي لتجاوز حد الطول.", "public-intake-editorial-1"),
  /immutable/i,
  "Database allowed a public-intake payload to be rewritten.",
);

assert.throws(
  () =>
    database
      .prepare("DELETE FROM public_report_intakes WHERE id = ?")
      .run("public-intake-editorial-1"),
  /append-only/i,
  "Database allowed public-intake history to be deleted.",
);

assert.throws(
  () =>
    database
      .prepare("UPDATE public_report_intakes SET status = 'promoted' WHERE id = ?")
      .run("public-intake-editorial-1"),
  /constraint/i,
  "Database allowed editorial intake to be promoted without a supported correction workflow.",
);

assert.throws(
  () =>
    receivedInsert.run(
      "public-intake-bad-hash",
      "editorial_publication",
      "editorial-public-id",
      1,
      "editorial-snapshot-id",
      null,
      "missing_content",
      "هذا بلاغ تجريبي طويل بما يكفي لاختبار مفتاح عميل غير صالح.",
      "raw-ip-address",
    ),
  /constraint/i,
  "Database accepted a non-HMAC-shaped public client key.",
);

assert.throws(
  () =>
    receivedInsert.run(
      "public-intake-short-message",
      "editorial_publication",
      "editorial-public-id",
      1,
      "editorial-snapshot-id",
      null,
      "other",
      "قصير",
      "b".repeat(64),
    ),
  /constraint/i,
  "Database accepted an undersized public report message.",
);

database.close();
console.log(
  `Verified legacy migrations plus ${intakeMigrationName}: ${migrationFiles.length} migration files and ${tables.length} product tables.`,
);
