import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { buildPublicEditorialReviewHref } from "../lib/editorial-review.ts";
import { buildPublicCatalogTitleHref } from "../lib/public-catalog.ts";

async function source(file: string) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}

async function frozenEditorialPublications() {
  const directory = path.join(process.cwd(), "data", "editorial-bootstrap");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  return Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(directory, name), "utf8"))));
}

test("homepage has no generic /review CTA and reads real editorial publications from D1", async () => {
  const home = await source("app/page.tsx");
  assert.doesNotMatch(home, /href\s*=\s*["']\/review["']/u);
  assert.doesNotMatch(home, /افتح المراجعة الكاملة/u);
  assert.doesNotMatch(home, /مناسب بمرافقة|ثقة مرتفعة|تمت مراجعة النسخة/u);
  assert.match(home, /listEditorialPublications/u);
  assert.doesNotMatch(home, /editorial-review-registry|listEditorialReviewPublications/u);
  assert.match(home, /تحليلات منشورة حديثًا/u);
  assert.match(home, /تحليل تحريري جزئي — الحكم غير مكتمل/u);
  assert.match(home, /"@type": "WebSite"/u);
  assert.match(home, /"@type": "Organization"/u);
  assert.doesNotMatch(home, /SearchAction/u);

  const publications = await frozenEditorialPublications();
  assert.equal(publications.length, 4);
  for (const { review } of publications) {
    const reviewHref = buildPublicEditorialReviewHref(review.id);
    const titleHref = buildPublicCatalogTitleHref(review.titleId);
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
  ]) assert.ok(combobox.includes(token), `Search combobox lost accessibility token: ${token}`);
  for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
    assert.ok(combobox.includes(`event.key === "${key}"`), `Search combobox lost keyboard handler: ${key}`);
  }
  assert.match(combobox, /window\.location\.assign\(items\[active\]\.href\)/u);
});

test("frozen editorial copies keep neutral source wording", async () => {
  for (const { review } of await frozenEditorialPublications()) {
    const publicArabicText = [
      review.scopeAr,
      review.analysisAr,
      ...review.claims.map((claim: { summaryAr: string }) => claim.summaryAr),
      ...review.sources.map((item: { usageNoteAr: string }) => item.usageNoteAr),
    ].join("\n");
    assert.doesNotMatch(publicArabicText, /مؤهل/u, `${review.id} still describes a source as qualified`);
  }
});

test("title pages read editorial state from D1 and catalog SQL contains no fixed editorial IDs", async () => {
  const titlePage = await source("app/title/[qid]/page.tsx");
  const catalogQuery = await source("db/public-catalog-query.ts");
  assert.match(titlePage, /loadEditorialPublicationForTitleId/u);
  assert.match(titlePage, /buildPublicEditorialReviewHref/u);
  assert.doesNotMatch(titlePage, /editorial-review-registry|getEditorialReviewPublicationForTitleId/u);
  assert.match(catalogQuery, /editorial_publication_heads/u);
  assert.match(catalogQuery, /editorial_publication_revisions/u);
  assert.match(catalogQuery, /current_revision_id/u);
  assert.doesNotMatch(catalogQuery, /cars-2006|et-1982|minions-2015|harry-potter-philosophers|wd:Q\d+/u);
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
  assert.match(reviewPage, /\[bundleId, publicationId, editorialId\]\.filter\(Boolean\)\.length !== 1/u);
  assert.match(reviewPage, /loadEditorialPublicationById/u);
  assert.match(reviewPage, /href="\/search"/u);
});

test("catalog-only title pages are noindex while current editorial title pages can be indexed", async () => {
  const titlePage = await source("app/title/[qid]/page.tsx");
  assert.match(titlePage, /robots: \{ index: Boolean\(names\.editorial\), follow: true \}/u);
});

test("sitemap uses current D1 editorial heads rather than the TypeScript registry", async () => {
  const sitemap = await source("app/sitemap.xml/route.ts");
  assert.match(sitemap, /listEditorialPublications/u);
  assert.match(sitemap, /buildPublicEditorialReviewCanonicalUrl/u);
  assert.match(sitemap, /buildPublicCatalogTitleHref\(review\.titleId\)/u);
  assert.doesNotMatch(sitemap, /listEditorialReviewPublications|editorial-review-registry/u);
  assert.doesNotMatch(sitemap, /listPublicCatalogTitles|listPublicCatalogDirectory/u);
});

test("review policy clearly separates partial editorial analysis from verified version review", async () => {
  const policy = await source("app/review-policy/page.tsx");
  assert.match(policy, /تحليل تحريري جزئي للعمل/u);
  assert.match(policy, /مراجعة موثقة لنسخة محددة/u);
  assert.match(policy, /لا يدّعي أن فريقنا شاهد/u);
});

test("Kids-In-Mind frozen source references stay link-only and never claim republication permission", async () => {
  const publications = await frozenEditorialPublications();
  const kidSources = publications.flatMap(({ review }) => review.sources).filter((item: { publisher: string }) => item.publisher === "Kids-In-Mind");
  assert.equal(kidSources.length, 4);
  for (const item of kidSources) {
    assert.equal(item.usageBasis, "link_only_factual_reference");
    assert.match(item.rightsLabel, /لا ندّعي ترخيص إعادة نشر/u);
    assert.match(item.usageNoteAr, /لا ننقل نص المراجعة أو تقييماتها العددية أو بنيتها/u);
  }
});
