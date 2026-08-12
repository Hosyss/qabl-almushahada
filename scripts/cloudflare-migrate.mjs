import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { writeCloudflareProductionConfig } from "./prepare-cloudflare-deploy.mjs";

export const D1_MIGRATIONS_TABLE = "d1_migrations";

const CREATE_MIGRATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "${D1_MIGRATIONS_TABLE}"(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);`;

export function compareMigrationPaths(a, b) {
  const aSegments = a.split("/");
  const bSegments = b.split("/");
  const shared = Math.min(aSegments.length, bSegments.length);

  for (let index = 0; index < shared; index += 1) {
    const comparison = compareMigrationSegments(aSegments[index], bSegments[index]);
    if (comparison !== 0) return comparison;
  }

  return aSegments.length - bSegments.length;
}

function compareMigrationSegments(a, b) {
  const aNumber = leadingMigrationNumber(a);
  const bNumber = leadingMigrationNumber(b);

  if (aNumber !== bNumber) {
    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
    if (Number.isFinite(aNumber)) return -1;
    if (Number.isFinite(bNumber)) return 1;
  }

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function leadingMigrationNumber(segment) {
  return Number.parseInt(segment.split("_")[0], 10);
}

export function buildMigrationImportSql(migrationSql, migrationName) {
  if (typeof migrationSql !== "string" || !migrationSql.trim()) {
    throw new Error(`Migration ${migrationName} is empty.`);
  }
  if (typeof migrationName !== "string" || !migrationName.endsWith(".sql")) {
    throw new Error("Migration name must be a .sql file.");
  }

  const normalizedSql = migrationSql.replace(/\r\n?/g, "\n").trimEnd();
  if (!normalizedSql.endsWith(";")) {
    throw new Error(`Migration ${migrationName} must end with a semicolon.`);
  }

  const escapedName = migrationName.replace(/'/g, "''");
  return `${normalizedSql}
