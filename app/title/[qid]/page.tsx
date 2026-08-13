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

const COPY = {
  unavailable: "\u0639\u0646\u0648\u0627\u0646 \u063a\u064a\u0631 \u0645\u062a\u0627\u062d | \u0642\u0628\u0644 \u0627\u0644\u0645\u0634\u0627\u0647\u062f\u0629",
  brand: "\u0642\u0628\u0644 \u0627\u0644\u0645\u0634\u0627\u0647\u062f\u0629",
  allTitles: "\u0643\u0644 \u0639\u0646\u0627\u0648\u064a\u0646 \u0627\u0644\u062f\u0644\u064a\u0644",
  kicker: "\u0635\u0641\u062d\u0629 \u0627\u0644\u0639\u0645\u0644",
  movie: "\u0641\u064a\u0644\u0645",
  series: "\u0645\u0633\u0644\u0633\u0644",
  intro: "\u0648\u062c\u0648\u062f \u0627\u0644\u0639\u0645\u0644 \u0641\u064a \u0627\u0644\u062f\u0644\u064a\u0644 \u0644\u0627 \u064a\u0639\u0646\u064a \u0648\u062c\u0648\u062f \u062d\u0643\u0645 \u0645\u0644\u0627\u0621\u0645\u0629 \u0645\u0643\u062a\u0645\u0644. \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0639\u0631\u0628\u064a \u0648\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0625\u0646\u062c\u0644\u064a\u0632\u064a \u0648\u0627\u0644\u0633\u0646\u0629 \u0645\u0631\u062a\u0628\u0637\u0648\u0646 \u0628\u0646\u0641\u0633 \u0633\u062c\u0644 D1\u060c \u0648\u0623\u064a \u062a\u062d\u0644\u064a\u0644 \u0645\u062d\u062a\u0648\u0649 \u0623\u0648 \u0642\u0631\u0627\u0631 \u0623\u0633\u0631\u064a \u064a\u0628\u0642\u0649 \u0645\u0633\u0627\u0631\u064b\u0627 \u0645\u0646\u0641\u0635\u0644\u064b\u0627 \u0644\u0647 \u0628\u0648\u0627\u0628\u0627\u062a \u062a\u062d\u0642\u0642 \u062e\u0627\u0635\u0629 \u0628\u0647.",
  source: "\u0627\u0644\u0645\u0635\u062f\u0631",
  license: "\u0627\u0644\u0631\u062e\u0635\u0629",
  policy: "\u0646\u0633\u062e\u0629 \u0633\u064a\u0627\u0633\u0629 \u0627\u0644\u0645\u0635\u062f\u0631",
  retrieved: "\u0622\u062e\u0631 \u062c\u0644\u0628 \u0645\u0633\u062c\u0644",
  hasEditorial: "\u064a\u0648\u062c\u062f \u062a\u062d\u0644\u064a\u0644 \u062a\u062d\u0631\u064a\u0631\u064a \u062c\u0632\u0626\u064a \u0644\u0647\u0630\u0627 \u0627\u0644\u0639\u0645\u0644",
  hasReview: "\u0647\u0644 \u062a\u0648\u062c\u062f \u0645\u0631\u0627\u062c\u0639\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0639\u0645\u0644\u061f",
  editorialCopy: "\u0646\u0634\u0631\u0646\u0627 \u0627\u0644\u0648\u0642\u0627\u0626\u0639 \u0627\u0644\u062a\u064a \u0627\u0633\u062a\u0637\u0639\u0646\u0627 \u062a\u062b\u0628\u064a\u062a\u0647\u0627\u060c \u0644\u0643\u0646 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u063a\u064a\u0631 \u0643\u0627\u0641\u064a\u0629 \u0644\u0625\u0635\u062f\u0627\u0631 \u062d\u0643\u0645 \u0646\u0647\u0627\u0626\u064a \u0644\u0623\u0646 \u0628\u0639\u0636 \u0627\u0644\u0645\u062d\u0627\u0648\u0631 \u0645\u0627 \u0632\u0627\u0644\u062a \u063a\u064a\u0631 \u0645\u062d\u0633\u0648\u0645\u0629.",
  noEditorialCopy: "\u0635\u0641\u062d\u0629 \u0627\u0644\u0628\u062d\u062b \u062a\u0641\u0631\u0651\u0642 \u0628\u0648\u0636\u0648\u062d \u0628\u064a\u0646 \u0648\u062c\u0648\u062f \u0627\u0644\u0639\u0646\u0648\u0627\u0646 \u0648\u0628\u064a\u0646 \u0648\u062c\u0648\u062f \u062d\u0643\u0645 \u0645\u0631\u0627\u062c\u0639\u0629 \u0645\u0643\u062a\u0645\u0644.",
  openEditorial: "\u0627\u0641\u062a\u062d \u0627\u0644\u062a\u062d\u0644\u064a\u0644 \u0627\u0644\u062a\u062d\u0631\u064a\u0631\u064a",
  searchReview: "\u0627\u0628\u062d\u062b \u0639\u0646 \u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629",
} as const;

