"use client";

import { useState } from "react";
import Link from "next/link";

const reviewCategories = [
  {
    id: "fear",
    icon: "◌",
    title: "الخوف والتوتر",
    level: "متوسط",
    score: 56,
    summary: "مطاردتان خياليتان ولحظة انتظار مشحونة، من غير رعب بصري صريح.",
    facts: [
      { time: "00:24", text: "مطاردة قصيرة وسط عاصفة؛ الإيقاع سريع لكن النهاية مطمئنة." },
      { time: "01:07", text: "الشخصيات تختبئ لدقائق مع أصوات مرتفعة قبل زوال الخطر." },
    ],
  },
  {
    id: "violence",
    icon: "◇",
    title: "العنف والإصابة",
    level: "خفيف",
    score: 25,
    summary: "سقوط كرتوني واحتكاكات بسيطة بلا دم أو إصابة ظاهرة.",
    facts: [
      { time: "00:41", text: "سقوط خيالي من ارتفاع منخفض يتبعه نهوض سريع." },
      { time: "01:19", text: "دفع بين شخصيتين في سياق هزلي من غير أثر للإصابة." },
    ],
  },
  {
    id: "language",
    icon: "◎",
    title: "الألفاظ والتنمر",
    level: "خفيف",
    score: 34,
    summary: "سخرية عابرة من شخصية ثم اعتذار واضح داخل القصة.",
    facts: [
      { time: "00:33", text: "لقب ساخر يتكرر مرتين ثم تتدخل شخصية لإيقافه." },
      { time: "00:58", text: "نبرة تهكم قصيرة؛ لا توجد ألفاظ نابية." },
    ],
  },
  {
    id: "themes",
    icon: "✦",
    title: "الموضوعات العاطفية",
    level: "متوسط",
    score: 48,
    summary: "حديث عن الفقد والابتعاد يُقدَّم بنهاية داعمة ومطمئنة.",
    facts: [
      { time: "01:12", text: "حوار عاطفي عن غياب شخص عزيز من غير عرض لحظة الفقد." },
      { time: "01:25", text: "مشهد مصالحة عائلية هادئ ينهي التوتر السابق." },
    ],
  },
];

function ReviewLogo() {
  return (
    <span className="review-logo" aria-hidden="true">
      <i />
      <b />
      <em />
    </span>
  );
}

