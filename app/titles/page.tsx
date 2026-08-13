import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCatalogDirectory, type PublicCatalogDirectoryStatus } from "@/db/public-catalog-service";
import { getEditorialPublicationPresentation } from "@/lib/editorial-publication-presentation";
import { listEditorialReviewPublications } from "@/lib/editorial-review-registry";
import { buildPublicCatalogTitleHref, PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { getPublicTitleDisplayNames } from "@/lib/public-title-search";

import styles from "../title/catalog.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "دليل الأفلام والمسلسلات | قبل المشاهدة",
  description: "دليل عناوين حقيقي من Wikidata مع بحث وفلاتر وحالة واضحة: كتالوج فقط، تحليل تحريري جزئي، أو مراجعة موثقة مستقبلًا.",
  alternates: { canonical: `${PUBLIC_SITE_ORIGIN}/titles` },
};

type TitlesPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    kind?: string | string[];
    year?: string | string[];
    status?: string | string[];
    editorial?: string | string[];
    page?: string | string[];
  }>;
};

export default async function TitlesPage({ searchParams }: TitlesPageProps) {
  const params = await searchParams;
  const query = single(params.q).trim().slice(0, 80);
  const kind = parseKind(single(params.kind));
  const year = parseYear(single(params.year));
  const status = parseStatus(single(params.status));
  const editorialOnly = single(params.editorial) === "1";
  const page = parsePage(single(params.page));

  const editorialReviews = listEditorialReviewPublications();
  const editorialByTitleId = new Map(editorialReviews.map((review) => [review.titleId, review]));
  let directory = null as Awaited<ReturnType<typeof listPublicCatalogDirectory>> | null;
  let unavailable = false;

  try {
    directory = await listPublicCatalogDirectory({
      query,
      kind,
      year,
      status,
      editorialOnly,
      page,
      pageSize: 24,
      editorialTitleIds: editorialReviews.map((review) => review.titleId),
    });
  } catch {
    unavailable = true;
  }

  const currentPage = directory?.page ?? page;
  const totalPages = directory?.totalPages ?? 1;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">قبل المشاهدة</Link>
          <Link className={styles.back} href="/search">البحث الذكي</Link>
        </header>

        <section className={styles.hero}>
          <span className={styles.kicker}>دليل عناوين من مصدر مرخّص</span>
          <h1>دليل الأفلام والمسلسلات</h1>
          <p>
            وجود العمل هنا يثبت وجوده في الكتالوج فقط. الحالة على كل بطاقة توضح هل لدينا تحليل تحريري جزئي،
            أو مراجعة موثقة لنسخة محددة مستقبلًا، أو metadata فقط.
          </p>
        </section>

        <form className={styles.directoryFilters} action="/titles" method="get" aria-label="بحث وفلاتر دليل العناوين">
          <label className={styles.directorySearch}>
            <span>ابحث في العنوان</span>
            <input type="search" name="q" defaultValue={query} maxLength={80} placeholder="العربي أو الإنجليزي أو اسم بديل" />
          </label>
          <label>
            <span>النوع</span>
            <select name="kind" defaultValue={kind}>
              <option value="all">كل الأنواع</option>
              <option value="movie">فيلم</option>
              <option value="series">مسلسل</option>
            </select>
          </label>
          <label>
            <span>السنة</span>
            <input type="number" name="year" min="1880" max="2200" defaultValue={year ?? ""} placeholder="مثال: 2001" />
          </label>
          <label>
            <span>الحالة</span>
            <select name="status" defaultValue={status}>
              <option value="all">كل الحالات</option>
              <option value="catalog_only">كتالوج فقط</option>
              <option value="editorial">تحليل تحريري جزئي</option>
              <option value="verified">مراجعة موثقة</option>
            </select>
          </label>
          <label className={styles.directoryCheckbox}>
            <input type="checkbox" name="editorial" value="1" defaultChecked={editorialOnly} />
            <span>له تحليل تحريري</span>
          </label>
          <div className={styles.directoryActions}>
            <button type="submit">تطبيق</button>
            <Link href="/titles">مسح الفلاتر</Link>
          </div>
        </form>

        {unavailable || !directory ? (
          <section className={`${styles.notice} ${styles.empty}`}>
            <h2>الدليل غير متاح مؤقتًا</h2>
            <p>تعذّر تحميل نتائج D1 الآن. لم نستبدلها بعناوين تجريبية.</p>
          </section>
        ) : directory.items.length === 0 ? (
          <section className={`${styles.notice} ${styles.empty}`}>
            <h2>لا توجد نتائج بهذه الفلاتر</h2>
            <p>غيّر البحث أو الفلاتر. لن نخترع عنوانًا غير موجود في D1.</p>
          </section>
        ) : (
          <>
            <div className={styles.directorySummary} aria-live="polite">
              <strong>{directory.total} عنوانًا</strong>
              <span>صفحة {currentPage} من {totalPages}</span>
            </div>
            <section className={styles.grid} aria-label="عناوين الكتالوج">
              {directory.items.map((title) => {
                const href = buildPublicCatalogTitleHref(title.titleId);
                if (!href) return null;
                const editorial = editorialByTitleId.get(title.titleId);
                const presentation = editorial ? getEditorialPublicationPresentation(editorial) : null;
                const names = presentation ?? getPublicTitleDisplayNames({ canonicalName: title.canonicalName, originalName: title.originalName });
                const arabicName = presentation?.titleAr ?? ("arabicName" in names ? names.arabicName : title.canonicalName);
                const englishName = presentation?.titleEn ?? ("englishName" in names ? names.englishName : title.originalName ?? title.canonicalName);
                const state = title.hasVerifiedReview ? "verified" : title.hasEditorialReview ? "editorial" : "catalog";
                return (
                  <article className={styles.card} key={title.titleId}>
                    <div className={styles.cardStateLine}>
                      <span className={`${styles.badge} ${styles[`state_${state}`]}`}>{stateLabel(state)}</span>
                      <span>{title.kind === "movie" ? "فيلم" : "مسلسل"}</span>
                    </div>
                    <h2>{arabicName}</h2>
                    <p className={styles.originalTitle} dir="ltr">{englishName}</p>
                    <div className={styles.meta}>
                      <span>السنة: {title.releaseYear}</span>
                      <span>{title.qid}</span>
                    </div>
                    <Link className={styles.cardLink} href={href}>فتح صفحة العمل ←</Link>
                  </article>
                );
              })}
            </section>

            <nav className={styles.pagination} aria-label="صفحات دليل العناوين">
              {currentPage > 1 ? <Link rel="prev" href={buildDirectoryHref(params, currentPage - 1)}>السابق</Link> : <span aria-disabled="true">السابق</span>}
              <strong>{currentPage} / {totalPages}</strong>
              {currentPage < totalPages ? <Link rel="next" href={buildDirectoryHref(params, currentPage + 1)}>التالي</Link> : <span aria-disabled="true">التالي</span>}
            </nav>
          </>
        )}
      </div>
    </main>
  );
}

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function parseKind(value: string): "all" | "movie" | "series" {
  return value === "movie" || value === "series" ? value : "all";
}

