import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  buildEditorialPublicationContentFingerprint,
  getEditorialPublicationPresentation,
} from "../lib/editorial-publication-presentation.ts";
import { listEditorialReviewPublications } from "../lib/editorial-review-registry.ts";

const fixtureDir = path.join(process.cwd(), "data", "editorial-bootstrap");

test("all four legacy editorial publications match their frozen D1 bootstrap fixtures exactly", async () => {
  const legacy = listEditorialReviewPublications().sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(legacy.length, 4);
  const frozen = [];
  for (const review of legacy) {
    const file = path.join(fixtureDir, `${review.id}.json`);
    frozen.push(JSON.parse(await readFile(file, "utf8")));
  }
  const expected = [];
  for (const review of legacy) {
    expected.push({
      review,
      presentation: getEditorialPublicationPresentation(review),
      fingerprint: await buildEditorialPublicationContentFingerprint(review),
    });
  }
  assert.deepEqual(frozen, expected);
});
