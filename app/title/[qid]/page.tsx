import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPublicCatalogTitle } from "@/db/public-catalog-service";
import {
  buildPublicCatalogCanonicalUrl,
  buildPublicCatalogDescription,
  parsePublicCatalogQid,
} from "@/lib/public-catalog";

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
            وجود هذا العمل في الدليل لا يعني وجود مراجعة ملاءمة منشورة. هذه الصفحة تعرض metadata قانونية قابلة للتتبع فقط،
            وأي مراجعة محتوى تبقى مسارًا منفصلًا له بوابات تحقق خاصة به.
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
          <h2>هل توجد مراجعة لهذا العمل؟</h2>
          <p>
            ابحث عنه في محرك الدليل. صفحة البحث تفرّق بوضوح بين «موجود في الدليل»، «قيد المراجعة»، و«مراجعة موثقة».
          </p>
          <Link className={styles.cardLink} href={`/search?q=${encodeURIComponent(title.canonicalName)}`}>
            ابحث عن حالة المراجعة ←
          </Link>
        </section>
      </div>
    </main>
  );
}
