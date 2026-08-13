import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { buildEditorialBootstrapSql, loadEditorialBootstrapFixtures } from "./editorial-bootstrap-sql.mjs";
import { writeCloudflareProductionConfig } from "./prepare-cloudflare-deploy.mjs";

export const D1_MIGRATIONS_TABLE = "d1_migrations";

const CREATE_MIGRATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "${D1_MIGRATIONS_TABLE}"(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);`;

const EDITORIAL_CURRENT_HEAD_SQL = `SELECT
  h.title_id AS titleId,
  h.public_id AS publicId,
  h.revision AS revision,
  r.publication_state AS publicationState,
  r.decision_status AS decisionStatus,
  r.decision_eligible AS decisionEligible,
  r.content_fingerprint AS contentFingerprint,
  (SELECT COUNT(*) FROM editorial_publication_sources s WHERE s.publication_revision_id = r.id) AS sourceCount,
  (SELECT COUNT(*) FROM editorial_publication_claims c WHERE c.publication_revision_id = r.id) AS claimCount,
  (SELECT COUNT(*) FROM editorial_publication_claim_sources cs WHERE cs.publication_revision_id = r.id) AS claimSourceCount,
  (SELECT COUNT(*) FROM editorial_publication_uncertain_categories u WHERE u.publication_revision_id = r.id) AS uncertainCount
FROM editorial_publication_heads h
INNER JOIN editorial_publication_revisions r
  ON r.id = h.current_revision_id
  AND r.title_id = h.title_id
  AND r.public_id = h.public_id
  AND r.revision = h.revision
ORDER BY h.title_id;`;

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

export function verifyEditorialProductionRows(rows, fixtures) {
  if (!Array.isArray(rows)) throw new TypeError("Editorial production rows must be an array.");
  if (!Array.isArray(fixtures) || fixtures.length !== 4) {
    throw new Error(`Expected exactly 4 frozen editorial fixtures, found ${Array.isArray(fixtures) ? fixtures.length : 0}.`);
  }
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
    if (!row || typeof row.publicId !== "string") throw new Error("Editorial current-head query returned an invalid row.");
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
  return true;
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
  let appliedThisRun = 0;

  if (pendingMigrationNames.length === 0) {
    console.log(`Cloudflare D1 schema is already current at ${appliedMigrationNames.length} migration(s).`);
  } else {
    const stagingRoot = await mkdtemp(path.join(path.dirname(configPath), "d1-file-ingestion-"));

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
  }

  appliedMigrationNames = await readAppliedMigrationNames(configPath);
  pendingMigrationNames = getPendingMigrationNames(localMigrationNames, appliedMigrationNames);
  if (pendingMigrationNames.length !== 0) {
    throw new Error(`Remote D1 still has pending migrations: ${pendingMigrationNames.join(", ")}`);
  }

  await ensureEditorialBootstrap(configPath);

  console.log(`Cloudflare D1 ready: ${appliedMigrationNames.length}/${localMigrationNames.length} migrations and P4-03B4 editorial current heads verified.`);
  return { applied: appliedThisRun, total: appliedMigrationNames.length };
}

async function ensureEditorialBootstrap(configPath) {
  const fixtures = await loadEditorialBootstrapFixtures();
  if (fixtures.length !== 4) throw new Error(`Expected exactly 4 editorial bootstrap fixtures, found ${fixtures.length}.`);

  const stagingRoot = await mkdtemp(path.join(path.dirname(configPath), "editorial-bootstrap-"));
  const stagedPath = path.join(stagingRoot, "p4-03-b4-editorial-bootstrap.sql");
  try {
    await writeFile(stagedPath, buildEditorialBootstrapSql(fixtures), { encoding: "utf8", mode: 0o600 });
    console.log("Applying idempotent P4-03B4 editorial bootstrap.");
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
  } finally {
    await rm(stagingRoot, { recursive: true, force: true });
  }

  const output = await runWrangler([
    "d1",
    "execute",
    "DB",
    "--remote",
    "--config",
    configPath,
    "--command",
    EDITORIAL_CURRENT_HEAD_SQL,
    "--json",
  ]);
  let payload;
  try {
    payload = JSON.parse(output.stdout);
  } catch {
    throw new Error("Wrangler returned invalid JSON while verifying editorial production state.");
  }
  const rows = [];
  collectResultRows(payload, rows);
  verifyEditorialProductionRows(rows, fixtures);
  console.log("Verified 4 production editorial current heads exactly match the frozen P4-03B4 bootstrap fixtures.");
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
