import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { loadPublicCatalogTitle } from "@/db/public-catalog-service";
import { buildPublicEditorialReviewHref } from "@/lib/editorial-review";
import { loadEditorialPublicationForTitleId } from "@/lib/public-editorial-read";
import { buildPublicCatalogCanonicalUrl, buildPublicCatalogDescription, parsePublicCatalogQid, PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { getPublicTitleDisplayNames } from "@/lib/public-title-search";
import { getTitleArtwork, TITLE_ARTWORK_DISCLOSURE_AR } from "@/lib/title-artwork";
import styles from "../catalog.module.css";
import TitleArtwork from "../../title-artwork";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ qid: string }> };
const UNAVAILABLE = "عنوان غير متاح | قبل المشاهدة";

async function resolveNames(title: NonNullable<Awaited<ReturnType<typeof loadPublicCatalogTitle>>>) {
  const persisted = await loadEditorialPublicationForTitleId(title.titleId);
  if (persisted) return { arabicName: persisted.presentation.titleAr, englishName: persisted.presentation.titleEn, editorial: persisted.review };
  return { ...getPublicTitleDisplayNames({ canonicalName: title.canonicalName, originalName: title.originalName }), editorial: null };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  let qid: string;
  try { qid = parsePublicCatalogQid((await params).qid); } catch { return { title: UNAVAILABLE, robots: { index: false, follow: false } }; }
  try {
    const title = await loadPublicCatalogTitle(qid);
    if (!title) return { title: UNAVAILABLE, robots: { index: false, follow: false } };
    const names = await resolveNames(title);
    const artwork = getTitleArtwork(title.titleId);
    return {
      title: `${names.arabicName} - ${names.englishName} (${title.releaseYear}) | قبل المشاهدة`,
      description: buildPublicCatalogDescription(title),
      alternates: { canonical: buildPublicCatalogCanonicalUrl(qid) },
      robots: { index: Boolean(names.editorial), follow: true },
      openGraph: artwork ? { images: [{ url: artwork.src, width: 720, height: 960, alt: artwork.altAr }] } : undefined,
    };
  } catch { return { title: UNAVAILABLE, robots: { index: false, follow: false } }; }
}

export default async function CatalogTitlePage({ params }: Props) {
  let qid: string;
  try { qid = parsePublicCatalogQid((await params).qid); } catch { notFound(); }
  let title: Awaited<ReturnType<typeof loadPublicCatalogTitle>>;
  try { title = await loadPublicCatalogTitle(qid); } catch { title = null; }
  if (!title) notFound();
  const names = await resolveNames(title);
  const editorial = names.editorial;
  const artwork = getTitleArtwork(title.titleId);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": title.kind === "movie" ? "Movie" : "TVSeries",
    name: names.arabicName,
    alternateName: names.englishName,
    datePublished: String(title.releaseYear),
    sameAs: title.sourceUrl,
    url: buildPublicCatalogCanonicalUrl(title.qid),
    image: artwork ? `${PUBLIC_SITE_ORIGIN}${artwork.src}` : undefined,
  }).replaceAll("<", "\\u003c");

  return (
    <main className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <div className={styles.shell}>
        <header className={styles.header}><Link className={styles.brand} href="/">قبل المشاهدة</Link><Link className={styles.back} href="/titles">كل عناوين الدليل</Link></header>
        <article className={styles.detailCard}>
          <div className={styles.detailLead}>
            <div>
              <span className={styles.kicker}>صفحة العمل</span>
              <h1>{names.arabicName}</h1><p className={styles.originalTitle} dir="ltr">{names.englishName}</p>
              <div className={styles.meta}><span>{title.kind === "movie" ? "فيلم" : "مسلسل"}</span><span>{title.releaseYear}</span><span>{title.qid}</span></div>
              <p>وجود العمل في الدليل لا يعني وجود حكم ملاءمة مكتمل. الاسم العربي والإنجليزي والسنة مرتبطون بنفس سجل D1، وأي تحليل أو قرار أسري يبقى مسارًا منفصلًا ببوابات تحقق خاصة به.</p>
            </div>
            {artwork ? <div><TitleArtwork titleId={title.titleId} className={styles.detailArtwork} sizes="230px" priority showDisclosure /><p className={styles.detailArtworkNote}>{TITLE_ARTWORK_DISCLOSURE_AR}</p></div> : null}
          </div>
          <div className={styles.sourceBox}><dl>
            <dt>المصدر</dt><dd><a href={title.sourceUrl} rel="noreferrer">Wikidata - {title.qid}</a></dd>
            <dt>الرخصة</dt><dd>{title.sourceLicense}</dd><dt>نسخة سياسة المصدر</dt><dd>{title.policyVersion}</dd>
            <dt>آخر جلب مسجل</dt><dd>{new Date(title.retrievedAt).toLocaleDateString("ar-EG", { timeZone: "UTC" })}</dd>
          </dl></div>
        </article>
        <section className={styles.notice}>
          <h2>{editorial ? "يوجد تحليل تحريري جزئي لهذا العمل" : "هل توجد مراجعة لهذا العمل؟"}</h2>
          <p>{editorial ? "نشرنا الوقائع التي استطعنا تثبيتها، لكن المعلومات غير كافية لإصدار حكم نهائي لأن بعض المحاور ما زالت غير محسومة." : "صفحة البحث تفرّق بوضوح بين وجود العنوان وبين وجود حكم مراجعة مكتمل."}</p>
          {editorial ? <Link className={styles.cardLink} href={buildPublicEditorialReviewHref(editorial.id)}>افتح التحليل التحريري <span aria-hidden="true">←</span></Link> : <Link className={styles.cardLink} href={`/search?q=${encodeURIComponent(names.arabicName)}`}>ابحث عن حالة المراجعة <span aria-hidden="true">←</span></Link>}
        </section>
      </div>
    </main>
  );
}
