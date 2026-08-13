import Link from "next/link";

import { searchPublicTitleDiscovery } from "@/db/public-title-search-service";
import { getEditorialPublicationPresentation } from "@/lib/editorial-publication-presentation";
import { buildPublicCatalogTitleHref } from "@/lib/public-catalog";
import { buildPublicEditorialReviewHref } from "@/lib/editorial-review";
import { getEditorialReviewPublicationForTitleId } from "@/lib/editorial-review-registry";
import { buildPublicReviewHref } from "@/lib/public-review";
import { filterPublicTitleSearchResults, hasActivePublicSearchFilters, parsePublicSearchFilters, type PublicSearchAgeOption } from "@/lib/public-search-filters";
import { classifyPublicSearchAvailability } from "@/lib/public-search-result-state";
import { getPublicTitleDisplayNames, type PublicTitleKind, type PublicTitleSearchResult } from "@/lib/public-title-search";
import styles from "./search.module.css";
import TitleSearchCombobox from "./title-search-combobox";

const KIND_LABELS: Record<PublicTitleKind, string> = { movie: "فيلم", series: "مسلسل", episode: "حلقة", special: "عمل خاص" };
const AGE_LABELS: Record<PublicSearchAgeOption, string> = { 5: "3–5 سنوات", 8: "6–8 سنوات", 11: "9–11 سنة", 14: "12–14 سنة", 17: "15–17 سنة" };
const AVAILABILITY_COPY = {
  verified: { label: "موجود — مراجعة موثقة", description: "توجد مراجعة منشورة لنسخة نشطة من هذا العنوان." },
  in_review: { label: "موجود — قيد المراجعة", description: "هناك دورة مراجعة قائمة ولم تُنشر نتيجة موثقة بعد." },
  catalog_only: { label: "موجود — لم يكتمل الحكم بعد", description: "العنوان موجود في الدليل، لكن لا توجد بوابة حكم مكتملة حاليًا." },
} as const;
const EDITORIAL_COPY = { label: "موجود — تحليل تحريري جزئي", description: "توجد وقائع مثبتة، لكن المعلومات غير كافية لإصدار حكم نهائي." } as const;

type SearchPageProps = { searchParams: Promise<{ q?: string | string[]; kind?: string | string[]; age?: string | string[]; status?: string | string[] }> };

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const filters = parsePublicSearchFilters(params);
  let results: PublicTitleSearchResult[] = [];
  let didYouMean: PublicTitleSearchResult[] = [];
  let errorMessage = "";

  if (query) {
    try {
      const discovery = await searchPublicTitleDiscovery({ query });
      results = discovery.matches;
      didYouMean = discovery.didYouMean;
    } catch (error) {
      errorMessage = error instanceof TypeError || error instanceof RangeError
        ? "اكتب اسمًا أوضح للفيلم أو المسلسل، من حرفين على الأقل ومن غير نص طويل بصورة غير معقولة."
        : "تعذّر البحث الآن. حاول مرة أخرى بعد قليل.";
    }
  }

  const filteredResults = filterPublicTitleSearchResults(results, filters);
  const filtersActive = hasActivePublicSearchFilters(filters);
  const resetHref = `/search?q=${encodeURIComponent(query)}`;
  const hiddenFields: Record<string, string> = {};
  if (filters.kind !== "all") hiddenFields.kind = filters.kind;
  if (filters.age !== null) hiddenFields.age = String(filters.age);
  if (filters.status !== "all") hiddenFields.status = filters.status;

  return (
    <main className={styles.page}>
      <header className={styles.header}><Link href="/" className={styles.brand}>قبل المشاهدة</Link><Link href="/" className={styles.back}>العودة للرئيسية</Link></header>
      <section className={styles.hero} aria-labelledby="search-title">
        <span className={styles.kicker}>بحث الدليل</span>
        <h1 id="search-title">ابحث بالاسم العربي أو الاسم الإنجليزي.</h1>
        <p>نطبع اختلافات الكتابة الشائعة بصورة محافظة. التخمين الضعيف لا يتحول إلى نتيجة مؤكدة.</p>
        <TitleSearchCombobox initialQuery={query} hiddenFields={hiddenFields} />
      </section>
      <section className={styles.results} aria-live="polite">
        {!query && !errorMessage ? <EmptyState title="ابدأ باسم العمل" text="اكتب الاسم العربي أو الإنجليزي لنبحث في عناوين D1 الحقيقية." /> : null}
        {errorMessage ? <EmptyState title="لم نقدر نبحث بهذه الصيغة" text={errorMessage} /> : null}
        {query && !errorMessage && results.length === 0 && didYouMean.length > 0 ? <DidYouMeanResults query={query} results={didYouMean} /> : null}
        {query && !errorMessage && results.length === 0 && didYouMean.length === 0 ? <EmptyState title="غير موجود" text={`لم نجد تطابقًا مباشرًا أو اقتراحًا قريبًا بما يكفي لـ «${query}» في الدليل حاليًا.`} /> : null}
        {results.length > 0 ? <>
          <div className={styles.resultsHeading}><div><span>نتائج البحث</span><h2>{filtersActive ? `${filteredResults.length} من ${results.length}` : results.length} {results.length === 1 ? "نتيجة" : "نتائج"} لـ «{query}»</h2></div><small>عند وجود أجزاء متعددة نعرض الخيارات ولا نختار جزءًا تلقائيًا.</small></div>
          <form className={styles.filters} action="/search" method="get" aria-label="تصفية نتائج البحث">
            <input type="hidden" name="q" value={query} />
            <label className={styles.filterControl}><span>النوع</span><select name="kind" defaultValue={filters.kind}><option value="all">كل الأنواع</option><option value="movie">فيلم</option><option value="series">مسلسل</option><option value="episode">حلقة</option><option value="special">عمل خاص</option></select></label>
            <label className={styles.filterControl}><span>العمر</span><select name="age" defaultValue={filters.age?.toString() ?? ""}><option value="">كل الأعمار</option><option value="5">3–5 سنوات</option><option value="8">6–8 سنوات</option><option value="11">9–11 سنة</option><option value="14">12–14 سنة</option><option value="17">15–17 سنة</option></select></label>
            <label className={styles.filterControl}><span>حالة التحقق</span><select name="status" defaultValue={filters.status}><option value="all">كل الحالات</option><option value="verified">مراجعة موثقة</option><option value="in_review">قيد المراجعة</option><option value="catalog_only">الحكم غير مكتمل</option></select></label>
            <div className={styles.filterActions}><button type="submit">تطبيق الفلاتر</button>{filtersActive ? <Link href={resetHref}>مسح الفلاتر</Link> : null}</div>
          </form>
          <p className={styles.filterNote}>فلتر العمر يعمل على المراجعات الموثقة فقط؛ التحليل التحريري الجزئي لا يتحول إلى حكم تلقائي.{filters.age !== null ? ` الحد المختار الآن: ${AGE_LABELS[filters.age]}.` : ""}</p>
          {filteredResults.length === 0 ? <EmptyState title="لا توجد نتائج بهذه الفلاتر" text="جرّب تغيير الفلاتر أو امسحها لرؤية كل المطابقات." /> : <div className={styles.grid}>{filteredResults.map((result) => <SearchResultCard key={result.id} result={result} />)}</div>}
        </> : null}
      </section>
    </main>
  );
}

