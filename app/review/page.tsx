import Link from "next/link";

import { loadPublicReview } from "@/db/public-review-service";

import ReviewClient from "./review-client";

type ReviewPageProps = {
  searchParams: Promise<{ bundleId?: string | string[] }>;
};

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;
  const bundleId = typeof params.bundleId === "string" ? params.bundleId.trim() : "";

  if (!bundleId) return <ReviewUnavailable />;

  const review = await loadReviewFailClosed(bundleId);
  return review ? <ReviewClient review={review} /> : <ReviewUnavailable />;
}

async function loadReviewFailClosed(bundleId: string) {
  try {
    return await loadPublicReview({ bundleId });
  } catch {
    return null;
  }
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
          <p>ممكن تكون النسخة اتغيّرت، أو الاعتماد اتوقف، أو الرابط قديم. مش هنعرض بيانات بديلة أو نموذج تجريبي مكانها.</p>
        </div>
        <Link href="/search">ارجع للبحث <span aria-hidden="true">←</span></Link>
      </section>
    </main>
  );
}

function ReviewLogo() {
  return (
    <span className="review-logo" aria-hidden="true">
      <i />
      <b />
      <em />
    </span>
  );
}