function parseStatus(value: string): PublicCatalogDirectoryStatus {
  return value === "catalog_only" || value === "editorial" || value === "verified" ? value : "all";
}

function parseYear(value: string): number | null {
  if (!/^\d{4}$/u.test(value)) return null;
  const year = Number(value);
  return year >= 1880 && year <= 2200 ? year : null;
}

function parsePage(value: string): number {
  if (!/^\d{1,3}$/u.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= 1000 ? page : 1;
}

function stateLabel(state: "catalog" | "editorial" | "verified") {
  if (state === "verified") return "مراجعة موثقة";
  if (state === "editorial") return "تحليل تحريري جزئي — الحكم غير مكتمل";
  return "كتالوج فقط";
}

function buildDirectoryHref(
  params: Awaited<TitlesPageProps["searchParams"]>,
  page: number,
): string {
  const next = new URLSearchParams();
  const query = single(params.q).trim().slice(0, 80);
  const kind = parseKind(single(params.kind));
  const year = parseYear(single(params.year));
  const status = parseStatus(single(params.status));
  if (query) next.set("q", query);
  if (kind !== "all") next.set("kind", kind);
  if (year !== null) next.set("year", String(year));
  if (status !== "all") next.set("status", status);
  if (single(params.editorial) === "1") next.set("editorial", "1");
  if (page > 1) next.set("page", String(page));
  const suffix = next.toString();
  return suffix ? `/titles?${suffix}` : "/titles";
}
