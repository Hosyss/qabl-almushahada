import Link from "next/link";

import { searchPublicTitles } from "@/db/public-title-search-service";
import { classifyPublicSearchAvailability } from "@/lib/public-search-result-state";
import type { PublicTitleKind, PublicTitleSearchResult } from "@/lib/public-title-search";

import styles from "./search.module.css";

const KIND_LABELS: Record<PublicTitleKind, string> = {
  movie: "فيلم",
  series: "مسلسل",
  episode: "حلقة",
  special: "عمل خاص",
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
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

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
                <h2>{results.length} {results.length === 1 ? "نتيجة" : "نتائج"} لـ «{query}»</h2>
              </div>
              <small>نرتب المطابقة النصية أولًا، وليس شعبية العمل.</small>
            </div>
            <div className={styles.grid}>
              {results.map((result) => {
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
                    </div>
                  </article>
                );
              })}
            </div>
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
