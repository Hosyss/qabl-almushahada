"use client";

import Link from "next/link";
import { useState } from "react";

import type { ContentCategory } from "@/lib/review-engine";
import type {
  PublicEvidenceReviewFact,
  PublicEvidenceReviewView,
} from "@/lib/public-evidence-review";
import { formatFactTime, getFactSummaryForSpoilerMode } from "@/lib/public-review-presentation";

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

const KIND_LABELS: Record<PublicEvidenceReviewView["title"]["kind"], string> = {
  movie: "فيلم",
  series: "مسلسل",
  episode: "حلقة",
  special: "عمل خاص",
};

export default function EvidenceReviewClient({ review }: { review: PublicEvidenceReviewView }) {
  const highest = review.highestCategory
    ? review.categories.find((category) => category.id === review.highestCategory) ?? null
    : null;
  const firstOpenCategory = highest?.id ?? review.categories[0]?.id ?? "";
  const [openCategory, setOpenCategory] = useState<string>(firstOpenCategory);
  const [spoilerFree, setSpoilerFree] = useState(true);
  const highestSeverity = highest?.severity ?? 0;
  const kindLabel = KIND_LABELS[review.title.kind];

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
          <small>أدلة</small>
        </div>
        <div className="review-title-copy">
          <div className="review-title-badges">
            <span className="review-demo-badge">مراجعة مبنية على أدلة</span>
            <span className="review-type-badge">{kindLabel}</span>
          </div>
          <h1 id="review-title">{review.title.canonicalName}</h1>
          <p>
            {kindLabel} · {review.title.releaseYear} · {formatRuntime(review.version.runtimeSeconds)}
            {review.title.originalName && review.title.originalName !== review.title.canonicalName
              ? ` · ${review.title.originalName}`
              : ""}
          </p>
          <div className="review-version-line">
            <span><i aria-hidden="true">✓</i> {review.version.editionLabel}</span>
            <span>{review.version.platform}</span>
            <span>نُشرت: {formatDate(review.publishedAt)}</span>
          </div>
        </div>
        <div className="review-verification">
          <span className="review-verification__icon" aria-hidden="true">◎</span>
          <span><small>حالة البيانات</small><strong>أدلة مرخصة قابلة للتتبع</strong></span>
        </div>
      </section>

      <div className="review-layout">
        <div className="review-content">
          <section className="review-decision" aria-labelledby="decision-title">
            <div className="review-decision__mark" aria-hidden="true">⌁</div>
            <div>
              <span>ملخص المراجعة</span>
              <h2 id="decision-title">وقائع مستقلة من أدلة مرخصة</h2>
              <p>{review.disclosureAr}</p>
            </div>
            <div className="review-age"><small>أعلى شدة</small><strong>{highestSeverity}/4</strong></div>
          </section>

          <section className="review-summary" aria-label="ملخص سريع">
            <article><span aria-hidden="true">◎</span><div><small>المصادر</small><strong>{review.sourceCount} مصدر</strong></div></article>
            <article><span aria-hidden="true">◫</span><div><small>الوقائع المنشورة</small><strong>{review.factCount} واقعة</strong></div></article>
            <article><span aria-hidden="true">✓</span><div><small>المشاهدة البشرية</small><strong>غير مدعاة</strong></div></article>
          </section>

          <section className="review-breakdown" aria-labelledby="breakdown-title">
            <div className="review-section-head">
              <div><span>المحتوى بالتفصيل</span><h2 id="breakdown-title">إيه اللي تثبته الأدلة؟</h2></div>
              <label className="spoiler-toggle">
                <span><strong>من غير حرق</strong><small>نخفي الوقائع ذات السياق الكاشف</small></span>
                <input type="checkbox" checked={spoilerFree} onChange={(event) => setSpoilerFree(event.target.checked)} />
                <i aria-hidden="true"><b /></i>
              </label>
            </div>

            <div className="review-category-list">
              {review.categories.map((category) => {
                const isOpen = openCategory === category.id;
                return (
                  <article className={`review-category${isOpen ? " is-open" : ""}`} key={category.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`evidence-category-${category.id}`}
                      onClick={() => setOpenCategory(isOpen ? "" : category.id)}
                    >
                      <span className="review-category__icon" aria-hidden="true">{CATEGORY_ICONS[category.id]}</span>
                      <span className="review-category__name">
                        <strong>{category.labelAr}</strong>
                        <small>{category.coverage === "present" ? `${category.facts.length} واقعة مدعومة` : "تغطية صريحة: غير موجود في الأدلة المقبولة"}</small>
                      </span>
                      <span className="review-category__level">
                        <i><b style={{ width: `${category.severity * 25}%` }} /></i>
                        <em>{category.severity === 0 ? "غير موجود" : `شدة ${category.severity} من 4`}</em>
                      </span>
                      <span className="review-category__arrow" aria-hidden="true">⌄</span>
                    </button>

                    {isOpen && (
                      <div className="review-category__facts" id={`evidence-category-${category.id}`}>
                        <div className="review-facts-label"><span>وقائع مرتبطة بالمصدر</span><small>لا نخترع توقيتًا غير موجود</small></div>
                        {category.facts.length === 0 ? (
                          <div className="review-fact"><time>—</time><p>المصادر المقبولة تحسم هذا المحور كعدم وجود ضمن snapshot المنشورة.</p></div>
                        ) : category.facts.map((fact) => (
                          <EvidenceFactRow fact={fact} spoilerFree={spoilerFree} key={fact.id} />
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="review-logic" aria-labelledby="logic-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>النشر له بوابة مستقلة</span><h2 id="logic-title">إزاي المراجعة دي وصلت للنشر؟</h2></div>
            </div>
            <div className="review-logic-steps">
              <article><b>1</b><div><strong>مصادر مرخصة</strong><p>كل claim منشورة مرتبطة بمصدر analysis evidence محفوظ برخصته وعزوه ونسخته.</p></div></article>
              <article><b>2</b><div><strong>Coverage وتعارض</strong><p>كل محور لازم يكون محسومًا صراحة، والتعارض أو عدم اليقين يمنع النشر بدل التخمين.</p></div></article>
              <article><b>3</b><div><strong>Snapshot غير قابلة للمحو</strong><p>قاعدة البيانات نفسها تمنع تثبيت النسخة الحالية إن كانت الأدلة ناقصة أو غير صالحة.</p></div></article>
            </div>
          </section>

          <section className="review-transparency">
            <span className="review-transparency__mark" aria-hidden="true">◎</span>
            <div><strong>لا ندّعي مشاهدة بشرية لم تحدث.</strong><p>هذه مراجعة evidence-based. مسار المراجعة البشرية منفصل، ولا نستخدم reviewer وهميًا لتمرير بواباته.</p></div>
          </section>

          <section className="review-logic" aria-labelledby="sources-title">
            <div className="review-section-head review-section-head--simple">
              <div><span>الشفافية والترخيص</span><h2 id="sources-title">مصادر الأدلة</h2></div>
            </div>
            <div className="review-logic-steps">
              {review.sources.map((source, index) => (
                <article key={source.id}>
                  <b>{index + 1}</b>
                  <div>
                    <strong>{source.sourceKey === "wikipedia" ? "Wikipedia" : source.sourceKey}</strong>
                    <p>{source.attributionText ?? "مصدر دليل مرخص محفوظ في snapshot المنشورة."}</p>
                    <p>
                      <a href={source.sourceUrl} target="_blank" rel="noreferrer">فتح المصدر</a>
                      {" · "}
                      <a href={source.licenseUrl} target="_blank" rel="noreferrer">{source.sourceLicense}</a>
                      {source.sourceRevision ? ` · revision ${source.sourceRevision}` : ""}
                      {source.shareAlike ? " · ShareAlike" : ""}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="review-aside" aria-label="معلومات المراجعة والنسخة">
          <section className="family-result-card">
            <div className="family-result-card__head"><div><small>قرار الأسرة</small><strong>يحتاج حدودك أولًا</strong></div></div>
            <div className="family-result-orb is-general">
              <span aria-hidden="true">○</span><small>المراجعة الحالية</small><strong>وقائع قبل الحكم</strong>
              <p>النشر يحسم الوقائع التي تسمح بها الأدلة؛ قرار الملاءمة يظل منفصلًا ويستخدم حدود الأسرة.</p>
            </div>
            <Link href="/#family-profile">الذهاب لحدود الأسرة <span aria-hidden="true">←</span></Link>
          </section>

          <section className="why-card">
            <span>الخلاصة في 20 ثانية</span><h3>إيه اللي نعرفه؟</h3>
            <ul>
              <li><i aria-hidden="true">✓</i><span>{review.sourceCount} مصدر evidence مرخص داخل snapshot الحالية.</span></li>
              <li><i aria-hidden="true">!</i><span>أعلى محور: {highest?.labelAr ?? "لا توجد وقائع"} — {highestSeverity}/4.</span></li>
              <li><i aria-hidden="true">✓</i><span>لا توجد هوية reviewer بشرية مصطنعة في هذا المسار.</span></li>
            </ul>
          </section>

          <section className="version-card">
            <div><span aria-hidden="true">◫</span><strong>النسخة المرتبطة بالأدلة</strong></div>
            <dl>
              <div><dt>اللغة</dt><dd>{review.version.language}</dd></div>
              <div><dt>المنصة</dt><dd>{review.version.platform}</dd></div>
              <div><dt>المدة</dt><dd>{formatRuntime(review.version.runtimeSeconds)}</dd></div>
              <div><dt>تاريخ النشر</dt><dd>{formatDate(review.publishedAt)}</dd></div>
              <div><dt>معرّف النشر</dt><dd>{review.publicationId}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="review-end">
        <span aria-hidden="true">✦</span>
        <div><small>نهاية المراجعة المبنية على الأدلة</small><h2>كل claim هنا مربوطة بدليل مرخص داخل snapshot الحالية.</h2></div>
        <Link href="/search">ابحث عن عنوان تاني <span aria-hidden="true">←</span></Link>
      </section>
    </main>
  );
}

function EvidenceFactRow({ fact, spoilerFree }: { fact: PublicEvidenceReviewFact; spoilerFree: boolean }) {
  const summary = getFactSummaryForSpoilerMode(
    {
      id: fact.id,
      severity: fact.severity,
      startSecond: fact.startSecond ?? 0,
      endSecond: fact.endSecond ?? 0,
      frequency: fact.frequency === "unknown" ? "single" : fact.frequency,
      context: fact.context === "unknown" ? "neutral" : fact.context,
      spoilerLevel: fact.spoilerLevel,
      summary: fact.summary,
    },
    spoilerFree,
  );
  return (
    <div className="review-fact">
      <time>{fact.startSecond === null ? "—" : formatFactTime(fact.startSecond)}</time>
      <p>{summary ?? "تفاصيل هذه الواقعة مخفية في وضع «من غير حرق»."} <small>({fact.sourceLocator})</small></p>
    </div>
  );
}

function formatRuntime(totalSeconds: number): string {
  return formatFactTime(totalSeconds);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ar-EG", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function ReviewLogo() {
  return <span className="review-logo" aria-hidden="true"><i /><b /><em /></span>;
}
