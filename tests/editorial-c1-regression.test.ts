import assert from "node:assert/strict";
import test from "node:test";

import { FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES } from "./editorial-bootstrap-fixtures.ts";

const OLD_FINGERPRINTS = new Map([
  ["cars-2006-editorial-pilot-v1", "sha256:e8d3679f818e5c9d288d191537ec1944ceffe7144c7171442e8f31a72aebee11"],
  ["et-1982-editorial-batch-v1", "sha256:f9aee29440c3499f357cf9b708a7270a3d35849ac90e8b18dece5fe7add9dcd2"],
  ["harry-potter-philosophers-stone-2001-editorial-batch-v1", "sha256:3ce8a43f965e1d5be0cb0445a3e2632c19c05a2b61a22a653373b5f8dd96afa7"],
  ["minions-2015-editorial-batch-v1", "sha256:33962eee8999654834b259912b8cee88ebd384315a86c81427d73e41f9a2bf7a"],
]);

const C1_IDS = new Set([
  "barbie-2023-editorial-c1-v1",
  "jurassic-park-1993-editorial-c1-v1",
  "my-neighbor-totoro-1988-editorial-c1-v1",
]);

const FORBIDDEN_PUBLISHERS = new Set(["Common Sense Media", "Plugged In", "BBFC", "Dove", "Dove.org"]);

test("P4-03C1 contains exactly seven publications and preserves the four B4 fingerprints", () => {
  assert.equal(FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.length, 7);
  for (const [id, fingerprint] of OLD_FINGERPRINTS) {
    const fixture = FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.find((item) => item.review.id === id);
    assert.ok(fixture, id);
    assert.equal(fixture.fingerprint, fingerprint, id);
  }
});

test("P4-03C1 adds exactly the three approved D1 titles with safe source usage and no judgment authority", () => {
  const c1 = FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.filter((item) => C1_IDS.has(item.review.id));
  assert.equal(c1.length, 3);
  assert.deepEqual(new Set(c1.map((item) => item.review.titleId)), new Set(["wd:Q55436290", "wd:Q167726", "wd:Q39571"]));

  for (const { review } of c1) {
    assert.equal(review.decisionEligible, false, review.id);
    assert.equal(review.decisionStatus, "insufficient_data", review.id);
    assert.equal(review.sources.length, 2, review.id);
    assert.equal(review.sources.some((source) => FORBIDDEN_PUBLISHERS.has(source.publisher)), false, review.id);

    const wikipedia = review.sources.find((source) => source.publisher === "Wikipedia (English)");
    assert.ok(wikipedia, review.id);
    assert.equal(wikipedia.usageBasis, "open_license", review.id);
    assert.match(wikipedia.sourceVersion ?? "", /^oldid=\d+$/, review.id);
    assert.equal(wikipedia.rightsLabel, "CC BY-SA 4.0", review.id);

    const kim = review.sources.find((source) => source.publisher === "Kids-In-Mind");
    assert.ok(kim, review.id);
    assert.equal(kim.usageBasis, "link_only_factual_reference", review.id);
    assert.equal(kim.rightsUrl, "https://kids-in-mind.com/terms.htm", review.id);

    for (const claim of review.claims) {
      if (claim.verification === "corroborated") {
        const groups = new Set(claim.sourceIds.map((sourceId) => review.sources.find((source) => source.id === sourceId)?.independenceGroupId));
        assert.equal(groups.size >= 2, true, `${review.id}:${claim.id}`);
      }
    }
  }
});
