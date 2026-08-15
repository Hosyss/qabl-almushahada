import assert from "node:assert/strict";
import test from "node:test";

import { buildEditorialPublicationFingerprint } from "../lib/editorial-publication-integrity.ts";
import { assessEditorialReviewPublication } from "../lib/editorial-review.ts";
import { FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES } from "./editorial-bootstrap-fixtures.ts";

test("the ten editorial bootstrap fixtures remain internally exact and decision-ineligible", async () => {
  assert.equal(FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.length, 10);
  const ids = new Set<string>();
  const titleIds = new Set<string>();

  for (const fixture of FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES) {
    assert.equal(ids.has(fixture.review.id), false, fixture.review.id);
    assert.equal(titleIds.has(fixture.review.titleId), false, fixture.review.titleId);
    ids.add(fixture.review.id);
    titleIds.add(fixture.review.titleId);

    const fingerprint = await buildEditorialPublicationFingerprint(fixture.review, fixture.presentation);
    assert.equal(fingerprint, fixture.fingerprint, fixture.review.id);

    const assessment = assessEditorialReviewPublication(fixture.review);
    assert.equal(assessment.publishable, true, fixture.review.id);
    assert.equal(assessment.decisionEligible, false, fixture.review.id);
    assert.equal(assessment.decisionStatus, "insufficient_data", fixture.review.id);
  }
});
