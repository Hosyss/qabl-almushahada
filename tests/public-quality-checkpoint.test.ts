import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildPublicEditorialReviewHref } from "../lib/editorial-review.ts";
import { listEditorialReviewPublications } from "../lib/editorial-review-registry.ts";
import { buildPublicCatalogTitleHref } from "../lib/public-catalog.ts";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("homepage has no generic /review CTA and is driven only by the four real editorial publications", async () => {
  const home = await source("app/page.tsx");
  assert.doesNotMatch(home, /href\s*=\s*["']\/review["']/u);
  assert.doesNotMatch(home, /افتح المراجعة الكاملة/u);
  assert.doesNotMatch(home, /مناسب بمرافقة|ثقة مرتفعة|تمت مراجعة النسخة/u);
  assert.match(home, /listEditorialReviewPublications/u);
  assert.match(home, /تحليلات منشورة حديثًا/u);
  assert.match(home, /تحليل تحريري جزئي — الحكم غير مكتمل/u);
  assert.match(home, /"@type": "WebSite"/u);
  assert.match(home, /"@type": "Organization"/u);
  assert.doesNotMatch(home, /SearchAction/u);

  const publications = listEditorialReviewPublications();
  assert.equal(publications.length, 4);
  for (const publication of publications) {
    const reviewHref = buildPublicEditorialReviewHref(publication.id);
    const titleHref = buildPublicCatalogTitleHref(publication.titleId);
    assert.match(reviewHref, /^\/review\?editorialId=/u);
    assert.ok(titleHref?.startsWith("/title/Q"));
  }
});

test("search combobox keeps its ARIA and keyboard navigation contract", async () => {
  const combobox = await source("app/search/title-search-combobox.tsx");
  for (const token of [
    'role="combobox"',
    'aria-autocomplete="list"',
    "aria-expanded={open}",
    "aria-controls={listId}",
    "aria-activedescendant=",
    'role="listbox"',
    'role="option"',
    'maxLength={80}',
  ]) {
    assert.ok(combobox.includes(token), `Search combobox lost accessibility token: ${token}`);
  }
  for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
    assert.ok(combobox.includes(`event.key === "${key}"`), `Search combobox lost keyboard handler: ${key}`);
  }
  assert.match(combobox, /window\.location\.assign\(items\[active\]\.href\)/u);
});

test("public editorial copies use neutral source wording and Arabic names inside Arabic prose", () => {
  for (const publication of listEditorialReviewPublications()) {
    const publicArabicText = [
      publication.scopeAr,
      publication.analysisAr,
      ...publication.claims.map((claim) => claim.summaryAr),
      ...publication.sources.map((source) => source.usageNoteAr),
    ].join("\n");
    assert.doesNotMatch(publicArabicText, /مؤهل/u, `${publication.id} still describes a source as qualified`);
    assert.doesNotMatch(publicArabicText, /\bHarry\b/u, `${publication.id} still mixes Harry into Arabic prose`);
  }
});

test("title pages keep registry links as presentation only and never encode editorial IDs in catalog SQL", async () => {
  const titlePage = await source("app/title/[qid]/page.tsx");
  const catalogQuery = await source("db/public-catalog-query.ts");
  assert.match(titlePage, /getEditorialReviewPublicationForTitleId/u);
  assert.match(titlePage, /buildPublicEditorialReviewHref/u);
  assert.doesNotMatch(catalogQuery, /editorial-review-publications|editorialId|cars-2006|et-1982|minions-2015|harry-potter-philosophers/u);
  assert.doesNotMatch(catalogQuery, /wd:Q\d+/u);
});

test("partial editorial UI does not expose engine internals or pretend to be a verified-version review", async () => {
  const view = await source("app/review/editorial-review-view.tsx");
  assert.match(view, /تحليل تحريري جزئي/u);
  assert.match(view, /المعلومات غير كافية لإصدار حكم نهائي/u);
  assert.match(view, /مدعومة بمصدرين مستقلين على الأقل/u);
  assert.match(view, /محاور لم نستطع حسمها/u);
  assert.match(view, /<details/u);
  assert.doesNotMatch(view, /insufficient_data|decisionEligible|P4-03/u);
  assert.doesNotMatch(view, /المصادر المؤهلة|اتفاق مصدرين مستقلين\+/u);
  assert.doesNotMatch(view, /المصادر الحالية لا تكفي لحسم هذا المحور/u);
  assert.match(view, /if \(count === 1\) return "واقعة واحدة"/u);
  assert.match(view, /if \(count === 2\) return "واقعتان"/u);
  assert.match(view, /count >= 3 && count <= 10/u);
});

test("invalid review routes remain noindex and fail closed with a search path", async () => {
  const reviewPage = await source("app/review/page.tsx");
  assert.match(reviewPage, /title: "المراجعة غير متاحة \| قبل المشاهدة"/u);
  assert.match(reviewPage, /robots: \{ index: false, follow: true \}/u);
  assert.match(reviewPage, /locatorCount !== 1/u);
  assert.match(reviewPage, /href="\/search"/u);
});

test("catalog-only title pages are noindex while rich editorial title pages can be indexed", async () => {
  const titlePage = await source("app/title/[qid]/page.tsx");
  assert.match(titlePage, /robots: \{ index: Boolean\(names\.editorial\), follow: true \}/u);
});

test("sitemap contains only indexable title detail pages from rich editorial registry entries", async () => {
  const sitemap = await source("app/sitemap.xml/route.ts");
  assert.match(sitemap, /listEditorialReviewPublications/u);
  assert.match(sitemap, /buildPublicEditorialReviewCanonicalUrl/u);
  assert.match(sitemap, /buildPublicCatalogTitleHref\(review\.titleId\)/u);
  assert.doesNotMatch(sitemap, /listPublicCatalogTitles|listPublicCatalogDirectory/u);
});

test("review policy clearly separates partial editorial analysis from verified version review", async () => {
  const policy = await source("app/review-policy/page.tsx");
  assert.match(policy, /تحليل تحريري جزئي للعمل/u);
  assert.match(policy, /مراجعة موثقة لنسخة محددة/u);
  assert.match(policy, /لا يدّعي أن فريقنا شاهد/u);
});

test("Kids-In-Mind stays link-only and never claims republication permission", async () => {
  const sources = await source("lib/editorial-review-source-builders.ts");
  assert.match(sources, /link_only_factual_reference/u);
  assert.match(sources, /لا ندّعي ترخيص إعادة نشر/u);
  assert.match(sources, /لا ننقل نص المراجعة أو تقييماتها العددية أو بنيتها/u);
});
