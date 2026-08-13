import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ALLOWED_KEYS = new Set([
  "schemaVersion",
  "requestId",
  "source",
  "limit",
  "offset",
  "minimumValidated",
  "apply",
  "approved",
]);

export function parseWikidataGitOpsImportRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Production import request must be a JSON object.");
  }

  for (const key of Object.keys(value)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new TypeError(`Unknown production import request field: ${key}`);
    }
  }

  if (value.schemaVersion !== 1) {
    throw new TypeError("Unsupported production import request schemaVersion.");
  }
  if (value.source !== "wikidata") {
    throw new TypeError("Production import request source must be wikidata.");
  }
  if (typeof value.requestId !== "string" || !/^[a-z0-9][a-z0-9-]{7,79}$/u.test(value.requestId)) {
    throw new TypeError("Production import requestId is invalid.");
  }
  if (!Number.isInteger(value.limit) || value.limit < 1 || value.limit > 200) {
    throw new RangeError("Production import limit must be from 1 to 200.");
  }
  if (!Number.isInteger(value.offset) || value.offset < 0 || value.offset > 1_000_000) {
    throw new RangeError("Production import offset must be from 0 to 1000000.");
  }
  if (
    !Number.isInteger(value.minimumValidated) ||
    value.minimumValidated < 1 ||
    value.minimumValidated > value.limit
  ) {
    throw new RangeError("minimumValidated must be positive and no larger than limit.");
  }
  if (value.apply !== true || value.approved !== true) {
    throw new TypeError(
      "GitOps production import requires apply=true and approved=true in the reviewed main-branch request.",
    );
  }

  return {
    limit: value.limit,
    offset: value.offset,
    minimumValidated: value.minimumValidated,
    apply: true,
    authorization: "gitops",
    requestId: value.requestId,
  };
}

export function formatGitHubOutputs(request) {
  return [
    `limit=${request.limit}`,
    `offset=${request.offset}`,
    `minimum_validated=${request.minimumValidated}`,
    "apply=true",
    `authorization=${request.authorization}`,
    `request_id=${request.requestId}`,
    "confirmation=",
  ].join("\n") + "\n";
}

function main() {
  const file = process.argv[2];
  if (!file) throw new TypeError("Expected request JSON path.");
  const raw = JSON.parse(readFileSync(file, "utf8"));
  process.stdout.write(formatGitHubOutputs(parseWikidataGitOpsImportRequest(raw)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
