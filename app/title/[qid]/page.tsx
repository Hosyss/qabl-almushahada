import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPublicCatalogTitle } from "@/db/public-catalog-service";
import {
  buildPublicCatalogCanonicalUrl,
  buildPublicCatalogDescription,
  parsePublicCatalogQid,
} from "@/lib/public-catalog";
import { buildPublicEditorialReviewHref } from "@/lib/editorial-review";
import { getEditorialReviewPublicationForTitleId } from "@/lib/editorial-review-registry";

import styles from "../catalog.module.css";

export const dynamic = "force-dynamic";

type CatalogTitlePageProps = {
  params: Promise<{ qid: string }>;
};

export async function generateMetadata({ params }: CatalogTitlePageProps): Promise<Metadata> {
  const { qid: rawQid } = await params;
  let qid: string;
  try {
    qid = parsePublicCatalogQid(rawQid);
  } catch {
    return { title: "عنوان غير متاح | قبل المشاهدة", robots: { index: false, follow: false } };
  }

  try {
    const title = await loadPublicCatalogTitle(qid);
    if (!title) {
      return { title: "عنوان غير متاح | قبل المشاهدة", robots: { index: false, follow: false } };
    }
    return {
      title: `${title.canonicalName} (${title.releaseYear}) | قبل المشاهدة`,
      description: buildPublicCatalogDescription(title),
      alternates: { canonical: buildPublicCatalogCanonicalUrl(qid) },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: "عنوان غير متاح | قبل المشاهدة", robots: { index: false, follow: false } };
  }
}

export default async function CatalogTitlePage({ params }: CatalogTitlePageProps) {
  const { qid: rawQid } = await params;
  let qid: string;
  try {
    qid = parsePublicCatalogQid(rawQid);
  } catch {
    notFound();
  }

  let title: Awaited<ReturnType<typeof loadPublicCatalogTitle>>;
  try {
    title = await loadPublicCatalogTitle(qid);
  } catch {
    title = null;
  }
  if (!title) notFound();

  const editorialReview = getEditorialReviewPublicationForTitleId(title.titleId);
  const kindLabel = title.kind === "movie" ? "فيلم" : "مسلسل";
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": title.kind === "movie" ? "Movie" : "TVSeries",
    name: title.canonicalName,
    datePublished: String(title.releaseYear),
    sameAs: title.sourceUrl,
    url: buildPublicCatalogCanonicalUrl(title.qid),
  }).replaceAll("<", "\\u003c");

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">قبل المشاهدة</Link>
          <Link className={styles.back} href="/titles">كل عناوين الدليل</Link>
        </header>

        <article className={styles.detailCard}>
          <span className={styles.kicker}>صفحة كتالوج — بيانات تعريفية فقط</span>
          <h1>{title.canonicalName}</h1>
          {title.originalName && title.originalName !== title.canonicalName ? (
            <p dir="auto">{title.originalName}</p>
          ) : null}

          <div className={styles.meta}>
            <span>{kindLabel}</span>
            <span>{title.releaseYear}</span>
            <span>{title.qid}</span>
          </div>

          <p>
            وجود هذا العمل في الدليل لا يعني وجود حكم ملاءمة منشور. هذه الصفحة تعرض metadata قانونية قابلة للتتبع فقط،
            وأي تحليل محتوى أو حكم يبقى مسارًا منفصلًا له بوابات تحقق خاصة به.
          </p>

          <div className={styles.sourceBox}>
            <dl>
              <dt>المصدر</dt>
              <dd><a href={title.sourceUrl} rel="noreferrer">Wikidata — {title.qid}</a></dd>
              <dt>الرخصة</dt>
              <dd>{title.sourceLicense}</dd>
              <dt>نسخة سياسة المصدر</dt>
              <dd>{title.policyVersion}</dd>
              <dt>آخر جلب مسجل</dt>
              <dd>{new Date(title.retrievedAt).toLocaleDateString("ar-EG", { timeZone: "UTC" })}</dd>
            </dl>
          </div>
        </article>

        <section className={styles.notice}>
          <h2>{editorialReview ? "يوجد تحليل تحريري جزئي لهذا العمل" : "هل توجد مراجعة لهذا العمل؟"}</h2>
          <p>
            {editorialReview
              ? "نشرنا الوقائع التي استطعنا تثبيتها من مصادر مستقلة، لكن قرار الملاءمة ما زال «البيانات غير كافية» لأن بعض المحاور غير محسومة."
              : "ابحث عنه في محرك الدليل. صفحة البحث تفرّق بوضوح بين وجود العنوان وبين وجود حكم مراجعة مكتمل."}
          </p>
          {editorialReview ? (
            <Link className={styles.cardLink} href={buildPublicEditorialReviewHref(editorialReview.id)}>
              افتح التحليل التحريري ←
            </Link>
          ) : (
            <Link className={styles.cardLink} href={`/search?q=${encodeURIComponent(title.canonicalName)}`}>
              ابحث عن حالة المراجعة ←
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
