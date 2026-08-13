import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  fetchWikidataCatalogPage,
  prepareWikidataCatalogImportPlan,
} from "../lib/wikidata-catalog.ts";

function readNumberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer`);
  return value;
}

const limit = readNumberFlag("limit", 25);
const offset = readNumberFlag("offset", 0);
const outputArg = process.argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length);
const sqlOutputArg = process.argv.find((argument) => argument.startsWith("--sql-output="))?.slice("--sql-output=".length);
const retrievedAt = new Date().toISOString();

const titles = await fetchWikidataCatalogPage({ limit, offset });
if (titles.length === 0) {
  throw new Error("Wikidata returned zero validated titles; refusing to create an import artifact");
}
const plan = await prepareWikidataCatalogImportPlan(titles, { retrievedAt });
const payload = {
  source: plan.source,
  license: plan.license,
  retrievedAt: plan.retrievedAt,
  limit,
  offset,
  count: plan.records.length,
  policySnapshot: plan.policySnapshot,
  records: plan.records,
};

const text = `${JSON.stringify(payload, null, 2)}\n`;
if (outputArg) {
  const target = path.resolve(outputArg);
  await writeFile(target, text, "utf8");
  console.log(`Wrote ${plan.records.length} validated Wikidata catalog records to ${target}`);
} else {
  process.stdout.write(text);
}

if (sqlOutputArg) {
  const target = path.resolve(sqlOutputArg);
  await writeFile(target, plan.sql, "utf8");
  console.log(`Wrote provenance-safe D1 import SQL to ${target}`);
}
