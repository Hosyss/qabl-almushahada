import Link from "next/link";

import {
  assessEditorialReviewPublication,
  buildEditorialReviewDescription,
  buildPublicEditorialReviewCanonicalUrl,
  getEditorialCategoryLabelAr,
  type EditorialReviewPublication,
} from "@/lib/editorial-review";
import { CONTENT_CATEGORIES } from "@/lib/review-engine";

const SOURCE_TYPE_LABELS = {
  published_review: "مراجعة منشورة مستقلة",
  official_classification: "جهة تصنيف رسمية",
  open_encyclopedia: "مرجع موسوعي مفتوح",
} as const;

export default function EditorialReviewView({ review }: { review: EditorialReviewPublication }) {
  const assessment = assessEditorialReviewPublication(review);
  const claimsById = new Map(review.claims.map((claim) => [claim.id, claim]));
  const sourcesById = new Map(review.sources.map((source) => [source.id, source]));
  const claimsByCategory = new Map(
    CONTENT_CATEGORIES.map((category) => [
      category,
      review.claims.filter((claim) => claim.category === category),
    ]),
  );
  const presentCategoryCount = CONTENT_CATEGORIES.length - assessment.uncertainCategoryCount;
  const canonicalUrl = buildPublicEditorialReviewCanonicalUrl(review.id);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${review.titleLabel} (${review.releaseYear}) — تحليل محتوى موثق جزئيًا`,
    description: buildEditorialReviewDescription(review),
    inLanguage: "ar",
    datePublished: review.publishedAt,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    author: { "@type": "Organization", name: "قبل المشاهدة" },
    publisher: { "@type": "Organization", name: "قبل المشاهدة" },
    about: { "@type": review.kind === "movie" ? "Movie" : "CreativeWork", name: review.titleLabel },
    citation: review.sources.map((source) => source.sourceUrl),
  }).replaceAll("<", "\\u003c");

  return (
    <main className="review-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <header className="review-header">
        <Link className="review-brand" href="/" aria-label="قبل المشاهدة — الرئيسية">
          <ReviewLogo />
          <span><strong>قبل المشاهدة</strong><small>قرار أهدى لكل بيت</small></span>
        </Link>
        <Link className="review-back" href="/search">الرجوع للبحث <span aria-hidden="true">←</span></Link>
      </header>

      <section className="review-title-card" aria-labelledby="review-title">
        <div className="review-poster" aria-hidden="true"><span>◎</span><small>تحرير</small></div>
        <div className="review-title-copy">
          <div className="review-title-badges">
            <span className="review-demo-badge">تحليل تحريري بأدلة معلنة</span>
            <span className="review-type-badge">فيلم</span>
          </div>
          <h1 id="review-title">{review.titleLabel}</h1>
          <p>فيلم · {review.releaseYear}</p>
          <div className="review-version-line">
            <span><i aria-hidden="true">✓</i> قوة كل واقعة ومصادرها ظاهرة</span>
            <span>مراجعة جودة P4-03</span>
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
              <h2 id="decision-title">البيانات غير كافية — لا نصدر حكمًا نهائيًا بعد</h2>
              <p>
                الصفحة مفيدة لفهم الوقائع التي استطعنا إسنادها، لكنها لا تقول «مناسب» أو «غير مناسب».
                {" "}{assessment.uncertainCategoryCount} من 10 محاور ما زالت غير محسومة، وأي محور لم يذكره مصدر لا يتحول تلقائيًا إلى «غير موجود».
              </p>
              <small className="editorial-internal-code">الرمز الداخلي: <code dir="ltr">insufficient_data</code></small>
            </div>
            <div className="review-age"><small>اكتمال المحاور</small><strong>{presentCategoryCount}/10</strong></div>
          </section>

          <section className="review-summary" aria-label="ملخص قوة الأدلة">
            <article><span aria-hidden="true">◎</span><div><small>المصادر المؤهلة</small><strong>{review.sources.length}</strong></div></article>
            <article><span aria-hidden="true">✓</span><div><small>اتفاق مصدرين مستقلين+</small><strong>{assessment.corroboratedClaimCount} وقائع</strong></div></article>
            <article><span aria-hidden="true">1</span><div><small>دليل أحادي المصدر</small><strong>{assessment.singleSourceClaimCount} وقائع</strong></div></article>
          </section>

          <section className="review-logic" aria-labelledby="analysis-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>قيمة تحريرية أصلية</span><h2 id="analysis-title">الخلاصة: الاتفاق، الضعف، وما لم يُحسم</h2></div>
            </div>
            <div className="review-transparency">
              <span className="review-transparency__mark" aria-hidden="true">◎</span>
              <div>
                <strong>النص العربي مكتوب من الصفر، ولا ينقل صياغة مراجعة خارجية أو تقييمها العددي.</strong>
                <p>{review.analysisAr}</p>
              </div>
            </div>
            <div className="editorial-evidence-grid" aria-label="درجة اكتمال الأدلة">
              <div><small>اتفاق مستقل</small><strong>{assessment.corroboratedClaimCount}</strong><span>وقائع لها مجموعتا استقلال على الأقل</span></div>
              <div><small>مصدر واحد</small><strong>{assessment.singleSourceClaimCount}</strong><span>معلومة مفيدة لكن الاتفاق المستقل لم يكتمل</span></div>
              <div><small>محاور غير محسومة</small><strong>{assessment.uncertainCategoryCount}/10</strong><span>لا نستخدم الصمت كإثبات للغياب</span></div>
              <div><small>تعارض صريح</small><strong>0 مسجل</strong><span>داخل الأدلة المؤهلة الحالية فقط؛ لا يعني غياب أي خلاف خارجها</span></div>
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
                        <small>{isUncertain ? "غير محسوم" : "توجد واقعة/وقائع مدعومة"}</small>
                      </div>
                      {isUncertain ? (
                        <div className="review-fact">
                          <time>؟</time>
                          <p>المصادر الحالية لا تكفي لحسم هذا المحور. لا نعامل غياب الذكر أو تقييم مصدر واحد كدليل عام على عدم الوجود.</p>
                        </div>
                      ) : (
                        categoryClaims.map((claim) => {
                          const claimSources = claim.sourceIds
                            .map((sourceId) => sourcesById.get(sourceId))
                            .filter((source) => Boolean(source));
                          return (
                            <div className="review-fact editorial-fact" key={claim.id}>
                              <time>{claim.verification === "corroborated" ? "✓✓" : "✓"}</time>
                              <div>
                                <span className={`editorial-strength editorial-strength--${claim.verification}`}>
                                  {claim.verification === "corroborated" ? "اتفاق مستقل" : "مصدر واحد فقط"}
                                </span>
                                <p>{claim.summaryAr}</p>
                                <small className="editorial-source-links">
                                  المصادر: {claimSources.map((source, index) => (
                                    <span key={source!.id}>
                                      {index > 0 ? " · " : ""}
                                      <a href={`#${source!.id}`}>{source!.publisher}</a>
                                    </span>
                                  ))}
                                </small>
                              </div>
                            </div>
                          );
                        })
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
              <article><b>1</b><div><strong>نستخدم الوقائع لا النصوص</strong><p>لا نخزن نص مراجعة خارجية ولا ترجمتها ولا تقييماتها العددية، ونكتب الوصف العربي من الصفر.</p></div></article>
              <article><b>2</b><div><strong>نعلن قوة الإسناد</strong><p>«اتفاق مستقل» يحتاج مجموعتي استقلال على الأقل. لو بقي مصدر مؤهل واحد فقط، نعرضه كدليل أحادي بوضوح.</p></div></article>
              <article><b>3</b><div><strong>نترك المجهول مجهولًا</strong><p>المحور غير المحسوم لا يتحول إلى `none`، وهذه الصفحة لا تملك سلطة إصدار حكم ملاءمة.</p></div></article>
            </div>
          </section>

          <section className="review-transparency">
            <span className="review-transparency__mark" aria-hidden="true">◎</span>
            <div><strong>نطاق التحليل</strong><p>{review.scopeAr}</p></div>
          </section>

          <section className="review-logic" aria-labelledby="sources-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>شفافية المصدر والحقوق</span><h2 id="sources-title">المصادر، ما تدعمه، وأساس الاستخدام</h2></div>
            </div>
            <div className="review-logic-steps editorial-source-cards">
              {review.sources.map((source, index) => (
                <article key={source.id} id={source.id}>
                  <b>{index + 1}</b>
                  <div>
                    <strong>{source.publisher}</strong>
                    <p>{SOURCE_TYPE_LABELS[source.sourceType]} · تم الوصول: {formatAccessDate(source.accessedOn)}</p>
                    {source.sourceVersion ? <p>نسخة المصدر: <code dir="ltr">{source.sourceVersion}</code></p> : null}
                    <p>
                      يدعم: {source.supportedClaimIds
                        .map((claimId) => claimsById.get(claimId)?.category)
                        .filter((category): category is NonNullable<typeof category> => Boolean(category))
                        .map((category) => getEditorialCategoryLabelAr(category))
                        .join("، ")}
                    </p>
                    <p className="editorial-rights-note"><strong>أساس الاستخدام:</strong> {source.rightsLabel}</p>
                    <p>{source.usageNoteAr}</p>
                    <p className="editorial-source-actions">
                      <a href={source.sourceUrl} target="_blank" rel="noreferrer">فتح المصدر</a>
                      <a href={source.rightsUrl} target="_blank" rel="noreferrer">الرخصة / الشروط</a>
                    </p>
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
              <span aria-hidden="true">!</span><small>حالة القرار</small><strong>البيانات غير كافية</strong>
              <p>الوقائع المنشورة تساعدك تفهم المحتوى، لكنها لا تكفي وحدها لإصدار «مناسب» أو «غير مناسب».</p>
            </div>
          </section>

          <section className="why-card">
            <span>الخلاصة في 20 ثانية</span><h3>إيه المؤكد وإيه الناقص؟</h3>
            <ul>
              <li><i aria-hidden="true">✓</i><span>{assessment.corroboratedClaimCount} وقائع عليها اتفاق من مصادر مستقلة.</span></li>
              <li><i aria-hidden="true">1</i><span>{assessment.singleSourceClaimCount} وقائع مدعومة بمصدر واحد فقط.</span></li>
              <li><i aria-hidden="true">!</i><span>{assessment.uncertainCategoryCount} محاور ما زالت غير محسومة.</span></li>
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
        <div><small>نهاية التحليل التحريري</small><h2>المعروف ظاهر بمصدره وقوة إسناده؛ وما لم يُحسم ظاهر كما هو.</h2></div>
        <Link href="/search">ابحث عن عنوان تاني <span aria-hidden="true">←</span></Link>
      </section>
    </main>
  );
}

function ReviewLogo() {
  return <span className="review-logo" aria-hidden="true"><i /><b /><em /></span>;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("ar-EG", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
}

function formatAccessDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("ar-EG", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}
