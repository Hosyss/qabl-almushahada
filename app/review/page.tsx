import type { Metadata } from "next";
import Link from "next/link";

import { loadPublicEvidenceReview } from "@/db/public-evidence-review-service";
import { loadPublicReview } from "@/db/public-review-service";
import { buildPublicArticleStructuredData } from "@/lib/public-article-structured-data";
import { buildPracticalEditorialReviewDescription } from "@/lib/editorial-practical-verdict";
import { buildPublicEditorialReviewCanonicalUrl } from "@/lib/editorial-review";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { loadEditorialPublicationById } from "@/lib/public-editorial-read";
import { buildPublicEvidenceReviewHref } from "@/lib/public-evidence-review";
import { buildPublicReviewHref } from "@/lib/public-review";

import EditorialReviewView from "./editorial-review-view";
import EvidenceReviewClient from "./evidence-review-client";
import ReviewClient from "./review-client";

type ReviewSearchParams = { bundleId?: string | string[]; publicationId?: string | string[]; editorialId?: string | string[] };
type ReviewPageProps = { searchParams: Promise<ReviewSearchParams> };
type HumanReview = NonNullable<Awaited<ReturnType<typeof loadPublicReview>>>;
type EvidenceReview = NonNullable<Awaited<ReturnType<typeof loadPublicEvidenceReview>>>;
type EditorialReview = NonNullable<Awaited<ReturnType<typeof loadEditorialPublicationById>>>;

type PublicArticleDescriptor = Readonly<{
  title: string;
  headline: string;
  description: string;
  canonical: string;
  publishedTime: string;
  modifiedTime?: string;
}>;

const UNAVAILABLE_METADATA: Metadata = {
  title: "المراجعة غير متاحة | قبل المشاهدة",
  description: "رابط المراجعة غير صالح أو لا يشير إلى مراجعة عامة متاحة حاليًا.",
  robots: { index: false, follow: true },
};

export async function generateMetadata({ searchParams }: ReviewPageProps): Promise<Metadata> {
  const params = await searchParams;
  const bundleId = typeof params.bundleId === "string" ? params.bundleId.trim() : "";
  const publicationId = typeof params.publicationId === "string" ? params.publicationId.trim() : "";
  const editorialId = typeof params.editorialId === "string" ? params.editorialId.trim() : "";
  if ([bundleId, publicationId, editorialId].filter(Boolean).length !== 1) return UNAVAILABLE_METADATA;

  if (bundleId) {
    const review = await loadHumanReviewFailClosed(bundleId);
    return review ? buildArticleMetadata(describeHumanReview(review)) : UNAVAILABLE_METADATA;
  }

  if (publicationId) {
    const review = await loadEvidenceReviewFailClosed(publicationId);
    return review ? buildArticleMetadata(describeEvidenceReview(review)) : UNAVAILABLE_METADATA;
  }

  const persisted = await loadEditorialReviewFailClosed(editorialId);
  return persisted ? buildArticleMetadata(describeEditorialReview(persisted)) : UNAVAILABLE_METADATA;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const bundleId = typeof params.bundleId === "string" ? params.bundleId.trim() : "";
  const publicationId = typeof params.publicationId === "string" ? params.publicationId.trim() : "";
  const editorialId = typeof params.editorialId === "string" ? params.editorialId.trim() : "";
  if ([bundleId, publicationId, editorialId].filter(Boolean).length !== 1) return <ReviewUnavailable />;

  if (bundleId) {
    const review = await loadHumanReviewFailClosed(bundleId);
    if (!review) return <ReviewUnavailable />;
    return (
      <>
        <PublicArticleJsonLd descriptor={describeHumanReview(review)} />
        <ReviewClient review={review} />
      </>
    );
  }

  if (publicationId) {
    const review = await loadEvidenceReviewFailClosed(publicationId);
    if (!review) return <ReviewUnavailable />;
    return (
      <>
        <PublicArticleJsonLd descriptor={describeEvidenceReview(review)} />
        <EvidenceReviewClient review={review} />
      </>
    );
  }

  const persisted = await loadEditorialReviewFailClosed(editorialId);
  if (!persisted) return <ReviewUnavailable />;
  return (
    <>
      <PublicArticleJsonLd descriptor={describeEditorialReview(persisted)} />
      <EditorialReviewView review={persisted.review} />
    </>
  );
}

