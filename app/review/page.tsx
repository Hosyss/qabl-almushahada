import type { Metadata } from "next";
import Link from "next/link";

import { loadPublicEvidenceReview } from "@/db/public-evidence-review-service";
import { loadPublicReview } from "@/db/public-review-service";
import { buildEditorialReviewDescription, buildPublicEditorialReviewCanonicalUrl } from "@/lib/editorial-review";
import { loadEditorialPublicationById } from "@/lib/public-editorial-read";
import { buildPublicEvidenceReviewHref } from "@/lib/public-evidence-review";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { buildPublicReviewHref } from "@/lib/public-review";

import EditorialReviewView from "./editorial-review-view";
import EvidenceReviewClient from "./evidence-review-client";
import ReviewClient from "./review-client";

type ReviewSearchParams = { bundleId?: string | string[]; publicationId?: string | string[]; editorialId?: string | string[] };
type ReviewPageProps = { searchParams: Promise<ReviewSearchParams> };

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
    if (!review) return UNAVAILABLE_METADATA;
    const title = `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة موثقة | قبل المشاهدة`;
    const description = `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة موثقة لنسخة محددة بعد اجتياز بوابات النشر والاعتماد في «قبل المشاهدة».`;
    const canonical = `${PUBLIC_SITE_ORIGIN}${buildPublicReviewHref(review.bundleId)}`;
    return buildArticleMetadata({ title, description, canonical, publishedTime: review.publishedAt, modifiedTime: review.approvedAt });
  }

  if (publicationId) {
    const review = await loadEvidenceReviewFailClosed(publicationId);
    if (!review) return UNAVAILABLE_METADATA;
    const title = `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة أدلة منشورة | قبل المشاهدة`;
    const description = `${review.title.canonicalName} (${review.title.releaseYear}) — مراجعة أدلة منشورة لنسخة محددة، مع توضيح أن المشاهدة البشرية للنسخة غير مؤكدة.`;
    const canonical = `${PUBLIC_SITE_ORIGIN}${buildPublicEvidenceReviewHref(review.publicationId)}`;
    return buildArticleMetadata({ title, description, canonical, publishedTime: review.publishedAt });
  }

  const persisted = await loadEditorialReviewFailClosed(editorialId);
  if (!persisted) return UNAVAILABLE_METADATA;
  const { review, presentation } = persisted;
  const title = `${presentation.titleAr} — ${presentation.titleEn} (${review.releaseYear}) | قبل المشاهدة`;
  const description = buildEditorialReviewDescription(review);
  const canonical = buildPublicEditorialReviewCanonicalUrl(review.id);
  return buildArticleMetadata({ title, description, canonical, publishedTime: review.publishedAt, modifiedTime: presentation.updatedAt });
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const bundleId = typeof params.bundleId === "string" ? params.bundleId.trim() : "";
  const publicationId = typeof params.publicationId === "string" ? params.publicationId.trim() : "";
  const editorialId = typeof params.editorialId === "string" ? params.editorialId.trim() : "";
  if ([bundleId, publicationId, editorialId].filter(Boolean).length !== 1) return <ReviewUnavailable />;
  if (bundleId) {
    const review = await loadHumanReviewFailClosed(bundleId);
    return review ? <ReviewClient review={review} /> : <ReviewUnavailable />;
  }
  if (publicationId) {
    const review = await loadEvidenceReviewFailClosed(publicationId);
    return review ? <EvidenceReviewClient review={review} /> : <ReviewUnavailable />;
  }
  const persisted = await loadEditorialReviewFailClosed(editorialId);
  return persisted ? <EditorialReviewView review={persisted.review} /> : <ReviewUnavailable />;
}

function buildArticleMetadata({
  title,
  description,
  canonical,
  publishedTime,
  modifiedTime,
}: {
  title: string;
  description: string;
  canonical: string;
  publishedTime: string;
  modifiedTime?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      locale: "ar_EG",
      publishedTime,
      ...(modifiedTime ? { modifiedTime } : {}),
      authors: ["قبل المشاهدة"],
    },
    twitter: { card: "summary", title, description },
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
