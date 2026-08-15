import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getTitleArtwork,
  listTitleArtworkEntries,
  TITLE_ARTWORK_DISCLOSURE_AR,
} from "../lib/title-artwork.ts";

const EXPECTED_TITLE_IDS = new Set([
  "wd:Q11621",
  "wd:Q39571",
  "wd:Q102438",
  "wd:Q167726",
  "wd:Q174385",
  "wd:Q182153",
  "wd:Q212965",
  "wd:Q13619743",
  "wd:Q55436290",
  "wd:Q68934496",
]);

test("the ten published editorial titles have local original artwork", () => {
  const entries = listTitleArtworkEntries();
  assert.equal(entries.length, 10);
  assert.deepEqual(new Set(entries.map(([titleId]) => titleId)), EXPECTED_TITLE_IDS);

  for (const [titleId, artwork] of entries) {
    assert.equal(getTitleArtwork(titleId), artwork);
    assert.match(artwork.src, /^\/artwork\/[a-z0-9-]+\.webp$/u);
    assert.equal(artwork.src.startsWith("http"), false);
    assert.equal(artwork.altAr.trim().length > 20, true);
    assert.equal(existsSync(path.resolve("public", artwork.src.slice(1))), true, `${titleId} asset is missing`);
  }
});

test("unknown catalog titles never inherit another movie artwork", () => {
  assert.equal(getTitleArtwork("wd:Q999999999"), null);
  assert.match(TITLE_ARTWORK_DISCLOSURE_AR, /ليس الملصق الرسمي/u);
});
