import assert from "node:assert/strict";
import test from "node:test";

import { classifyPublicSearchAvailability } from "../lib/public-search-result-state.ts";

test("verified availability wins even when another review is in progress", () => {
  assert.equal(classifyPublicSearchAvailability({ hasVerifiedReview: true, hasReviewInProgress: true }), "verified");
});

test("in-review is shown only when D1 reports an active review workflow", () => {
  assert.equal(classifyPublicSearchAvailability({ hasVerifiedReview: false, hasReviewInProgress: true }), "in_review");
});

test("catalog-only never pretends that an unreviewed title is in review", () => {
  assert.equal(classifyPublicSearchAvailability({ hasVerifiedReview: false, hasReviewInProgress: false }), "catalog_only");
});