function describeHumanReview(review: HumanReview): PublicArticleDescriptor {
  const headline = `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة موثقة`;
  return {
    title: `${headline} | قبل المشاهدة`,
    headline,
    description: `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة موثقة لنسخة محددة بعد اجتياز بوابات النشر والاعتماد في «قبل المشاهدة».`,
    canonical: `${PUBLIC_SITE_ORIGIN}${buildPublicReviewHref(review.bundleId)}`,
    publishedTime: review.publishedAt,
  };
}

function describeEvidenceReview(review: EvidenceReview): PublicArticleDescriptor {
  const headline = `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة أدلة منشورة`;
  return {
    title: `${headline} | قبل المشاهدة`,
    headline,
    description: `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة أدلة منشورة لنسخة محددة، مع توضيح أن المشاهدة البشرية للنسخة غير مؤكدة.`,
    canonical: `${PUBLIC_SITE_ORIGIN}${buildPublicEvidenceReviewHref(review.publicationId)}`,
    publishedTime: review.publishedAt,
  };
}

function describeEditorialReview(persisted: EditorialReview): PublicArticleDescriptor {
  const { review, presentation } = persisted;
  const headline = `${presentation.titleAr} — ${presentation.titleEn} (${review.releaseYear})`;
  return {
    title: `${headline} | قبل المشاهدة`,
    headline,
    description: buildPracticalEditorialReviewDescription(review),
    canonical: buildPublicEditorialReviewCanonicalUrl(review.id),
    publishedTime: review.publishedAt,
    modifiedTime: presentation.updatedAt,
  };
}

function PublicArticleJsonLd({ descriptor }: { descriptor: PublicArticleDescriptor }) {
  const structuredData = buildPublicArticleStructuredData({
    headline: descriptor.headline,
    description: descriptor.description,
    canonical: descriptor.canonical,
    datePublished: descriptor.publishedTime,
    dateModified: descriptor.modifiedTime,
  });
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />;
}

function buildArticleMetadata(descriptor: PublicArticleDescriptor): Metadata {
  return {
    title: descriptor.title,
    description: descriptor.description,
    alternates: { canonical: descriptor.canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title: descriptor.title,
      description: descriptor.description,
      type: "article",
      url: descriptor.canonical,
      locale: "ar_EG",
      publishedTime: descriptor.publishedTime,
      ...(descriptor.modifiedTime ? { modifiedTime: descriptor.modifiedTime } : {}),
      authors: ["قبل المشاهدة"],
    },
    twitter: { card: "summary", title: descriptor.title, description: descriptor.description },
  };
}

async function loadHumanReviewFailClosed(bundleId: string) {
  try { return await loadPublicReview({ bundleId }); } catch { return null; }
}
async function loadEvidenceReviewFailClosed(publicationId: string) {
  try { return await loadPublicEvidenceReview({ publicationId }); } catch { return null; }
}
async function loadEditorialReviewFailClosed(editorialId: string) {
  try { return await loadEditorialPublicationById(editorialId); } catch { return null; }
}

function ReviewUnavailable() {
  return (
    <main className="review-page">
      <header className="review-header">
        <Link className="review-brand" href="/" aria-label="قبل المشاهدة — الرئيسية"><ReviewLogo /><span><strong>قبل المشاهدة</strong><small>قرار أهدى لكل بيت</small></span></Link>
        <Link className="review-back" href="/search">الرجوع للبحث <span aria-hidden="true">←</span></Link>
      </header>
      <section className="review-end" aria-labelledby="review-unavailable-title">
        <span aria-hidden="true">◎</span>
        <div><small>حالة آمنة</small><h1 id="review-unavailable-title">المراجعة غير متاحة حاليًا.</h1><p>قد يكون الرابط قديمًا أو غير مكتمل، أو تغيّرت حالة المراجعة. لن نعرض بيانات بديلة أو مثالًا تجريبيًا مكان مراجعة غير متاحة.</p></div>
        <Link href="/search">ابحث عن العمل <span aria-hidden="true">←</span></Link>
      </section>
    </main>
  );
}
function ReviewLogo() { return <span className="review-logo" aria-hidden="true"><i /><b /><em /></span>; }
