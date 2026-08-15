import assert from "node:assert/strict";
import test from "node:test";

import { FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES } from "./editorial-bootstrap-fixtures.ts";

const BASELINE_FINGERPRINTS = new Map([
  ["cars-2006-editorial-pilot-v1", "sha256:e8d3679f818e5c9d288d191537ec1944ceffe7144c7171442e8f31a72aebee11"],
  ["et-1982-editorial-batch-v1", "sha256:f9aee29440c3499f357cf9b708a7270a3d35849ac90e8b18dece5fe7add9dcd2"],
  ["harry-potter-philosophers-stone-2001-editorial-batch-v1", "sha256:3ce8a43f965e1d5be0cb0445a3e2632c19c05a2b61a22a653373b5f8dd96afa7"],
  ["minions-2015-editorial-batch-v1", "sha256:33962eee8999654834b259912b8cee88ebd384315a86c81427d73e41f9a2bf7a"],
  ["barbie-2023-editorial-c1-v1", "sha256:295c9247362a5083d4290587e8c0c4b8412b0cb51f9e5e3e93ee384bf35770cc"],
  ["jurassic-park-1993-editorial-c1-v1", "sha256:cec51f50cfe6177ce8a046a2c99cd3056cf489af617c4e1a453ddcabf92f0b84"],
  ["my-neighbor-totoro-1988-editorial-c1-v1", "sha256:24b0a1d3f9499fff5567532b52dc9763ddcb8d12849774699f473aaa2286a99b"],
]);

const C1_IDS = new Set([
  "barbie-2023-editorial-c1-v1",
  "jurassic-park-1993-editorial-c1-v1",
  "my-neighbor-totoro-1988-editorial-c1-v1",
]);

const C2_IDS = new Set([
  "alice-in-wonderland-2010-editorial-c2-v1",
  "spider-man-no-way-home-2021-editorial-c2-v1",
  "the-hunger-games-2012-editorial-c2-v1",
]);

const FORBIDDEN_PUBLISHERS = new Set(["Common Sense Media", "Plugged In", "BBFC", "Dove", "Dove.org"]);

function assertSafeEditorialSources(review: (typeof FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES)[number]["review"]) {
  assert.equal(review.decisionEligible, false, review.id);
  assert.equal(review.decisionStatus, "insufficient_data", review.id);
  assert.equal(review.sources.length, 2, review.id);
  assert.equal(review.sources.some((source) => FORBIDDEN_PUBLISHERS.has(source.publisher)), false, review.id);

  const wikipedia = review.sources.find((source) => source.publisher === "Wikipedia (English)");
  assert.ok(wikipedia, review.id);
  assert.equal(wikipedia.usageBasis, "open_license", review.id);
  assert.match(wikipedia.sourceVersion ?? "", /^oldid=\d+$/, review.id);
  assert.match(wikipedia.sourceUrl, /[?&]oldid=\d+$/u, review.id);
  assert.equal(wikipedia.rightsLabel, "CC BY-SA 4.0", review.id);

  const kim = review.sources.find((source) => source.publisher === "Kids-In-Mind");
  assert.ok(kim, review.id);
  assert.equal(kim.usageBasis, "link_only_factual_reference", review.id);
  assert.equal(kim.rightsUrl, "https://kids-in-mind.com/terms.htm", review.id);

  for (const claim of review.claims) {
    if (claim.verification === "corroborated") {
      const groups = new Set(
        claim.sourceIds.map((sourceId) => review.sources.find((source) => source.id === sourceId)?.independenceGroupId),
      );
      assert.equal(groups.size >= 2, true, `${review.id}:${claim.id}`);
    } else {
      assert.equal(claim.sourceIds.length, 1, `${review.id}:${claim.id}`);
    }
  }
}

test("P4-03C2 contains exactly ten publications and preserves all seven pre-C2 fingerprints", () => {
  assert.equal(FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.length, 10);
  for (const [id, fingerprint] of BASELINE_FINGERPRINTS) {
    const fixture = FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.find((item) => item.review.id === id);
    assert.ok(fixture, id);
    assert.equal(fixture.fingerprint, fingerprint, id);
  }
});

test("P4-03C1 remains exactly the three approved D1 titles with safe source usage and no judgment authority", () => {
  const c1 = FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.filter((item) => C1_IDS.has(item.review.id));
  assert.equal(c1.length, 3);
  assert.deepEqual(new Set(c1.map((item) => item.review.titleId)), new Set(["wd:Q55436290", "wd:Q167726", "wd:Q39571"]));
  for (const { review } of c1) assertSafeEditorialSources(review);
});

test("P4-03C2 adds exactly three approved D1 titles and keeps theatrical-version caveats fail-closed", () => {
  const c2 = FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.filter((item) => C2_IDS.has(item.review.id));
  assert.equal(c2.length, 3);
  assert.deepEqual(new Set(c2.map((item) => item.review.titleId)), new Set(["wd:Q174385", "wd:Q212965", "wd:Q68934496"]));

  for (const { review } of c2) {
    assertSafeEditorialSources(review);
    const kim = review.sources.find((source) => source.publisher === "Kids-In-Mind");
    assert.ok(kim);
    assert.match(kim.usageNoteAr, /النسخة السينمائية/u, review.id);
    assert.equal(review.uncertainCategories.length > 0, true, review.id);
    assert.match(review.scopeAr, /ليس/u, review.id);
  }
});
