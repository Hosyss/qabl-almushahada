import Link from "next/link";

import {
  assessEditorialReviewPublication,
  getEditorialCategoryLabelAr,
  type EditorialReviewPublication,
} from "@/lib/editorial-review";
import { CONTENT_CATEGORIES } from "@/lib/review-engine";

const SOURCE_TYPE_LABELS = {
  published_review: "مراجعة منشورة مستقلة",
  official_classification: "جهة تصنيف رسمية",
} as const;

export default function EditorialReviewView({
  review,
}: {
  review: EditorialReviewPublication;
}) {
  const assessment = assessEditorialReviewPublication(review);
  const claimsById = new Map(review.claims.map((claim) => [claim.id, claim]));
  const claimsByCategory = new Map(
    CONTENT_CATEGORIES.map((category) => [
      category,
      review.claims.filter((claim) => claim.category === category),
    ]),
  );

  return (
    <main className="review-page">
      <header className="review-header">
        <Link className="review-brand" href="/" aria-label="قبل المشاهدة — الرئيسية">
          <ReviewLogo />
          <span><strong>قبل المشاهدة</strong><small>قرار أهدى لكل بيت</small></span>
        </Link>
        <Link className="review-back" href="/search">الرجوع للبحث <span aria-hidden="true">←</span></Link>
      </header>

      <section className="review-title-card" aria-labelledby="review-title">
        <div className="review-poster" aria-hidden="true">
          <span>◎</span>
          <small>تحرير</small>
        </div>
        <div className="review-title-copy">
          <div className="review-title-badges">
            <span className="review-demo-badge">تحليل تحريري موثق جزئيًا</span>
            <span className="review-type-badge">فيلم</span>
          </div>
          <h1 id="review-title">{review.titleLabel}</h1>
          <p>فيلم · {review.releaseYear}</p>
          <div className="review-version-line">
            <span><i aria-hidden="true">✓</i> وقائع متقاطعة بين مصادر مستقلة</span>
            <span>نشر تجريبي P4-03</span>
            <span>نُشر: {formatDate(review.publishedAt)}</span>
          </div>
        </div>
        <div className="review-verification">
          <span className="review-verification__icon" aria-hidden="true">◎</span>
          <span><small>حالة الحكم</small><strong>البيانات غير كافية للحكم</strong></span>
        </div>
      </section>

      <div className="review-layout">
        <div className="review-content">
          <section className="review-decision" aria-labelledby="decision-title">
            <div className="review-decision__mark" aria-hidden="true">!</div>
            <div>
              <span>قرار الملاءمة</span>
              <h2 id="decision-title">insufficient_data — لا نصدر حكمًا نهائيًا بعد</h2>
              <p>
                الصفحة قابلة للنشر لأنها تعرض وقائع موثقة ومصادرها، لكن المحاور غير المحسومة
                تبقى `uncertain` ولا تتحول إلى «غير موجود» أو «مناسب».
              </p>
            </div>
            <div className="review-age"><small>المحاور غير المحسومة</small><strong>{assessment.uncertainCategoryCount}/10</strong></div>
          </section>

          <section className="review-summary" aria-label="ملخص سريع">
            <article><span aria-hidden="true">◎</span><div><small>المصادر</small><strong>{review.sources.length} مصادر</strong></div></article>
            <article><span aria-hidden="true">✓</span><div><small>وقائع متحققة بمصدرين+</small><strong>{assessment.corroboratedClaimCount}</strong></div></article>
            <article><span aria-hidden="true">!</span><div><small>سلطة الحكم</small><strong>غير مفعلة</strong></div></article>
          </section>

          <section className="review-logic" aria-labelledby="analysis-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>تحليل عربي أصلي</span><h2 id="analysis-title">الخلاصة التحريرية</h2></div>
            </div>
            <div className="review-transparency">
              <span className="review-transparency__mark" aria-hidden="true">◎</span>
              <div>
                <strong>التحليل مكتوب من الصفر، وليس ترجمة أو إعادة صياغة لمراجعة واحدة.</strong>
                <p>{review.analysisAr}</p>
              </div>
            </div>
          </section>

          <section className="review-breakdown" aria-labelledby="breakdown-title">
            <div className="review-section-head">
              <div><span>المحتوى بالتفصيل</span><h2 id="breakdown-title">إيه اللي نقدر نثبته حاليًا؟</h2></div>
            </div>

            <div className="review-category-list">
              {CONTENT_CATEGORIES.map((category) => {
                const categoryClaims = claimsByCategory.get(category) ?? [];
                const isUncertain = categoryClaims.length === 0;
                return (
                  <article className="review-category is-open" key={category}>
                    <div className="review-category__facts" id={`editorial-category-${category}`}>
                      <div className="review-facts-label">
                        <span>{getEditorialCategoryLabelAr(category)}</span>
                        <small>{isUncertain ? "غير محسوم" : "واقعة/وقائع مثبتة"}</small>
                      </div>
                      {isUncertain ? (
                        <div className="review-fact">
                          <time>؟</time>
                          <p>المصادر الحالية لا تكفي لحسم هذا المحور. لا نعامل غياب الذكر كدليل على عدم الوجود.</p>
                        </div>
                      ) : (
                        categoryClaims.map((claim) => (
                          <div className="review-fact" key={claim.id}>
                            <time>{claim.verification === "corroborated" ? "✓✓" : "✓"}</time>
                            <p>
                              {claim.summaryAr}{" "}
                              <small>
                                ({claim.sourceIds.length} {claim.sourceIds.length === 1 ? "مصدر" : "مصادر مستقلة"})
                              </small>
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="review-logic" aria-labelledby="method-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>منهج P4-03 التحريري</span><h2 id="method-title">إزاي بنفصل المعلومة عن الحكم؟</h2></div>
            </div>
            <div className="review-logic-steps">
              <article><b>1</b><div><strong>نستخرج الوقائع فقط</strong><p>لا نخزن نص المراجعة الأصلية ولا ترجمتها ولا اقتباسًا طويلًا منها.</p></div></article>
              <article><b>2</b><div><strong>نبحث عن مصدر مستقل إضافي</strong><p>الواقعة المعلّمة كـ«متحقق منها» هنا مدعومة بمجموعتي استقلال مختلفتين على الأقل.</p></div></article>
              <article><b>3</b><div><strong>نترك المجهول مجهولًا</strong><p>النشر التحريري يسمح بـ`uncertain`، بينما بوابة قرار الملاءمة القديمة تظل مغلقة حتى تكتمل شروطها.</p></div></article>
            </div>
          </section>

          <section className="review-transparency">
            <span className="review-transparency__mark" aria-hidden="true">◎</span>
            <div><strong>نطاق التحليل</strong><p>{review.scopeAr}</p></div>
          </section>

          <section className="review-logic" aria-labelledby="sources-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>شفافية المصدر</span><h2 id="sources-title">المصادر والادعاءات التي تدعمها</h2></div>
            </div>
            <div className="review-logic-steps">
              {review.sources.map((source, index) => (
                <article key={source.id}>
                  <b>{index + 1}</b>
                  <div>
                    <strong>{source.publisher}</strong>
                    <p>{SOURCE_TYPE_LABELS[source.sourceType]} · تم الوصول: {formatAccessDate(source.accessedOn)}</p>
                    <p>
                      يدعم: {source.supportedClaimIds
                        .map((claimId) => claimsById.get(claimId)?.summaryAr)
                        .filter((summary): summary is string => Boolean(summary))
                        .join(" — ")}
                    </p>
                    <p><a href={source.sourceUrl} target="_blank" rel="noreferrer">فتح المصدر الأصلي</a></p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="review-aside" aria-label="حالة التحليل التحريري">
          <section className="family-result-card">
            <div className="family-result-card__head"><div><small>قرار الأسرة</small><strong>غير متاح بعد</strong></div></div>
            <div className="family-result-orb is-general">
              <span aria-hidden="true">!</span><small>حالة القرار</small><strong>insufficient_data</strong>
              <p>الوقائع المنشورة مفيدة قبل المشاهدة، لكنها لا تكفي وحدها لإصدار «مناسب» أو «غير مناسب».</p>
            </div>
          </section>

          <section className="why-card">
            <span>الخلاصة في 20 ثانية</span><h3>إيه المؤكد وإيه الناقص؟</h3>
            <ul>
              <li><i aria-hidden="true">✓</i><span>{assessment.corroboratedClaimCount} وقائع تحريرية متقاطعة بين مصادر مستقلة.</span></li>
              <li><i aria-hidden="true">!</i><span>{assessment.uncertainCategoryCount} محاور ما زالت غير محسومة.</span></li>
              <li><i aria-hidden="true">✓</i><span>لا ادعاء بمشاهدة بشرية ولا تحديد نسخة دقيقة لم يحدث.</span></li>
            </ul>
          </section>

          <section className="version-card">
            <div><span aria-hidden="true">◫</span><strong>بيانات النشر التحريري</strong></div>
            <dl>
              <div><dt>معرّف العمل</dt><dd>{review.titleId}</dd></div>
              <div><dt>سنة الإصدار</dt><dd>{review.releaseYear}</dd></div>
              <div><dt>نسخة السياسة</dt><dd>{review.policyVersion}</dd></div>
              <div><dt>معرّف النشر</dt><dd>{review.id}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="review-end">
        <span aria-hidden="true">✦</span>
        <div><small>نهاية التحليل التحريري</small><h2>الوقائع المثبتة منشورة الآن؛ الحكم ينتظر اكتمال الأدلة.</h2></div>
        <Link href="/search">ابحث عن عنوان تاني <span aria-hidden="true">←</span></Link>
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
