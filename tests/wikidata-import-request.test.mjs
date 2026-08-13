import assert from "node:assert/strict";
import test from "node:test";

import {
  formatGitHubOutputs,
  parseWikidataGitOpsImportRequest,
} from "../scripts/resolve-wikidata-import-request.mjs";

const VALID = {
  schemaVersion: 1,
  requestId: "p3s-08-first-known-200-retry-1",
  source: "wikidata",
  limit: 200,
  offset: 0,
  minimumValidated: 100,
  apply: true,
  approved: true,
};

test("GitOps Wikidata request resolves to bounded production outputs", () => {
  const parsed = parseWikidataGitOpsImportRequest(VALID);
  assert.deepEqual(parsed, {
    limit: 200,
    offset: 0,
    minimumValidated: 100,
    apply: true,
    authorization: "gitops",
    requestId: VALID.requestId,
  });
  assert.equal(
    formatGitHubOutputs(parsed),
    "limit=200\noffset=0\nminimum_validated=100\napply=true\nauthorization=gitops\nrequest_id=p3s-08-first-known-200-retry-1\nconfirmation=\n",
  );
});

test("GitOps request rejects unreviewed, unknown and out-of-range input", () => {
  assert.throws(
    () => parseWikidataGitOpsImportRequest({ ...VALID, approved: false }),
    /approved=true/i,
  );
  assert.throws(
    () => parseWikidataGitOpsImportRequest({ ...VALID, extra: "nope" }),
    /unknown production import request field/i,
  );
  assert.throws(
    () => parseWikidataGitOpsImportRequest({ ...VALID, limit: 201 }),
    /limit/i,
  );
  assert.throws(
    () => parseWikidataGitOpsImportRequest({ ...VALID, minimumValidated: 201 }),
    /minimumValidated/i,
  );
});