function displayNames(title: NonNullable<Awaited<ReturnType<typeof loadPublicCatalogTitle>>>) {
  const editorial = getEditorialReviewPublicationForTitleId(title.titleId);
  if (editorial) {
    const presentation = getEditorialPublicationPresentation(editorial);
    return { arabicName: presentation.titleAr, englishName: presentation.titleEn, editorial };
  }
  const names = getPublicTitleDisplayNames({
    canonicalName: title.canonicalName,
    originalName: title.originalName,
  });
  return { ...names, editorial: null };
}

export async function generateMetadata({ params }: CatalogTitlePageProps): Promise<Metadata> {
  const { qid: rawQid } = await params;
  let qid: string;
  try { qid = parsePublicCatalogQid(rawQid); }
  catch { return { title: COPY.unavailable, robots: { index: false, follow: false } }; }

  try {
    const title = await loadPublicCatalogTitle(qid);
    if (!title) return { title: COPY.unavailable, robots: { index: false, follow: false } };
    const names = displayNames(title);
    return {
      title: `${names.arabicName} - ${names.englishName} (${title.releaseYear}) | ${COPY.brand}`,
      description: buildPublicCatalogDescription(title),
      alternates: { canonical: buildPublicCatalogCanonicalUrl(qid) },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: COPY.unavailable, robots: { index: false, follow: false } };
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
  const kindLabel = title.kind === "movie" ? COPY.movie : COPY.series;
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
          <Link className={styles.brand} href="/">{COPY.brand}</Link>
          <Link className={styles.back} href="/titles">{COPY.allTitles}</Link>
        </header>

        <article className={styles.detailCard}>
          <span className={styles.kicker}>{COPY.kicker}</span>
          <h1>{names.arabicName}</h1>
          <p className={styles.originalTitle} dir="ltr">{names.englishName}</p>
          <div className={styles.meta}>
            <span>{kindLabel}</span><span>{title.releaseYear}</span><span>{title.qid}</span>
          </div>
          <p>{COPY.intro}</p>
          <div className={styles.sourceBox}>
            <dl>
              <dt>{COPY.source}</dt><dd><a href={title.sourceUrl} rel="noreferrer">Wikidata - {title.qid}</a></dd>
              <dt>{COPY.license}</dt><dd>{title.sourceLicense}</dd>
              <dt>{COPY.policy}</dt><dd>{title.policyVersion}</dd>
              <dt>{COPY.retrieved}</dt><dd>{new Date(title.retrievedAt).toLocaleDateString("ar-EG", { timeZone: "UTC" })}</dd>
            </dl>
          </div>
        </article>

        <section className={styles.notice}>
          <h2>{editorialReview ? COPY.hasEditorial : COPY.hasReview}</h2>
          <p>{editorialReview ? COPY.editorialCopy : COPY.noEditorialCopy}</p>
          {editorialReview ? (
            <Link className={styles.cardLink} href={buildPublicEditorialReviewHref(editorialReview.id)}>{COPY.openEditorial} <span aria-hidden="true">{"\u2190"}</span></Link>
          ) : (
            <Link className={styles.cardLink} href={`/search?q=${encodeURIComponent(names.arabicName)}`}>{COPY.searchReview} <span aria-hidden="true">{"\u2190"}</span></Link>
          )}
        </section>
      </div>
    </main>
  );
}
