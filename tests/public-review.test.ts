import assert from "node:assert/strict";
import test from "node:test";

import { createVerifiedDemoBundle } from "../lib/review-engine/index.ts";
import {
  MAX_PUBLIC_REVIEW_BUNDLE_ID_LENGTH,
  buildPublicReviewView,
  parsePublicReviewLocator,
  type PublicReviewMetadata,
} from "../lib/public-review.ts";

function metadata(): PublicReviewMetadata {
  return {
    bundleId: "review-bundle-demo-024",
    titleId: "title-cloud-city",
    canonicalName: "مدينة الغيم",
    originalName: "Cloud City",
    kind: "movie",
    releaseYear: 2024,
    versionId: "version-demo-ar-2024",
    editionLabel: "النسخة العربية",
    platform: "example-platform",
    language: "ar",
    runtimeSeconds: 5538,
    contentFingerprint: "demo-ar-2024-5538-v1",
    publishedAt: "2026-08-08T15:05:00.000Z",
    approvedAt: "2026-08-08T15:00:00.000Z",
  };
}

test("public review locator accepts only one bounded bundle id", () => {
  assert.deepEqual(parsePublicReviewLocator({ bundleId: " review-bundle-1 " }), {
    bundleId: "review-bundle-1",
  });
  assert.throws(() => parsePublicReviewLocator("review-bundle-1"));
  assert.throws(() => parsePublicReviewLocator({ bundleId: "review", titleId: "title" }));
  assert.throws(() => parsePublicReviewLocator({ bundleId: "" }));
  assert.throws(() => parsePublicReviewLocator({ bundleId: "x".repeat(MAX_PUBLIC_REVIEW_BUNDLE_ID_LENGTH + 1) }));
  assert.throws(() => parsePublicReviewLocator({ bundleId: "review\nother" }));
});

test("verified bundle becomes a public DTO without reviewer identities", () => {
  const view = buildPublicReviewView(metadata(), createVerifiedDemoBundle());
  assert.ok(view);
  assert.equal(view.title.canonicalName, "مدينة الغيم");
  assert.equal(view.reviewerCount, 2);
  assert.equal(view.observationCount, 8);
  assert.equal(view.highestCategory, "fear");
  assert.equal(view.categories.find((category) => category.id === "fear")?.severity, 2);
  assert.equal(view.categories.find((category) => category.id === "fear")?.facts.length, 2);
  assert.equal("reviewerId" in (view as unknown as Record<string, unknown>), false);
});

test("public DTO refuses metadata that does not identify the hydrated bundle", () => {
  const bundle = createVerifiedDemoBundle();
  assert.equal(buildPublicReviewView({ ...metadata(), versionId: "stale-version" }, bundle), null);
  assert.equal(buildPublicReviewView({ ...metadata(), contentFingerprint: "stale-fingerprint" }, bundle), null);
  assert.equal(buildPublicReviewView({ ...metadata(), approvedAt: "2026-08-08T16:00:00.000Z" }, bundle), null);
});

test("public DTO refuses a bundle after a blocking report appears", () => {
  const bundle = createVerifiedDemoBundle();
  bundle.blockingReports.push({ id: "report-1", reportType: "wrong_severity", status: "open" });
  assert.equal(buildPublicReviewView(metadata(), bundle), null);
});

test("public DTO exposes stored spoiler level but never invents expanded spoiler copy", () => {
  const view = buildPublicReviewView(metadata(), createVerifiedDemoBundle());
  assert.ok(view);
  const contextual = view.categories
    .flatMap((category) => category.facts)
    .find((fact) => fact.spoilerLevel === "contextual");
  assert.ok(contextual);
  assert.match(contextual.summary, /مطاردة|غياب/);
  assert.equal("expandedSummary" in (contextual as unknown as Record<string, unknown>), false);
});
