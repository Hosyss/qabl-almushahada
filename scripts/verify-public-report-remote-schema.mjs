import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { writeCloudflareProductionConfig } from "./prepare-cloudflare-deploy.mjs";

export const PUBLIC_REPORT_REMOTE_SCHEMA_QUERY = `SELECT type, name, sql
FROM sqlite_master
WHERE (type = 'table' AND name = 'public_report_intakes')
   OR (type = 'trigger' AND name IN (
     'public_report_intakes_payload_immutable_update',
     'public_report_intakes_no_delete'
   ))
ORDER BY type, name;`;

export function parsePublicReportRemoteSchemaPayload(jsonText) {
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error("Wrangler returned invalid JSON while verifying the public report schema.");
  }

  const rows = [];
  collectResultRows(payload, rows);
  return rows;
}

export function verifyPublicReportRemoteSchemaRows(rows) {
  if (!Array.isArray(rows)) {
    throw new TypeError("Public report remote schema rows must be an array.");
  }

  const byKey = new Map(
    rows
      .filter((row) => row && typeof row.type === "string" && typeof row.name === "string")
      .map((row) => [`${row.type}:${row.name}`, row]),
  );

  const tableSql = byKey.get("table:public_report_intakes")?.sql ?? "";
  for (const token of [
    "public_report_intakes",
    "target_kind",
    "target_public_id",
    "target_snapshot_ref",
    "client_key_hash",
    "material_report_id",
    "triaged_by_user_id",
    "public_report_intakes_triage_state_check",
  ]) {
    if (!tableSql.includes(token)) {
      throw new Error(`Remote public_report_intakes table is missing required schema token: ${token}.`);
    }
  }

  const immutableSql = byKey.get("trigger:public_report_intakes_payload_immutable_update")?.sql ?? "";
  for (const token of ["target_kind", "target_public_id", "report_reason", "client_key_hash", "created_at", "immutable"]) {
    if (!immutableSql.includes(token)) {
      throw new Error(`Remote immutable public-report trigger is missing guard token: ${token}.`);
    }
  }

  const noDeleteSql = byKey.get("trigger:public_report_intakes_no_delete")?.sql ?? "";
  if (!noDeleteSql.includes("append-only")) {
    throw new Error("Remote public-report no-delete trigger is missing or malformed.");
  }

  return true;
}

export async function verifyPublicReportProductionSchema(env = process.env) {
  const { path: configPath } = await writeCloudflareProductionConfig(env);
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    npmCommand,
    [
      "exec",
      "--",
      "wrangler",
      "d1",
      "execute",
      "DB",
      "--remote",
      "--config",
      configPath,
      "--command",
      PUBLIC_REPORT_REMOTE_SCHEMA_QUERY,
      "--json",
    ],
    { encoding: "utf8", env: process.env },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit code ${result.status ?? "unknown"}`;
    throw new Error(`Wrangler could not verify the remote public-report schema: ${detail}`);
  }

  const rows = parsePublicReportRemoteSchemaPayload(result.stdout ?? "");
  verifyPublicReportRemoteSchemaRows(rows);
  console.log("Verified remote public_report_intakes table and append-only/immutability triggers.");
}

function collectResultRows(value, rows) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectResultRows(item, rows));
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value.results)) {
    rows.push(...value.results);
    return;
  }
  Object.values(value).forEach((item) => collectResultRows(item, rows));
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  try {
    await verifyPublicReportProductionSchema();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
