import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CLOUDFLARE_PRODUCTION_CONFIG_PATH = ".wrangler/production/wrangler.jsonc";
export const CLOUDFLARE_COMPATIBILITY_DATE = "2026-08-12";

export function buildCloudflareProductionConfig(env = process.env) {
  const databaseId = requireUuid(env.CF_D1_DATABASE_ID, "CF_D1_DATABASE_ID");
  const databaseName = requireName(env.CF_D1_DATABASE_NAME, "CF_D1_DATABASE_NAME", 1, 128);
  const teamDomain = requireTeamDomain(env.CF_ACCESS_TEAM_DOMAIN);
  const audience = requireText(env.CF_ACCESS_AUD, "CF_ACCESS_AUD", 1, 512);
  const workerName = env.CF_WORKER_NAME
    ? requireWorkerName(env.CF_WORKER_NAME)
    : "qabl-almushahada";

  const vars = {
    INTERNAL_AUTH_MODE: "cloudflare_access",
    CF_ACCESS_TEAM_DOMAIN: teamDomain,
    CF_ACCESS_AUD: audience,
  };

  const bootstrapEmail = optionalEmail(env.INTERNAL_BOOTSTRAP_ADMIN_EMAIL);
  if (bootstrapEmail) vars.INTERNAL_BOOTSTRAP_ADMIN_EMAIL = bootstrapEmail;

  return {
    $schema: "../../node_modules/wrangler/config-schema.json",
    name: workerName,
    main: "../../worker/index.ts",
    compatibility_date: CLOUDFLARE_COMPATIBILITY_DATE,
    compatibility_flags: ["nodejs_compat"],
    workers_dev: true,
    d1_databases: [
      {
        binding: "DB",
        database_name: databaseName,
        database_id: databaseId,
        migrations_dir: "../../drizzle",
      },
    ],
    images: {
      binding: "IMAGES",
    },
    vars,
    observability: {
      enabled: true,
      head_sampling_rate: 0.1,
    },
  };
}

export async function writeCloudflareProductionConfig(
  env = process.env,
  destination = CLOUDFLARE_PRODUCTION_CONFIG_PATH,
) {
  const config = buildCloudflareProductionConfig(env);
  const absolutePath = path.resolve(destination);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return { config, path: absolutePath };
}

function requireText(value, name, minLength, maxLength) {
  if (typeof value !== "string") throw new Error(`${name} is required.`);
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new Error(`${name} has an invalid length.`);
  }
  return normalized;
}

function requireName(value, name, minLength, maxLength) {
  const normalized = requireText(value, name, minLength, maxLength);
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error(`${name} contains unsupported characters.`);
  }
  return normalized;
}

function requireUuid(value, name) {
  const normalized = requireText(value, name, 36, 36).toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new Error(`${name} must be a real UUID.`);
  }
  if (normalized === "00000000-0000-4000-8000-000000000000") {
    throw new Error(`${name} cannot use the local placeholder database id.`);
  }
  return normalized;
}

function requireWorkerName(value) {
  const normalized = requireText(value, "CF_WORKER_NAME", 1, 63);
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    throw new Error("CF_WORKER_NAME must be a valid workers.dev Worker name.");
  }
  return normalized;
}

function requireTeamDomain(value) {
  const normalized = requireText(value, "CF_ACCESS_TEAM_DOMAIN", 1, 512);
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("CF_ACCESS_TEAM_DOMAIN must be a valid URL.");
  }
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".cloudflareaccess.com") ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("CF_ACCESS_TEAM_DOMAIN must be an https://<team>.cloudflareaccess.com origin.");
  }
  return url.origin;
}

function optionalEmail(value) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = requireText(value, "INTERNAL_BOOTSTRAP_ADMIN_EMAIL", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("INTERNAL_BOOTSTRAP_ADMIN_EMAIL is invalid.");
  }
  return normalized;
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(fileURLToPath(pathToFileURL(process.argv[1]))).href
  : false;

if (invokedDirectly) {
  try {
    const result = await writeCloudflareProductionConfig();
    console.log(`Prepared Cloudflare production config at ${result.path}`);
  } catch (error) {
    console.error(`Cloudflare production config was not generated: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
