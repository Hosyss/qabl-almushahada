import type { Metadata } from "next";
import Link from "next/link";

import { loadPublicEvidenceReview } from "@/db/public-evidence-review-service";
import { loadPublicReview } from "@/db/public-review-service";
import { getEditorialPublicationPresentation } from "@/lib/editorial-publication-presentation";
import {
  buildEditorialReviewDescription,
  buildPublicEditorialReviewCanonicalUrl,
} from "@/lib/editorial-review";
import { getEditorialReviewPublicationById } from "@/lib/editorial-review-registry";

import EditorialReviewView from "./editorial-review-view";
import EvidenceReviewClient from "./evidence-review-client";
import ReviewClient from "./review-client";

type ReviewSearchParams = {
  bundleId?: string | string[];
  publicationId?: string | string[];
  editorialId?: string | string[];
};

type ReviewPageProps = { searchParams: Promise<ReviewSearchParams> };

export async function generateMetadata({ searchParams }: ReviewPageProps): Promise<Metadata> {
  const params = await searchParams;
  const bundleId = typeof params.bundleId === "string" ? params.bundleId.trim() : "";
  const publicationId = typeof params.publicationId === "string" ? params.publicationId.trim() : "";
  const editorialId = typeof params.editorialId === "string" ? params.editorialId.trim() : "";
  const locatorCount = [bundleId, publicationId, editorialId].filter(Boolean).length;

  if (locatorCount !== 1 || !editorialId) return {};

  const review = loadEditorialReviewFailClosed(editorialId);
  if (!review) {
    return {
      title: "تحليل غير متاح | قبل المشاهدة",
      robots: { index: false, follow: false },
    };
  }

  const presentation = getEditorialPublicationPresentation(review);
  const title = `${presentation.titleAr} — ${presentation.titleEn} (${review.releaseYear}) | قبل المشاهدة`;
  const description = buildEditorialReviewDescription(review);
  const canonical = buildPublicEditorialReviewCanonicalUrl(review.id);

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
      publishedTime: review.publishedAt,
      modifiedTime: presentation.updatedAt,
      authors: ["قبل المشاهدة"],
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const bundleId = typeof params.bundleId === "string" ? params.bundleId.trim() : "";
  const publicationId = typeof params.publicationId === "string" ? params.publicationId.trim() : "";
  const editorialId = typeof params.editorialId === "string" ? params.editorialId.trim() : "";
  const locatorCount = [bundleId, publicationId, editorialId].filter(Boolean).length;

  if (locatorCount !== 1) return <ReviewUnavailable />;

  if (bundleId) {
    const review = await loadHumanReviewFailClosed(bundleId);
    return review ? <ReviewClient review={review} /> : <ReviewUnavailable />;
  }

  if (publicationId) {
    const evidenceReview = await loadEvidenceReviewFailClosed(publicationId);
    return evidenceReview ? <EvidenceReviewClient review={evidenceReview} /> : <ReviewUnavailable />;
  }

  const editorialReview = loadEditorialReviewFailClosed(editorialId);
  return editorialReview ? <EditorialReviewView review={editorialReview} /> : <ReviewUnavailable />;
}

async function loadHumanReviewFailClosed(bundleId: string) {
  try { return await loadPublicReview({ bundleId }); } catch { return null; }
}

async function loadEvidenceReviewFailClosed(publicationId: string) {
  try { return await loadPublicEvidenceReview({ publicationId }); } catch { return null; }
}

function loadEditorialReviewFailClosed(editorialId: string) {
  try { return getEditorialReviewPublicationById(editorialId); } catch { return null; }
}

function ReviewUnavailable() {
  return (
    <main className="review-page">
      <header className="review-header">
        <Link className="review-brand" href="/" aria-label="قبل المشاهدة — الرئيسية">
          <ReviewLogo />
          <span><strong>قبل المشاهدة</strong><small>قرار أهدى لكل بيت</small></span>
        </Link>
        <Link className="review-back" href="/search">الرجوع للبحث <span aria-hidden="true">←</span></Link>
      </header>
      <section className="review-end" aria-labelledby="review-unavailable-title">
        <span aria-hidden="true">◎</span>
        <div>
          <small>حالة آمنة</small>
          <h1 id="review-unavailable-title">المراجعة غير متاحة حاليًا.</h1>
          <p>ممكن تكون النسخة أو الاعتماد أو snapshot الأدلة اتغيّرت، أو الرابط قديم. مش هنعرض بيانات بديلة أو نموذج تجريبي مكانها.</p>
        </div>
        <Link href="/search">ارجع للبحث <span aria-hidden="true">←</span></Link>
      </section>
    </main>
  );
}

function ReviewLogo() {
  return <span className="review-logo" aria-hidden="true"><i /><b /><em /></span>;
}
