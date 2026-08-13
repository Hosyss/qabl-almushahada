import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCatalogDirectory, type PublicCatalogDirectoryEditorialStatus, type PublicCatalogDirectoryReviewStatus } from "@/db/public-catalog-service";
import { buildPublicCatalogTitleHref, PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { getPublicTitleDisplayNames } from "@/lib/public-title-search";
import styles from "../title/catalog.module.css";
import { EditorialFilter } from "./editorial-filter";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "دليل الأفلام والمسلسلات | قبل المشاهدة",
  description: "دليل للعناوين مع بحث حسب الاسم والنوع والسنة، وحالة التحليل التحريري أو المراجعة الموثقة الحالية عندما تكون متاحة.",
  alternates: { canonical: `${PUBLIC_SITE_ORIGIN}/titles` },
};

type Params = { q?: string | string[]; kind?: string | string[]; year?: string | string[]; reviewStatus?: string | string[]; editorialStatus?: string | string[]; page?: string | string[] };
type Props = { searchParams: Promise<Params> };

export default async function TitlesPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = one(params.q).trim().slice(0, 80);
  const kind = parseKind(one(params.kind));
  const year = parseYear(one(params.year));
  const reviewStatus = parseReviewStatus(one(params.reviewStatus));
  const editorialStatus = parseEditorialStatus(one(params.editorialStatus));
  const page = parsePage(one(params.page));
  let data: Awaited<ReturnType<typeof listPublicCatalogDirectory>> | null = null;
  try { data = await listPublicCatalogDirectory({ query, kind, year, reviewStatus, editorialStatus, page, pageSize: 24 }); } catch { data = null; }

  return (
    <main className={styles.page}><div className={styles.shell}>
      <header className={styles.header}><Link className={styles.brand} href="/">قبل المشاهدة</Link><Link className={styles.back} href="/search">البحث الذكي</Link></header>
      <section className={styles.hero}>
        <span className={styles.kicker}>دليل العناوين</span>
        <h1>دليل الأفلام والمسلسلات</h1>
        <p>ابحث بالاسم، وحدد النوع أو السنة عند الحاجة. التحليل التحريري والمراجعة الموثقة حالتان مستقلتان، ووجود العمل في الدليل لا يعني أن له حكم ملاءمة مكتملًا.</p>
      </section>
      <form className={styles.directoryFilters} action="/titles" method="get" aria-label="بحث وفلاتر دليل العناوين">
        <label className={styles.directorySearch}><span>ابحث</span><input type="search" name="q" defaultValue={query} maxLength={80} placeholder="العربي أو الإنجليزي" /></label>
        <label><span>النوع</span><select name="kind" defaultValue={kind}><option value="all">كل الأنواع</option><option value="movie">فيلم</option><option value="series">مسلسل</option></select></label>
        <label><span>السنة</span><input type="number" name="year" min="1880" max="2200" defaultValue={year ?? ""} /></label>
        <EditorialFilter value={editorialStatus} />
        <label><span>المراجعة الموثقة</span><select name="reviewStatus" defaultValue={reviewStatus}><option value="all">كل الحالات</option><option value="verified">توجد مراجعة موثقة حالية</option><option value="not_verified">لا توجد مراجعة موثقة حالية</option></select></label>
        <div className={styles.directoryActions}><button type="submit">تطبيق</button><Link href="/titles">مسح الفلاتر</Link></div>
      </form>
      {!data ? <section className={`${styles.notice} ${styles.empty}`}><h2>الدليل غير متاح مؤقتًا</h2><p>تعذّر تحميل العناوين الآن، ولم نستبدلها ببيانات تجريبية.</p></section> : data.items.length === 0 ? <section className={`${styles.notice} ${styles.empty}`}><h2>لا توجد نتائج</h2><p>غيّر البحث أو الفلاتر.</p></section> : <>
        <div className={styles.directorySummary}><strong>{data.total} عنوانًا</strong><span>صفحة {data.page} من {data.totalPages}</span></div>
        <section className={styles.grid} aria-label="عناوين الدليل">{data.items.map((title) => {
          const href = buildPublicCatalogTitleHref(title.titleId); if (!href) return null;
          const names = getPublicTitleDisplayNames({ canonicalName: title.canonicalName, originalName: title.originalName });
          return <article className={styles.card} key={title.titleId}>
            <div className={styles.cardStateLine}><span className={`${styles.badge} ${title.hasVerifiedReview ? styles.state_verified : styles.state_catalog}`}>{title.hasVerifiedReview ? "مراجعة موثقة حالية" : "كتالوج فقط"}</span>{title.hasEditorialReview ? <span className={styles.badge}>تحليل تحريري</span> : null}<span>{title.kind === "movie" ? "فيلم" : "مسلسل"}</span></div>
            <h2>{names.arabicName}</h2><p className={styles.originalTitle} dir="ltr">{names.englishName}</p>
            <div className={styles.meta}><span>السنة: {title.releaseYear}</span><span>{title.qid}</span></div>
            <Link className={styles.cardLink} href={href}>فتح صفحة العمل ←</Link>
          </article>;
        })}</section>
        <nav className={styles.pagination} aria-label="صفحات دليل العناوين">
          {data.page > 1 ? <Link rel="prev" href={pageHref(params, data.page - 1)}>السابق</Link> : <span aria-disabled="true">السابق</span>}
          <strong>{data.page} / {data.totalPages}</strong>
          {data.page < data.totalPages ? <Link rel="next" href={pageHref(params, data.page + 1)}>التالي</Link> : <span aria-disabled="true">التالي</span>}
        </nav>
      </>}
    </div></main>
  );
}

function one(value: string | string[] | undefined) { return typeof value === "string" ? value : ""; }
function parseKind(value: string): "all" | "movie" | "series" { return value === "movie" || value === "series" ? value : "all"; }
function parseReviewStatus(value: string): PublicCatalogDirectoryReviewStatus { return value === "verified" || value === "not_verified" ? value : "all"; }
function parseEditorialStatus(value: string): PublicCatalogDirectoryEditorialStatus { return value === "editorial" || value === "no_editorial" ? value : "all"; }
function parseYear(value: string) { if (!/^\d{4}$/u.test(value)) return null; const year = Number(value); return year >= 1880 && year <= 2200 ? year : null; }
function parsePage(value: string) { if (!/^\d{1,3}$/u.test(value)) return 1; const page = Number(value); return page >= 1 && page <= 1000 ? page : 1; }
function pageHref(params: Params, page: number) {
  const search = new URLSearchParams(); const q = one(params.q).trim().slice(0, 80); const kind = parseKind(one(params.kind)); const year = parseYear(one(params.year)); const reviewStatus = parseReviewStatus(one(params.reviewStatus)); const editorialStatus = parseEditorialStatus(one(params.editorialStatus));
  if (q) search.set("q", q); if (kind !== "all") search.set("kind", kind); if (year !== null) search.set("year", String(year)); if (editorialStatus !== "all") search.set("editorialStatus", editorialStatus); if (reviewStatus !== "all") search.set("reviewStatus", reviewStatus); if (page > 1) search.set("page", String(page));
  return search.size ? `/titles?${search}` : "/titles";
}
