import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPublicCatalogTitle } from "@/db/public-catalog-service";
import { getEditorialPublicationPresentation } from "@/lib/editorial-publication-presentation";
import { buildPublicCatalogCanonicalUrl, buildPublicCatalogDescription, parsePublicCatalogQid } from "@/lib/public-catalog";
import { buildPublicEditorialReviewHref } from "@/lib/editorial-review";
import { getEditorialReviewPublicationForTitleId } from "@/lib/editorial-review-registry";
import { getPublicTitleDisplayNames } from "@/lib/public-title-search";
import styles from "../catalog.module.css";

export const dynamic = "force-dynamic";
type CatalogTitlePageProps = { params: Promise<{ qid: string }> };

function displayNames(title: NonNullable<Awaited<ReturnType<typeof loadPublicCatalogTitle>>>) {
  const editorial = getEditorialReviewPublicationForTitleId(title.titleId);
  if (editorial) {
    const presentation = getEditorialPublicationPresentation(editorial);
    return { arabicName: presentation.titleAr, englishName: presentation.titleEn, editorial };
  }
  const names = getPublicTitleDisplayNames({ canonicalName: title.canonicalName, originalName: title.originalName });
  return { ...names, editorial: null };
}

export async function generateMetadata({ params }: CatalogTitlePageProps): Promise<Metadata> {
  const { qid: rawQid } = await params;
  let qid: string;
  try { qid = parsePublicCatalogQid(rawQid); }
  catch { return { title: "عنوان غير متاح | قبل المشاهدة", robots: { index: false, follow: false } }; }
  try {
    const title = await loadPublicCatalogTitle(qid);
    if (!title) return { title: "عنوان غير متاح | قبل المشاهدة", robots: { index: false, follow: false } };
    const names = displayNames(title);
    return {
      title: `${names.arabicName} — ${names.englishName} (${title.releaseYear}) | قبل المشاهدة`,
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
  try { qid = parsePublicCatalogQid(rawQid); } catch { notFound(); }
  let title: Awaited<ReturnType<typeof loadPublicCatalogTitle>>;
  try { title = await loadPublicCatalogTitle(qid); } catch { title = null; }
  if (!title) notFound();

  const names = displayNames(title);
  const editorialReview = names.editorial;
  const kindLabel = title.kind === "movie" ? "فيلم" : "مسلسل";
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": title.kind === "movie" ? "Movie" : "TVSeries",
    name: names.arabicName,
    alternateName: names.englishName,
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
          <span className={styles.kicker}>صفحة العمل</span>
          <h1>{names.arabicName}</h1>
          <p className={styles.originalTitle} dir="ltr">{names.englishName}</p>
          <div className={styles.meta}>
            <span>{kindLabel}</span><span>{title.releaseYear}</span><span>{title.qid}</span>
          </div>
          <p>
            وجود العمل في الدليل لا يعني وجود حكم ملاءمة مكتمل. الاسم العربي والاسم الإنجليزي والسنة مرتبطون بنفس سجل D1،
            وأي تحليل محتوى أو قرار أسري يبقى مسارًا منفصلًا له بوابات تحقق خاصة به.
          </p>
          <div className={styles.sourceBox}>
            <dl>
              <dt>المصدر</dt><dd><a href={title.sourceUrl} rel="noreferrer">Wikidata — {title.qid}</a></dd>
              <dt>الرخصة</dt><dd>{title.sourceLicense}</dd>
              <dt>نسخة سياسة المصدر</dt><dd>{title.policyVersion}</dd>
              <dt>آخر جلب مسجل</dt><dd>{new Date(title.retrievedAt).toLocaleDateString("ar-EG", { timeZone: "UTC" })}</dd>
            </dl>
          </div>
        </article>
        <section className={styles.notice}>
          <h2>{editorialReview ? "يوجد تحليل تحريري جزئي لهذا العمل" : "هل توجد مراجعة لهذا العمل؟"}</h2>
          <p>{editorialReview
            ? "نشرنا الوقائع التي استطعنا فقط لكن العملاومات مازلت غير محسومة."
            : "محرك البحث تفصل بوضوح بين وجود العنوان وبين وجود حكم مراجعة لكتمل."}</p>
          {editorialReview ? (
            <Link className={styles.cardLink} href={buildPublicEditorialReviewHref(editorialReview.id)}>افتح التجليل التجريري ء��[�ς�
H�
�[���\�Ә[YO^��[\˘�\�[��H�Y�^���X\���OI�[���UT�P��\ۙ[�
�[Y\˘\�X�XӘ[YJ_XO�)�*6+v*�6.va�6+v)�a6*H6)�a6av,v)�+6.v*H8���[�ς�
_B���X�[ۏ���]����XZ[���
NB