export default function ReviewPage() {
  const [openCategory, setOpenCategory] = useState("fear");
  const [spoilerFree, setSpoilerFree] = useState(true);
  const [useFamilyLimits, setUseFamilyLimits] = useState(true);

  return (
    <main className="review-page">
      <header className="review-header">
        <Link className="review-brand" href="/" aria-label="قبل المشاهدة — الرئيسية">
          <ReviewLogo />
          <span><strong>قبل المشاهدة</strong><small>قرار أهدى لكل بيت</small></span>
        </Link>
        <Link className="review-back" href="/">الرجوع للرئيسية <span aria-hidden="true">←</span></Link>
      </header>

      <section className="review-title-card" aria-labelledby="review-title">
        <div className="review-poster" aria-hidden="true">
          <span>☁</span>
          <small>نموذج</small>
        </div>

        <div className="review-title-copy">
          <div className="review-title-badges">
            <span className="review-demo-badge">نموذج توضيحي</span>
            <span className="review-type-badge">مغامرة رسوم</span>
          </div>
          <h1 id="review-title">مدينة الغيم</h1>
          <p>فيلم · 2024 · 1 ساعة و32 دقيقة</p>
          <div className="review-version-line">
            <span><i aria-hidden="true">✓</i> النسخة العربية</span>
            <span>منصة العرض التجريبية</span>
            <span>آخر مراجعة: 8 أغسطس 2026</span>
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
              <span>القرار المختصر</span>
              <h2 id="decision-title">مناسب بمرافقة</h2>
              <p>لأن مستوى الخوف والموضوعات العاطفية وصل للحد المختار، بينما العنف والألفاظ ظلّا خفيفين.</p>
            </div>
            <div className="review-age"><small>العمر الإرشادي</small><strong>+9</strong></div>
          </section>

          <section className="review-summary" aria-label="ملخص سريع">
            <article><span aria-hidden="true">◌</span><div><small>أعلى محور</small><strong>الخوف والتوتر</strong></div></article>
            <article><span aria-hidden="true">◫</span><div><small>الوقائع المسجلة</small><strong>8 وقائع</strong></div></article>
            <article><span aria-hidden="true">✓</span><div><small>درجة الثقة</small><strong>مرتفعة</strong></div></article>
          </section>

          <section className="review-breakdown" aria-labelledby="breakdown-title">
            <div className="review-section-head">
              <div>
                <span>المحتوى بالتفصيل</span>
                <h2 id="breakdown-title">إيه اللي موجود فعلًا؟</h2>
              </div>
              <label className="spoiler-toggle">
                <span><strong>من غير حرق</strong><small>نخفي تفاصيل السياق الزائدة</small></span>
                <input type="checkbox" checked={spoilerFree} onChange={(event) => setSpoilerFree(event.target.checked)} />
                <i aria-hidden="true"><b /></i>
              </label>
            </div>

            <div className="review-category-list">
              {reviewCategories.map((category) => {
                const isOpen = openCategory === category.id;
                return (
                  <article className={`review-category${isOpen ? " is-open" : ""}`} key={category.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`category-${category.id}`}
                      onClick={() => setOpenCategory(isOpen ? "" : category.id)}
                    >
                      <span className="review-category__icon" aria-hidden="true">{category.icon}</span>
                      <span className="review-category__name"><strong>{category.title}</strong><small>{category.summary}</small></span>
                      <span className="review-category__level"><i><b style={{ width: `${category.score}%` }} /></i><em>{category.level}</em></span>
                      <span className="review-category__arrow" aria-hidden="true">⌄</span>
                    </button>

                    {isOpen && (
                      <div className="review-category__facts" id={`category-${category.id}`}>
                        <div className="review-facts-label"><span>وقائع من النسخة</span><small>التوقيت تقريبي</small></div>
                        {category.facts.map((fact) => (
                          <div className="review-fact" key={`${category.id}-${fact.time}`}>
                            <time>{fact.time}</time>
                            <p>{spoilerFree ? fact.text : `${fact.text} تظهر نتيجة الموقف كاملة داخل المشهد، مع توضيح رد فعل الشخصيات بعده.`}</p>
                          </div>
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
              <div><span>القرار مش رقم غامض</span><h2 id="logic-title">إزاي وصلنا للنتيجة؟</h2></div>
            </div>
            <div className="review-logic-steps">
              <article><b>1</b><div><strong>وقائع النسخة</strong><p>سجلنا الشدة والتكرار والسياق من النسخة العربية نفسها.</p></div></article>
              <article><b>2</b><div><strong>حدود أسرتك</strong><p>قارنّا الوقائع بعمر 9 سنوات وحد خوف «متوسط» ومنع التنمر.</p></div></article>
              <article><b>3</b><div><strong>قرار مفسَّر</strong><p>ظهر «بمرافقة» لأن محورين لامسا الحد من غير تجاوزه بوضوح.</p></div></article>
            </div>
          </section>

          <section className="review-transparency">
            <span className="review-transparency__mark" aria-hidden="true">◎</span>
            <div><strong>لو المعلومة ناقصة، مش هنكمّل من عندنا.</strong><p>أي اختلاف بين النسخ أو نقص في واقعة أساسية يغيّر الحالة إلى «البيانات غير كافية» لحد ما تتم المراجعة.</p></div>
            <button type="button">بلّغ عن اختلاف في النسخة</button>
          </section>
        </div>

        <aside className="review-aside" aria-label="نتيجة الأسرة ومعلومات النسخة">
          <section className="family-result-card">
            <div className="family-result-card__head">
              <div><small>النتيجة المخصصة</small><strong>حسب حدود أسرتك</strong></div>
              <label className="mini-toggle" aria-label="استخدام حدود الأسرة">
                <input type="checkbox" checked={useFamilyLimits} onChange={(event) => setUseFamilyLimits(event.target.checked)} />
                <i aria-hidden="true"><b /></i>
              </label>
            </div>

            <div className={`family-result-orb${useFamilyLimits ? "" : " is-general"}`}>
              <span aria-hidden="true">{useFamilyLimits ? "⌁" : "○"}</span>
              <small>{useFamilyLimits ? "نتيجة أسرتك" : "النتيجة العامة"}</small>
              <strong>{useFamilyLimits ? "مناسب بمرافقة" : "مناسب غالبًا"}</strong>
              <p>{useFamilyLimits ? "سبب واضح: الخوف عند الحد المختار." : "فعّل حدود الأسرة لنتيجة تناسب بيتك."}</p>
            </div>

            <div className="family-snapshot">
              <div><span>عمر الطفل</span><strong>9 سنوات</strong></div>
              <div><span>حد الخوف</span><strong>متوسط</strong></div>
              <div><span>التنمر</span><strong>ممنوع</strong></div>
            </div>
            <Link href="/#family-profile">تعديل حدود الأسرة <span aria-hidden="true">←</span></Link>
          </section>

          <section className="why-card">
            <span>الخلاصة في 20 ثانية</span>
            <h3>ليه بمرافقة؟</h3>
            <ul>
              <li><i aria-hidden="true">!</i><span>توتر متوسط في مشهدين قصيرين.</span></li>
              <li><i aria-hidden="true">✓</i><span>لا توجد إصابات صريحة أو ألفاظ نابية.</span></li>
              <li><i aria-hidden="true">♥</i><span>النهاية مطمئنة وتحتوي على دعم عائلي.</span></li>
            </ul>
          </section>

          <section className="version-card">
            <div><span aria-hidden="true">◫</span><strong>النسخة التي راجعناها</strong></div>
            <dl>
              <div><dt>اللغة</dt><dd>العربية</dd></div>
              <div><dt>المدة</dt><dd>1:32:18</dd></div>
              <div><dt>تاريخ الفحص</dt><dd>08/08/2026</dd></div>
              <div><dt>معرّف المراجعة</dt><dd>DEMO-024</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <section className="review-end">
        <span aria-hidden="true">✦</span>
        <div><small>نهاية المراجعة التوضيحية</small><h2>دلوقتي القرار مفهوم، ومش محتاج تخمين.</h2></div>
        <Link href="/">ابحث عن عنوان تاني <span aria-hidden="true">←</span></Link>
      </section>
    </main>
  );
}
