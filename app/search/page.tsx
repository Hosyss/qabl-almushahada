import Link from "next/link";

import { searchPublicTitles } from "@/db/public-title-search-service";
import { buildPublicReviewHref } from "@/lib/public-review";
import {
  filterPublicTitleSearchResults,
  hasActivePublicSearchFilters,
  parsePublicSearchFilters,
  type PublicSearchAgeOption,
} from "@/lib/public-search-filters";
import { classifyPublicSearchAvailability } from "@/lib/public-search-result-state";
import type { PublicTitleKind, PublicTitleSearchResult } from "@/lib/public-title-search";

import styles from "./search.module.css";

const KIND_LABELS: Record<PublicTitleKind, string> = {
  movie: "فيلم",
  series: "مسلسل",
  episode: "حلقة",
  special: "عمل خاص",
};

const AGE_LABELS: Record<PublicSearchAgeOption, string> = {
  5: "3–5 سنوات",
  8: "6–8 سنوات",
  11: "9–11 سنة",
  14: "12–14 سنة",
  17: "15–17 سنة",
};

const AVAILABILITY_COPY = {
  verified: {
    label: "موجود — مراجعة موثقة",
    description: "توجد مراجعة منشورة لنسخة نشطة من هذا العنوان.",
  },
  in_review: {
    label: "قيد المراجعة",
    description: "هناك دورة مراجعة قائمة ولم تُنشر نتيجة موثقة بعد.",
  },
  catalog_only: {
    label: "موجود في الدليل",
    description: "العنوان مسجل، لكن لا توجد مراجعة نشطة أو منشورة حاليًا.",
  },
} as const;

type SearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    kind?: string | string[];
    age?: string | string[];
    status?: string | string[];
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const filters = parsePublicSearchFilters(params);

  let results: PublicTitleSearchResult[] = [];
  let errorMessage = "";

  if (query) {
    try {
      results = await searchPublicTitles({ query });
    } catch (error) {
      errorMessage =
        error instanceof TypeError || error instanceof RangeError
          ? "اكتب اسمًا أوضح للفيلم أو المسلسل، من حرفين على الأقل."
          : "تعذّر البحث الآن. حاول مرة أخرى بعد قليل.";
    }
  }

  const filteredResults = filterPublicTitleSearchResults(results, filters);
  const filtersActive = hasActivePublicSearchFilters(filters);
  const resetHref = `/search?q=${encodeURIComponent(query)}`;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>قبل المشاهدة</Link>
        <Link href="/" className={styles.back}>العودة للرئيسية</Link>
      </header>

      <section className={styles.hero} aria-labelledby="search-title">
        <span className={styles.kicker}>بحث الدليل</span>
        <h1 id="search-title">ابحث بالاسم العربي أو الاسم الأصلي.</h1>
        <p>نطبع اختلافات الكتابة الشائعة، لكن لا نخمن عنوانًا غير موجود ولا نعرض مراجعة غير موثقة كأنها منشورة.</p>

        <form className={styles.searchForm} action="/search" method="get" role="search">
          <label className="sr-only" htmlFor="search-query">اسم الفيلم أو المسلسل</label>
          <input id="search-query" name="q" defaultValue={query} placeholder="مثال: البحث عن نيمو أو Finding Nemo" autoComplete="off" />
          {filters.kind !== "all" ? <input type="hidden" name="kind" value={filters.kind} /> : null}
          {filters.age !== null ? <input type="hidden" name="age" value={filters.age} /> : null}
          {filters.status !== "all" ? <input type="hidden" name="status" value={filters.status} /> : null}
          <button type="submit">ابحث</button>
        </form>
      </section>

      <section className={styles.results} aria-live="polite">
        {!query && !errorMessage ? (
          <EmptyState title="ابدأ باسم العمل" text="اكتب اسمًا عربيًا أو الاسم الأصلي لنبحث في قاعدة العناوين." />
        ) : errorMessage ? (
          <EmptyState title="لم نقدر نبحث بهذه الصيغة" text={errorMessage} />
        ) : results.length === 0 ? (
          <EmptyState title="غير موجود" text={`لم نجد عنوانًا يطابق «${query}» في الدليل حاليًا.`} />
        ) : (
          <>
            <div className={styles.resultsHeading}>
              <div>
                <span>نتائج البحث</span>
                <h2>
                  {filtersActive ? `${filteredResults.length} من ${results.length}` : results.length}{" "}
                  {results.length === 1 ? "نتيجة" : "نتائج"} لـ «{query}»
                </h2>
              </div>
              <small>نرتب المطابقة النصية أولًا، والفلاتر لا تعيد ترتيب النتائج.</small>
            </div>

            <form className={styles.filters} action="/search" method="get" aria-label="تصفية نتائج البحث">
              <input type="hidden" name="q" value={query} />

              <label className={styles.filterControl}>
                <span>النوع</span>
                <select name="kind" defaultValue={filters.kind}>
                  <option value="all">كل الأنواع</option>
                  <option value="movie">فيلم</option>
                  <option value="series">مسلسل</option>
                  <option value="episode">حلقة</option>
                  <option value="special">عمل خاص</option>
                </select>
              </label>

              <label className={styles.filterControl}>
                <span>العمر</span>
                <select name="age" defaultValue={filters.age?.toString() ?? ""}>
                  <option value="">كل الأعمار</option>
                  <option value="5">3–5 سنوات</option>
                  <option value="8">6–8 سنوات</option>
                  <option value="11">9–11 سنة</option>
                  <option value="14">12–14 سنة</option>
                  <option value="17">15–17 سنة</option>
                </select>
              </label>

              <label className={styles.filterControl}>
                <span>حالة التحقق</span>
                <select name="status" defaultValue={filters.status}>
                  <option value="all">كل الحالات</option>
                  <option value="verified">مراجعة موثقة</option>
                  <option value="in_review">قيد المراجعة</option>
                  <option value="catalog_only">موجود في الدليل</option>
                </select>
              </label>

              <div className={styles.filterActions}>
                <button type="submit">تطبيق الفلاتر</button>
                {filtersActive ? <Link href={resetHref}>مسح الفلاتر</Link> : null}
              </div>
            </form>

            <p className={styles.filterNote}>
              فلتر العمر يستخدم حدود المثال المعلنة داخل المنتج ويعمل على المراجعات الموثقة فقط؛
              هو ليس تصنيفًا عمريًا رسميًا، والمساواة مع الحد قد تعني أن المشاهدة تحتاج مرافقة.
              {filters.age !== null ? ` الحد المختار الآن: ${AGE_LABELS[filters.age]}.` : ""}
            </p>

            {filteredResults.length === 0 ? (
              <EmptyState
                title="لا توجد نتائج بهذه الفلاتر"
                text={
                  filters.age !== null
                    ? "فلتر العمر لا يخمّن الأعمال غير الموثقة. جرّب عمرًا آخر، أو أزل فلتر العمر لرؤية النتائج التي لا يمكن تقييمها بعد."
                    : "جرّب تغيير النوع أو حالة التحقق، أو امسح الفلاتر للعودة لكل المطابقات."
                }
              />
            ) : (
              <div className={styles.grid}>
                {filteredResults.map((result) => {
                  const availability = classifyPublicSearchAvailability(result);
                  const copy = AVAILABILITY_COPY[availability];
                  return (
                    <article className={styles.card} key={result.id}>
                      <div className={styles.cardTop}>
                        <span className={`${styles.status} ${styles[`status_${availability}`]}`}>{copy.label}</span>
                        <span className={styles.year}>{result.releaseYear}</span>
                      </div>
                      <h3>{result.canonicalName}</h3>
                      {result.originalName && result.originalName !== result.canonicalName ? (
                        <p className={styles.original} dir="auto">{result.originalName}</p>
                      ) : null}
                      <div className={styles.meta}>
                        <span>{KIND_LABELS[result.kind]}</span>
                        <span aria-hidden="true">•</span>
                        <span>{copy.description}</span>
                        {availability === "verified" && result.verifiedBundleId ? (
                          <>
                            <span aria-hidden="true">•</span>
                            <Link className={styles.back} href={buildPublicReviewHref(result.verifiedBundleId)}>
                              فتح المراجعة الموثقة <span aria-hidden="true">←</span>
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className={styles.empty}>
      <span aria-hidden="true">⌕</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
