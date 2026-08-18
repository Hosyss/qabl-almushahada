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
  assert.match(home, /listEditorialPublications\(4\)/u);
  assert.match(home, /عرض كل التحليلات/u);
  assert.doesNotMatch(home, /editorial-review-registry|listEditorialReviewPublications/u);
  assert.match(home, /تحليلات منشورة حديثًا/u);
  assert.match(home, /تحليل متعدد المصادر — راجع حالة الحكم/u);
  assert.match(home, /لا «غير مكتمل» كإجابة دائمة/u);
  assert.match(home, /"@type": "WebSite"/u);
  assert.match(home, /"@type": "Organization"/u);
  assert.doesNotMatch(home, /SearchAction/u);
  assert.doesNotMatch(home, /تاخد|إيه|مش منتجان|دي درجة|ما بيتحولش|لو المجهول|\bunknown\b|\bnone\b|\bSeverity\b/u);

  const publications = await frozenEditorialPublications();
  assert.equal(publications.length, 10);
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

test("practical editorial UI stays source-safe and does not pretend to be a verified-version review", async () => {
  const view = await source("app/review/editorial-review-view.tsx");
  const practical = await source("app/review/editorial-practical-verdict.tsx");
  assert.match(view, /تحليل تحريري متعدد المصادر/u);
  assert.match(view, /حكم عملي على مستوى العمل/u);
  assert.match(view, /حالة الحكم العملي موضحة أدناه/u);
  assert.match(view, /مدعومة بمصدرين مستقلين على الأقل/u);
  assert.match(view, /المحاور غير المحسومة/u);
  assert.match(view, /<details/u);
  assert.doesNotMatch(view, /insufficient_data|decisionEligible|P4-03/u);
  assert.doesNotMatch(view, /المصادر المؤهلة|اتفاق مصدرين مستقلين\+/u);
  assert.doesNotMatch(view, /المصادر الحالية لا تكفي لحسم هذا المحور/u);
  assert.match(practical, /LOCAL_FAMILY_SETTINGS_STORAGE_KEY/u);
  assert.match(practical, /serializeLocalFamilySettings/u);
  assert.match(practical, /إعدادات الأسرة لا تكفي لإصدار الحكم الآن/u);
  assert.match(practical, /بقية حدود المحاور تُشتق حاليًا من إعدادات افتراضية مرتبطة بالعمر/u);
  assert.match(practical, /لا نرسل عمر الطفل أو تفضيلات الأسرة/u);
  assert.match(practical, /لا يحوّل المحاور غير المحسومة إلى «لا يوجد»/u);
  assert.match(practical, /لا نستخدمها وحدها لإثبات تجاوز حد أسري/u);
  assert.doesNotMatch(practical, /ليه الحكم ده|corpus|محتاج هوية|لو وُجد/u);
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

test("review policy separates practical family verdict from verified exact-version review", async () => {
  const policy = await source("app/review-policy/page.tsx");
  assert.match(policy, /حكم عملي للأسرة على مستوى العمل/u);
  assert.match(policy, /المراجعة الموثقة لنسخة محددة/u);
  assert.match(policy, /90 يوم/u);
  assert.match(policy, /لا نفترض عمر طفل/u);
  assert.match(policy, /درجة شدة رقمية/u);
  assert.match(policy, /تظل غير محسومة ولا تتحول إلى «لا يوجد»/u);
  assert.match(policy, /حدودًا تحريرية افتراضية مرتبطة بالعمر/u);
  assert.doesNotMatch(policy, /ينفع للمشاهدة|\bcorroborated\b|\bSeverity\b|\bunknown\b|\bnone\b/u);
});

test("Kids-In-Mind frozen source references stay link-only and never claim republication permission", async () => {
  const publications = await frozenEditorialPublications();
  const kidSources = publications.flatMap(({ review }) => review.sources).filter((item: { publisher: string }) => item.publisher === "Kids-In-Mind");
  assert.equal(kidSources.length, 10);
  for (const item of kidSources) {
    assert.equal(item.usageBasis, "link_only_factual_reference");
    assert.match(item.rightsLabel, /لا .*ترخيص.*إعادة نشر/u);
    assert.match(item.usageNoteAr, /لا ننقل|من غير نقل/u);
  }
});
