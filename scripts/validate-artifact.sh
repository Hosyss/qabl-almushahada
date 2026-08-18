#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

worker="${SITES_PROJECT_ROOT}/dist/server/index.js"
hosting="${SITES_PROJECT_ROOT}/dist/.openai/hosting.json"
wrangler="${SITES_PROJECT_ROOT}/node_modules/.bin/wrangler"

[[ -f "${worker}" ]] || {
  echo "Missing Sites Worker entry: dist/server/index.js" >&2
  exit 66
}
[[ -f "${hosting}" ]] || {
  echo "Missing packaged Sites manifest: dist/.openai/hosting.json" >&2
  exit 66
}
[[ -x "${wrangler}" ]] || {
  echo "Wrangler is unavailable; cannot validate the generated Worker in its target runtime model." >&2
  exit 69
}

node --check "${worker}"
node "${script_dir}/validate-worker-entry.mjs" "${worker}"
node --input-type=module - "${hosting}" <<'NODE'
import { readFile } from "node:fs/promises";

const [hostingPath] = process.argv.slice(2);
JSON.parse(await readFile(hostingPath, "utf8"));
console.log("Validated packaged Sites manifest JSON.");
NODE

compatibility_date="$({
  cd "${SITES_PROJECT_ROOT}"
  node --input-type=module <<'NODE'
import path from "node:path";
import { pathToFileURL } from "node:url";

const moduleUrl = pathToFileURL(path.join(process.cwd(), "scripts/prepare-cloudflare-deploy.mjs")).href;
const { CLOUDFLARE_COMPATIBILITY_DATE } = await import(moduleUrl);
process.stdout.write(CLOUDFLARE_COMPATIBILITY_DATE);
NODE
})"

validation_config="$(mktemp "${SITES_PROJECT_ROOT}/.wrangler-artifact-validation.XXXXXX.jsonc")"
validation_out="$(mktemp -d "${SITES_PROJECT_ROOT}/.wrangler-artifact-validation-out.XXXXXX")"
cleanup() {
  rm -f "${validation_config}"
  rm -rf "${validation_out}"
}
trap cleanup EXIT

cat > "${validation_config}" <<JSON
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "qabl-artifact-validation",
  "main": "dist/server/index.js",
  "compatibility_date": "${compatibility_date}",
  "compatibility_flags": ["nodejs_compat"]
}
JSON

(
  cd "${SITES_PROJECT_ROOT}"
  "${wrangler}" deploy \
    --config "${validation_config}" \
    --dry-run \
    --outdir "${validation_out}"
)

echo "Validated Sites artifact: syntax, ESM default.fetch contract, hosting manifest, and Wrangler dry-run all passed."