INSERT INTO "${D1_MIGRATIONS_TABLE}" (name)
VALUES ('${escapedName}');
`;
}

export function parseAppliedMigrationNames(jsonText) {
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("Wrangler returned invalid JSON while reading D1 migration state.");
  }

  const rows = [];
  collectResultRows(payload, rows);

  const names = rows.map((row) => row?.name).filter((name) => typeof name === "string");
  if (names.length !== rows.length) {
    throw new Error("D1 migration state contained a row without a string name.");
  }
  if (new Set(names).size !== names.length) {
    throw new Error("D1 migration state contains duplicate migration names.");
  }

  return names;
}

function collectResultRows(value, rows) {
  if (Array.isArray(value)) {
    for (const item of value) collectResultRows(item, rows);
    return;
  }
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value.results)) {
    rows.push(...value.results);
    return;
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") collectResultRows(nested, rows);
  }
}

export function getPendingMigrationNames(localMigrationNames, appliedMigrationNames) {
  const local = [...localMigrationNames].sort(compareMigrationPaths);

  if (new Set(local).size !== local.length) {
    throw new Error("Local migration list contains duplicate names.");
  }
  if (appliedMigrationNames.length > local.length) {
    throw new Error("Remote D1 has more applied migrations than the repository.");
  }

  for (let index = 0; index < appliedMigrationNames.length; index += 1) {
    if (appliedMigrationNames[index] !== local[index]) {
      throw new Error(
        `Remote D1 migration history diverged at position ${index + 1}: expected ${local[index] ?? "<none>"}, found ${appliedMigrationNames[index]}.`,
      );
    }
  }

  return local.slice(appliedMigrationNames.length);
}

export async function migrateCloudflareProductionD1(env = process.env) {
  const { config, path: configPath } = await writeCloudflareProductionConfig(env);
  const migrationBinding = config.d1_databases?.find((database) => database.binding === "DB");
  if (!migrationBinding?.migrations_dir) {
    throw new Error("Cloudflare production config is missing the DB migrations_dir.");
  }

  const migrationsPath = path.resolve(path.dirname(configPath), migrationBinding.migrations_dir);
  const localMigrationNames = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort(compareMigrationPaths);

  if (localMigrationNames.length === 0) {
    throw new Error(`No SQL migrations found at ${migrationsPath}.`);
  }

  await runWrangler([
    "d1",
    "execute",
    "DB",
    "--remote",
    "--config",
    configPath,
    "--command",
    CREATE_MIGRATIONS_TABLE_SQL,
    "--json",
  ]);

  let appliedMigrationNames = await readAppliedMigrationNames(configPath);
  let pendingMigrationNames = getPendingMigrationNames(localMigrationNames, appliedMigrationNames);

  if (pendingMigrationNames.length === 0) {
    console.log(`Cloudflare D1 is already current at ${appliedMigrationNames.length} migration(s).`);
    return { applied: 0, total: appliedMigrationNames.length };
  }

  const stagingRoot = await mkdtemp(path.join(path.dirname(configPath), "d1-file-ingestion-"));
  let appliedThisRun = 0;

  try {
    for (const migrationName of pendingMigrationNames) {
      const sourcePath = path.join(migrationsPath, migrationName);
      const sourceSql = await readFile(sourcePath, "utf8");
      const stagedPath = path.join(stagingRoot, migrationName);

      await writeFile(stagedPath, buildMigrationImportSql(sourceSql, migrationName), {
        encoding: "utf8",
        mode: 0o600,
      });

      console.log(`Applying remote D1 migration via atomic file ingestion: ${migrationName}`);
      await runWrangler([
        "d1",
        "execute",
        "DB",
        "--remote",
        "--config",
        configPath,
        "--file",
        stagedPath,
        "--yes",
      ], { inheritOutput: true });

      appliedMigrationNames = await readAppliedMigrationNames(configPath);
      const expectedApplied = localMigrationNames.slice(0, appliedMigrationNames.length);
      getPendingMigrationNames(localMigrationNames, appliedMigrationNames);

      if (appliedMigrationNames.at(-1) !== migrationName) {
        throw new Error(`Migration ${migrationName} executed but was not recorded as the latest D1 migration.`);
      }
      if (expectedApplied.at(-1) !== migrationName) {
        throw new Error(`Migration ${migrationName} was recorded out of repository order.`);
      }

      appliedThisRun += 1;
    }
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }

  appliedMigrationNames = await readAppliedMigrationNames(configPath);
  pendingMigrationNames = getPendingMigrationNames(localMigrationNames, appliedMigrationNames);
  if (pendingMigrationNames.length !== 0) {
    throw new Error(`Remote D1 still has pending migrations: ${pendingMigrationNames.join(", ")}`);
  }

  console.log(`Cloudflare D1 migrations complete: ${appliedMigrationNames.length}/${localMigrationNames.length}.`);
  return { applied: appliedThisRun, total: appliedMigrationNames.length };
}

async function readAppliedMigrationNames(configPath) {
  const output = await runWrangler([
    "d1",
    "execute",
    "DB",
    "--remote",
    "--config",
    configPath,
    "--command",
    `SELECT name FROM "${D1_MIGRATIONS_TABLE}" ORDER BY id;`,
    "--json",
  ]);
  return parseAppliedMigrationNames(output.stdout);
}

async function runWrangler(args, { inheritOutput = false } = {}) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(npmCommand, ["exec", "--", "wrangler", ...args], {
    env: process.env,
    stdio: inheritOutput ? "inherit" : ["ignore", "pipe", "pipe"],
  });

  if (inheritOutput) {
    const exitCode = await waitForChild(child);
    if (exitCode !== 0) throw new Error(`Wrangler exited with code ${exitCode}.`);
    return { stdout: "", stderr: "" };
  }

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await waitForChild(child);
  if (exitCode !== 0) {
    const detail = stderr.trim() || stdout.trim() || `exit code ${exitCode}`;
    throw new Error(`Wrangler command failed: ${detail}`);
  }

  return { stdout, stderr };
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) return reject(new Error(`Wrangler terminated by signal ${signal}.`));
      resolve(code ?? 1);
    });
  });
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  try {
    await migrateCloudflareProductionD1();
  } catch (error) {
    console.error(`Cloudflare D1 migration failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
