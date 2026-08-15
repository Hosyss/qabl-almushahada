import Link from "next/link";

import { buildPracticalEditorialReviewDescription } from "@/lib/editorial-practical-verdict";
import {
  buildEditorialPublicationContentFingerprint,
  getEditorialPublicationPresentation,
} from "@/lib/editorial-publication-presentation";
import {
  assessEditorialReviewPublication,
  buildPublicEditorialReviewCanonicalUrl,
  getEditorialCategoryLabelAr,
  type EditorialReviewPublication,
} from "@/lib/editorial-review";

import EditorialPracticalVerdict from "./editorial-practical-verdict";
import EditorialSummaryDialog from "./editorial-summary-dialog";
import TitleArtwork from "../title-artwork";

const SOURCE_TYPE_LABELS = {
  published_review: "مرجع خارجي مرتبط — وقائع عامة بالرابط فقط",
  official_classification: "مرجع خارجي لجهة تصنيف",
  open_encyclopedia: "مرجع موسوعي مفتوح بترخيص وعزو معلنين",
} as const;

export default async function EditorialReviewView({ review }: { review: EditorialReviewPublication }) {
  const assessment = assessEditorialReviewPublication(review);
  const presentation = getEditorialPublicationPresentation(review);
  const fingerprint = await buildEditorialPublicationContentFingerprint(review);
  const sourcesById = new Map(review.sources.map((source) => [source.id, source]));
  const corroboratedFacts = review.claims
    .filter((claim) => claim.verification === "corroborated")
    .map((claim) => claim.summaryAr);
  const uncertainLabels = review.uncertainCategories.map((category) => getEditorialCategoryLabelAr(category));
  const canonicalUrl = buildPublicEditorialReviewCanonicalUrl(review.id);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${presentation.titleAr} — ${presentation.titleEn} (${review.releaseYear})`,
    description: buildPracticalEditorialReviewDescription(review),
    inLanguage: "ar",
    datePublished: review.publishedAt,
    dateModified: presentation.updatedAt,
    version: String(presentation.revision),
    identifier: fingerprint,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    author: { "@type": "Organization", name: "قبل المشاهدة" },
    publisher: { "@type": "Organization", name: "قبل المشاهدة" },
    copyrightHolder: { "@type": "Organization", name: "قبل المشاهدة" },
    copyrightNotice: "© قبل المشاهدة — تحليل تحريري أصلي",
    about: {
      "@type": review.kind === "movie" ? "Movie" : "CreativeWork",
      name: presentation.titleAr,
      alternateName: presentation.titleEn,
      dateCreated: String(review.releaseYear),
    },
    citation: review.sources.map((source) => source.sourceUrl),
  }).replaceAll("<", "\\u003c");

  return (
    <main className="review-page editorial-quality-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <header className="review-header">
        <Link className="review-brand" href="/" aria-label="قبل المشاهدة — الرئيسية">
          <ReviewLogo />
          <span><strong>قبل المشاهدة</strong><small>قرار أهدى لكل بيت</small></span>
        </Link>
        <Link className="review-back" href="/search">الرجوع للبحث <span aria-hidden="true">←</span></Link>
      </header>

      <section className="review-title-card" aria-labelledby="review-title">
        <TitleArtwork titleId={review.titleId} className="review-poster review-poster--artwork" sizes="108px" priority showDisclosure />
        <div className="review-title-copy">
          <div className="review-title-badges">
            <span className="review-demo-badge">تحليل تحريري متعدد المصادر</span>
            <span className="review-type-badge">حكم عملي على مستوى العمل</span>
          </div>
          <h1 id="review-title">{presentation.titleAr}</h1>
          <p className="review-original-title" dir="ltr">{presentation.titleEn}</p>
          <p>فيلم · {review.releaseYear}</p>
        </div>
        <div className="review-verification">
          <span className="review-verification__icon" aria-hidden="true">✓</span>
          <span><small>حالة القرار</small><strong>التحليل جاهز لحكم الأسرة — والمجهول يظل ظاهرًا</strong></span>
        </div>
      </section>

      <div className="editorial-quality-shell">
        <section className="editorial-primary-summary" aria-labelledby="editorial-primary-summary-title">
          <div>
            <span>الخلاصة التحريرية</span>
            <h2 id="editorial-primary-summary-title">ما الذي تقوله الأدلة الحالية؟</h2>
            <p>{review.analysisAr.replaceAll("Harry", "هاري")}</p>
            <p className="editorial-type-note">
              هذا تحليل للعمل من مراجع معلنة، وليس ادعاءً بأن فريقنا شاهد نسخة محددة بمنصة ولغة ومدة وبصمة محتوى.
              الحكم العملي أدناه يجيب قرار الأسرة بعد تحديد العمر والحدود، بينما ختم النسخة المحددة يظل مسارًا أعلى مستقلًا.
            </p>
          </div>
          <EditorialSummaryDialog
            titleAr={presentation.titleAr}
            titleEn={presentation.titleEn}
            releaseYear={review.releaseYear}
            analysisAr={review.analysisAr.replaceAll("Harry", "هاري")}
            corroboratedFacts={corroboratedFacts.map((fact) => fact.replaceAll("Harry", "هاري"))}
            uncertainLabels={uncertainLabels}
            sources={review.sources.map((source) => ({
              publisher: source.publisher,
              sourceUrl: source.sourceUrl,
              rightsLabel: source.rightsLabel,
            }))}
            fingerprint={fingerprint}
          />
        </section>

        <EditorialPracticalVerdict review={review} publicationQualityPassed={assessment.publishable} />

        <section className="editorial-supported" aria-labelledby="supported-title">
          <div className="review-section-head review-section-head--simple">
            <div>
              <span>الوقائع المدعومة</span>
              <h2 id="supported-title">{formatArabicFactCount(review.claims.length)} نستطيع عرضها بإسناد واضح</h2>
            </div>
          </div>
          <div className="editorial-supported-list">
            {review.claims.map((claim) => {
              const claimSources = claim.sourceIds
                .map((sourceId) => sourcesById.get(sourceId))
                .filter((source): source is NonNullable<typeof source> => Boolean(source));
              return (
                <article className="editorial-supported-fact" key={claim.id} id={`fact-${claim.id}`}>
                  <div className="editorial-supported-fact__head">
                    <strong>{getEditorialCategoryLabelAr(claim.category)}</strong>
                    <span className={`editorial-strength editorial-strength--${claim.verification}`}>
                      {claim.verification === "corroborated"
                        ? "مدعومة بمصدرين مستقلين على الأقل"
                        : "مدعومة بمرجع واحد"}
                    </span>
                  </div>
                  <p>{claim.summaryAr.replaceAll("Harry", "هاري")}</p>
                  <small className="editorial-source-links">
                    الإسناد: {claimSources.map((source, index) => (
                      <span key={source.id}>{index > 0 ? " · " : ""}<a href={`#${source.id}`}>{source.publisher}</a></span>
                    ))}
                  </small>
                </article>
              );
            })}
          </div>
        </section>

        <section className="editorial-uncertain" aria-labelledby="uncertain-title">
          <div>
            <span>المحاور غير المحسومة</span>
            <h2 id="uncertain-title">{assessment.uncertainCategoryCount} من 10 محاور ما زالت غير محسومة</h2>
            <p>
              غياب الذكر في المراجع الحالية لا يثبت أن المحتوى غير موجود، لذلك لا نحوله إلى «لا يوجد».
              وجود هذه المحاور قد يحول الحكم إلى «يحتاج انتباهك»، لكنه لا يعيد العمل الناضج تلقائيًا إلى «المعلومات غير كافية».
            </p>
          </div>
          <ul>{uncertainLabels.map((label) => <li key={label}>{label}</li>)}</ul>
        </section>

        <section className="review-logic editorial-sources" aria-labelledby="sources-title">
          <div className="review-section-head review-section-head--simple">
            <div><span>المراجع والعزو</span><h2 id="sources-title">ما المرجع المرتبط، وما الذي نستخدمه منه؟</h2></div>
          </div>
          <div className="review-logic-steps editorial-source-cards">
            {review.sources.map((source, index) => (
              <article key={source.id} id={source.id}>
                <b>{index + 1}</b>
                <div>
                  <strong>{source.publisher}</strong>
                  <p>{SOURCE_TYPE_LABELS[source.sourceType]} · تم الوصول: {formatAccessDate(source.accessedOn)}</p>
                  {source.sourceVersion ? <p>نسخة ثابتة للمصدر: <code dir="ltr">{source.sourceVersion}</code></p> : null}
                  <p>{source.usageNoteAr}</p>
                  <p className="editorial-rights-note"><strong>الحقوق/أساس الاستخدام:</strong> {source.rightsLabel}</p>
                  <p className="editorial-source-actions">
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer">فتح المرجع</a>
                    <a href={source.rightsUrl} target="_blank" rel="noreferrer">الترخيص أو الشروط</a>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <details className="editorial-details">
          <summary>كيف نفصل الحكم العملي عن المراجعة الموثقة لنسخة محددة؟</summary>
          <div>
            <p>
              في التحليل التحريري نستخدم الوقائع فقط ونكتب النص العربي من الصفر. لا ننقل نص مراجعة خارجية أو ترجمتها
              أو درجاتها أو بنيتها، ولا ندّعي مشاهدة نسخة محددة.
            </p>
            <p>
              الحكم العملي يستخدم corpus تحريري ناضج ومتعدد المصادر ليعطي الأسرة نتيجة واضحة: ينفع، يحتاج انتباه، أو لا ننصح به وفق حدودها.
              المراجعة الموثقة لنسخة محددة تظل مستوى ثقة أعلى يرتبط بمنصة ولغة ومدة وبصمة محتوى ومراجعين مستقلين.
            </p>
            <p><strong>نطاق هذا التحليل:</strong> {review.scopeAr.replaceAll("Harry", "هاري")}</p>
          </div>
        </details>

        <details className="editorial-details">
          <summary>تفاصيل النشر وإثبات النسخة</summary>
          <div className="editorial-ownership">
            <h2>© قبل المشاهدة — تحليل تحريري أصلي</h2>
            <dl>
              <div><dt>تاريخ النشر</dt><dd>{formatDate(review.publishedAt)}</dd></div>
              <div><dt>آخر تحديث</dt><dd>{formatDate(presentation.updatedAt)}</dd></div>
              <div><dt>Revision</dt><dd>{presentation.revision}</dd></div>
              <div className="editorial-fingerprint"><dt>بصمة المحتوى</dt><dd><code dir="ltr">{fingerprint}</code></dd></div>
              <div className="editorial-fingerprint"><dt>معرّف النشر</dt><dd><code dir="ltr">{review.id}</code></dd></div>
            </dl>
            <p>البصمة مرتبطة بمحتوى سجل النشر الحالي وتساعد على إثبات النسخة المنشورة في هذا revision.</p>
          </div>
        </details>

        <section className="editorial-report-note" aria-labelledby="report-note-title">
          <h2 id="report-note-title">وجدت معلومة تحتاج تصحيحًا؟</h2>
          <p>
            دورة التصحيح الداخلية موجودة، لكن قناة استقبال البلاغ العام ليست موصولة بأمان بعد؛ لذلك لا نعرض نموذج إرسال وهميًا.
            راجع سياسة التصحيح لمعرفة ما يحدث عند فتح بلاغ جوهري داخل الدورة الحالية.
          </p>
          <Link href="/corrections">سياسة التصحيح والبلاغات</Link>
        </section>
      </div>

      <section className="review-end">
        <span aria-hidden="true">✦</span>
        <div><small>نهاية التحليل</small><h2>قرار الأسرة واضح، والوقائع والمجهول ظاهرون من غير إخفاء.</h2></div>
        <Link href="/search">ابحث عن عنوان آخر <span aria-hidden="true">←</span></Link>
      </section>
    </main>
  );
}

function ReviewLogo() {
  return <span className="review-logo" aria-hidden="true"><i /><b /><em /></span>;
}

function formatArabicFactCount(count: number): string {
  if (count === 0) return "لا توجد وقائع";
  if (count === 1) return "واقعة واحدة";
  if (count === 2) return "واقعتان";
  if (count >= 3 && count <= 10) return `${count} وقائع`;
  return `${count} واقعة`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ar-EG", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAccessDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("ar-EG", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}