"use client";

import Link from "next/link";
import { useState } from "react";

import type { ContentCategory } from "@/lib/review-engine";
import type { PublicReviewView } from "@/lib/public-review";
import {
  buildPublicReviewPresentation,
  formatFactTime,
  getFactSummaryForSpoilerMode,
} from "@/lib/public-review-presentation";
import TitleArtwork from "../title-artwork";

const CATEGORY_ICONS: Record<ContentCategory, string> = {
  fear: "◌",
  violence: "◇",
  language: "◎",
  bullying: "!",
  sexualContent: "○",
  substances: "◫",
  discrimination: "≋",
  selfHarm: "△",
  grief: "♥",
  flashingLights: "✦",
};

export default function ReviewClient({ review }: { review: PublicReviewView }) {
  const presentation = buildPublicReviewPresentation(review);
  const firstOpenCategory =
    review.highestCategory ??
    presentation.categories.find((category) => category.severity > 0)?.id ??
    presentation.categories[0]?.id ??
    "";
  const [openCategory, setOpenCategory] = useState<string>(firstOpenCategory);
  const [spoilerFree, setSpoilerFree] = useState(true);

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
        <TitleArtwork titleId={review.title.id} className="review-poster review-poster--artwork" sizes="108px" priority fallback />

        <div className="review-title-copy">
          <div className="review-title-badges">
            <span className="review-demo-badge">مراجعة موثقة</span>
            <span className="review-type-badge">{presentation.kindLabel}</span>
          </div>
          <h1 id="review-title">{review.title.canonicalName}</h1>
          <p>
            {presentation.kindLabel} · {review.title.releaseYear} · {presentation.runtimeLabel}
            {review.title.originalName && review.title.originalName !== review.title.canonicalName
              ? ` · ${review.title.originalName}`
              : ""}
          </p>
          <div className="review-version-line">
            <span><i aria-hidden="true">✓</i> {review.version.editionLabel}</span>
            <span>{review.version.platform}</span>
            <span>نُشرت: {presentation.publishedDateLabel}</span>
          </div>
        </div>

        <div className="review-verification">
          <span className="review-verification__icon" aria-hidden="true">✓</span>
          <span><small>حالة البيانات</small><strong>مراجعة بشرية مكتملة</strong></span>
        </div>
      </section>

      <div className="review-layout">
        <div className="review-content">
          <section className="review-decision" aria-labelledby="decision-title">
            <div className="review-decision__mark" aria-hidden="true">⌁</div>
            <div>
              <span>ملخص المراجعة</span>
              <h2 id="decision-title">وقائع موثقة للنسخة دي</h2>
              <p>الصفحة تعرض ما سُجل واعتمد عن هذه النسخة فقط. لا نصدر حكمًا عامًا على الأسرة من غير حدودها.</p>
            </div>
            <div className="review-age"><small>أعلى شدة</small><strong>{presentation.highestSeverity}/4</strong></div>
          </section>

          <section className="review-summary" aria-label="ملخص سريع">
            <article><span aria-hidden="true">◌</span><div><small>أعلى محور</small><strong>{presentation.highestCategoryLabel}</strong></div></article>
            <article><span aria-hidden="true">◫</span><div><small>الوقائع المسجلة</small><strong>{review.observationCount} واقعة</strong></div></article>
            <article><span aria-hidden="true">✓</span><div><small>حالة الجودة</small><strong>{presentation.confidenceLabel}</strong></div></article>
          </section>

          <section className="review-breakdown" aria-labelledby="breakdown-title">
            <div className="review-section-head">
              <div>
                <span>المحتوى بالتفصيل</span>
                <h2 id="breakdown-title">إيه اللي موجود فعلًا؟</h2>
              </div>
              <label className="spoiler-toggle">
                <span><strong>من غير حرق</strong><small>نخفي الوقائع ذات السياق الكاشف</small></span>
                <input type="checkbox" checked={spoilerFree} onChange={(event) => setSpoilerFree(event.target.checked)} />
                <i aria-hidden="true"><b /></i>
              </label>
            </div>

            <div className="review-category-list">
              {presentation.categories.map((category) => {
                const isOpen = openCategory === category.id;
                return (
                  <article className={`review-category${isOpen ? " is-open" : ""}`} key={category.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`category-${category.id}`}
                      onClick={() => setOpenCategory(isOpen ? "" : category.id)}
                    >
                      <span className="review-category__icon" aria-hidden="true">{CATEGORY_ICONS[category.id]}</span>
                      <span className="review-category__name"><strong>{category.labelAr}</strong><small>{category.factCountLabel}</small></span>
                      <span className="review-category__level"><i><b style={{ width: `${category.severityPercent}%` }} /></i><em>{category.severityLabel}</em></span>
                      <span className="review-category__arrow" aria-hidden="true">⌄</span>
                    </button>

                    {isOpen && (
                      <div className="review-category__facts" id={`category-${category.id}`}>
                        <div className="review-facts-label"><span>وقائع من النسخة</span><small>التوقيت تقريبي</small></div>
                        {category.facts.length === 0 ? (
                          <div className="review-fact">
                            <time>—</time>
                            <p>لم تُسجل واقعة في هذا المحور ضمن المراجعة المعتمدة.</p>
                          </div>
                        ) : category.facts.map((fact) => {
                          const summary = getFactSummaryForSpoilerMode(fact, spoilerFree);
                          return (
                            <div className="review-fact" key={fact.id}>
                              <time>{formatFactTime(fact.startSecond)}</time>
                              <p>{summary ?? "تفاصيل هذه الواقعة مخفية في وضع «من غير حرق»."}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="review-logic" aria-labelledby="logic-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>الاعتماد مش رقم غامض</span><h2 id="logic-title">إزاي البيانات وصلت للنشر؟</h2></div>
            </div>
            <div className="review-logic-steps">
              <article><b>1</b><div><strong>مراجعات مؤهلة</strong><p>دخل في التقييم {review.reviewerCount} مراجع مؤهل بعد بوابات الجودة والاستقلال المطلوبة.</p></div></article>
              <article><b>2</b><div><strong>اعتماد تحريري</strong><p>آخر اعتماد حالي تم في {presentation.approvedDateLabel}، والصفحة لا تُفتح لو الاعتماد لم يعد جاريًا.</p></div></article>
              <article><b>3</b><div><strong>عرض محافظ</strong><p>نعرض الوقائع والشدة المسجلة كما هي، ومن غير اختراع تفاصيل إضافية عند إخفاء الحرق.</p></div></article>
            </div>
          </section>

          <section className="review-transparency">
            <span className="review-transparency__mark" aria-hidden="true">◎</span>
            <div><strong>لو المعلومة ما بقتش حالية، الصفحة تقفل.</strong><p>تغيير النسخة أو الاعتماد أو وجود بلاغ جوهري نشط يمنع عرض المراجعة بدل ما نكمّل ببيانات قديمة.</p></div>
          </section>
        </div>

        <aside className="review-aside" aria-label="معلومات المراجعة والنسخة">
          <section className="family-result-card">
            <div className="family-result-card__head">
              <div><small>قرار الأسرة</small><strong>يحتاج حدودك أولًا</strong></div>
            </div>

            <div className="family-result-orb is-general">
              <span aria-hidden="true">○</span>
              <small>المراجعة الحالية</small>
              <strong>وقائع بدون حكم شخصي</strong>
              <p>بنحافظ على الفرق بين «ما هو موجود في النسخة» و«هل يناسب أسرتك» لحد ما تختار حدود الأسرة.</p>
            </div>

            <Link href="/#family-profile">الذهاب لحدود الأسرة <span aria-hidden="true">←</span></Link>
          </section>

          <section className="why-card">
            <span>الخلاصة في 20 ثانية</span>
            <h3>إيه اللي نعرفه؟</h3>
            <ul>
              <li><i aria-hidden="true">✓</i><span>{review.reviewerCount} مراجع مؤهل دخل في المراجعة المنشورة.</span></li>
              <li><i aria-hidden="true">!</i><span>أعلى محور حاليًا: {presentation.highestCategoryLabel} — {presentation.highestSeverity}/4.</span></li>
              <li><i aria-hidden="true">✓</i><span>لا يوجد بلاغ جوهري نشط وقت تحميل الصفحة.</span></li>
            </ul>
          </section>

          <section className="version-card">
            <div><span aria-hidden="true">◫</span><strong>النسخة التي راجعناها</strong></div>
            <dl>
              <div><dt>اللغة</dt><dd>{review.version.language}</dd></div>
              <div><dt>المنصة</dt><dd>{review.version.platform}</dd></div>
              <div><dt>المدة</dt><dd>{presentation.runtimeLabel}</dd></div>
              <div><dt>تاريخ النشر</dt><dd>{presentation.publishedDateLabel}</dd></div>
              <div><dt>معرّف المراجعة</dt><dd>{review.bundleId}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="review-end">
        <span aria-hidden="true">✦</span>
        <div><small>نهاية المراجعة الموثقة</small><h2>البيانات دي مرتبطة بالنسخة دي تحديدًا.</h2></div>
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