function titleNames(result: PublicTitleSearchResult) {
  const editorial = getEditorialReviewPublicationForTitleId(result.id);
  if (editorial) {
    const presentation = getEditorialPublicationPresentation(editorial);
    return { editorial, arabicName: presentation.titleAr, englishName: presentation.titleEn };
  }
  const names = getPublicTitleDisplayNames(result);
  return { editorial: null, arabicName: names.arabicName, englishName: names.englishName };
}

function SearchResultCard({ result }: { result: PublicTitleSearchResult }) {
  const availability = classifyPublicSearchAvailability(result);
  const names = titleNames(result);
  const editorialState = Boolean(names.editorial) && availability !== "verified";
  const copy = editorialState ? EDITORIAL_COPY : AVAILABILITY_COPY[availability];
  const href = buildPublicCatalogTitleHref(result.id);
  return <article className={styles.card}>
    <div className={styles.cardTop}><span className={`${styles.status} ${styles[`status_${availability}`]}`}>{copy.label}</span><span className={styles.year}>{result.releaseYear}</span></div>
    <h3>{names.arabicName}</h3><p className={styles.original} dir="ltr">{names.englishName}</p>
    <div className={styles.meta}><span>{KIND_LABELS[result.kind]}</span><span aria-hidden="true">•</span><span>{copy.description}</span>{href ? <><span aria-hidden="true">•</span><Link className={styles.back} href={href}>صفحة العمل ←</Link></> : null}{editorialState && names.editorial ? <><span aria-hidden="true">•</span><Link className={styles.back} href={buildPublicEditorialReviewHref(names.editorial.id)}>فتح التحليل التحريري ←</Link></> : null}{availability === "verified" && result.verifiedBundleId ? <><span aria-hidden="true">•</span><Link className={styles.back} href={buildPublicReviewHref(result.verifiedBundleId)}>فتح المراجعة الموثقة ←</Link></> : null}</div>
  </article>;
}

function DidYouMeanResults({ query, results }: { query: string; results: PublicTitleSearchResult[] }) {
  return <div className={styles.didYouMean}><div className={styles.resultsHeading}><div><span>مطابقة محافظة</span><h2>هل تقصد؟</h2></div><small>اقتراحات قريبة فقط وليست نتيجة مؤكدة لـ «{query}». اختر العمل بنفسك.</small></div><div className={styles.grid}>{results.map((result) => {
    const href = buildPublicCatalogTitleHref(result.id); if (!href) return null; const names = titleNames(result);
    return <Link className={styles.suggestionCard} href={href} key={result.id}><strong>{names.arabicName}</strong><span dir="ltr">{names.englishName}</span><small>({result.releaseYear})</small></Link>;
  })}</div></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className={styles.empty}><span aria-hidden="true">⌕</span><h2>{title}</h2><p>{text}</p></div>;
}
