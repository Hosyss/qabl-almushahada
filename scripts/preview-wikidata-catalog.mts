import { writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildWikidataTitleUpsertSql,
  fetchWikidataCatalogPage,
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

const titles = await fetchWikidataCatalogPage({ limit, offset });
const payload = {
  source: "wikidata",
  license: "CC0 1.0",
  retrievedAt: new Date().toISOString(),
  limit,
  offset,
  count: titles.length,
  titles,
  sql: buildWikidataTitleUpsertSql(titles),
};

const text = `${JSON.stringify(payload, null, 2)}\n`;
if (outputArg) {
  const target = path.resolve(outputArg);
  await writeFile(target, text, "utf8");
  console.log(`Wrote ${titles.length} validated Wikidata titles to ${target}`);
} else {
  process.stdout.write(text);
}
