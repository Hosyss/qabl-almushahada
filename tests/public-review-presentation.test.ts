import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPublicArticleStructuredData } from "../lib/public-article-structured-data.ts";
import { PUBLIC_SITE_ORIGIN } from "../lib/public-catalog.ts";
import { createVerifiedDemoBundle } from "../lib/review-engine/index.ts";
import {
  buildPublicReviewHref,
  buildPublicReviewView,
  type PublicReviewMetadata,
} from "../lib/public-review.ts";
import {
  buildPublicReviewPresentation,
  formatFactTime,
  getFactSummaryForSpoilerMode,
} from "../lib/public-review-presentation.ts";

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

test("public review presentation maps severity and metadata without inventing level taxonomy", () => {
  const view = buildPublicReviewView(metadata(), createVerifiedDemoBundle());
  assert.ok(view);

  const presentation = buildPublicReviewPresentation(view);
  const fear = presentation.categories.find((category) => category.id === "fear");
  assert.ok(fear);
  assert.equal(fear.severity, 2);
  assert.equal(fear.severityPercent, 50);
  assert.equal(fear.severityLabel, "شدة 2 من 4");
  assert.equal(presentation.highestCategoryLabel, "الخوف والتوتر");
  assert.equal(presentation.highestSeverity, 2);
  assert.equal(presentation.runtimeLabel, "1:32:18");
  assert.ok(["أدلة مرتفعة", "أدلة متوسطة", "أدلة محدودة", "غير متاحة"].includes(presentation.confidenceLabel));
  assert.equal(/\d/.test(presentation.confidenceLabel), false);
});

test("spoiler-free presentation hides stored contextual text instead of fabricating replacement content", () => {
  const view = buildPublicReviewView(metadata(), createVerifiedDemoBundle());
  assert.ok(view);
  const contextual = view.categories
    .flatMap((category) => category.facts)
    .find((fact) => fact.spoilerLevel === "contextual");
  assert.ok(contextual);

  assert.equal(getFactSummaryForSpoilerMode(contextual, true), null);
  assert.equal(getFactSummaryForSpoilerMode(contextual, false), contextual.summary);
});

test("public review href carries the exact encoded bundle locator", () => {
  assert.equal(
    buildPublicReviewHref("bundle/نسخة واحدة"),
    "/review?bundleId=bundle%2F%D9%86%D8%B3%D8%AE%D8%A9%20%D9%88%D8%A7%D8%AD%D8%AF%D8%A9",
  );
  assert.throws(() => buildPublicReviewHref("bad\nbundle"));
});

test("fact time formatting is deterministic", () => {
  assert.equal(formatFactTime(24), "00:24");
  assert.equal(formatFactTime(5538), "1:32:18");
});

test("public Article structured data contains only truthful article fields", () => {
  const canonical = `${PUBLIC_SITE_ORIGIN}${buildPublicReviewHref("review-bundle-demo-024")}`;
  const json = buildPublicArticleStructuredData({
    headline: "مدينة الغيم (2024) — مراجعة موثقة",
    description: "مراجعة موثقة لنسخة محددة.",
    canonical,
    datePublished: metadata().publishedAt,
  });
  const payload = JSON.parse(json) as Record<string, unknown>;

  assert.equal(payload["@context"], "https://schema.org");
  assert.equal(payload["@type"], "Article");
  assert.equal(payload.headline, "مدينة الغيم (2024) — مراجعة موثقة");
  assert.equal(payload.datePublished, metadata().publishedAt);
  assert.equal("dateModified" in payload, false);
  assert.equal("reviewRating" in payload, false);
  assert.equal("aggregateRating" in payload, false);
  assert.deepEqual(payload.author, {
    "@type": "Organization",
    name: "قبل المشاهدة",
    url: PUBLIC_SITE_ORIGIN,
  });
  assert.deepEqual(payload.mainEntityOfPage, {
    "@type": "WebPage",
    "@id": canonical,
  });
});

test("Article structured data rejects off-site canonicals and malformed dates", () => {
  assert.throws(() => buildPublicArticleStructuredData({
    headline: "عنوان",
    description: "وصف",
    canonical: "https://example.com/review?id=1",
    datePublished: "2026-08-08T15:05:00.000Z",
  }));
  assert.throws(() => buildPublicArticleStructuredData({
    headline: "عنوان",
    description: "وصف",
    canonical: `${PUBLIC_SITE_ORIGIN}/review?id=1`,
    datePublished: "not-a-date",
  }));
});

test("review route renders JSON-LD only through valid review branches and does not misuse approval time as modification time", async () => {
  const pageSource = await readFile(new URL("../app/review/page.tsx", import.meta.url), "utf8");

  assert.match(pageSource, /<PublicArticleJsonLd descriptor=\{describeHumanReview\(review\)\} \/>/u);
  assert.match(pageSource, /<PublicArticleJsonLd descriptor=\{describeEvidenceReview\(review\)\} \/>/u);
  assert.match(pageSource, /<PublicArticleJsonLd descriptor=\{describeEditorialReview\(persisted\)\} \/>/u);
  assert.match(pageSource, /type="application\/ld\+json"/u);
  assert.doesNotMatch(pageSource, /modifiedTime:\s*review\.approvedAt/u);
  assert.doesNotMatch(pageSource, /reviewRating|aggregateRating/u);
});
