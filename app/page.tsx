import Link from "next/link";

import { getEditorialPublicationPresentation } from "@/lib/editorial-publication-presentation";
import { buildPublicEditorialReviewHref } from "@/lib/editorial-review";
import { listEditorialReviewPublications } from "@/lib/editorial-review-registry";
import { buildPublicCatalogTitleHref, PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";

import TitleSearchCombobox from "./search/title-search-combobox";

export default function Home() {
  const publications = listEditorialReviewPublications();
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${PUBLIC_SITE_ORIGIN}/#website`,
        url: `${PUBLIC_SITE_ORIGIN}/`,
        name: "قبل المشاهدة",
        inLanguage: "ar",
      },
      {
        "@type": "Organization",
        "@id": `${PUBLIC_SITE_ORIGIN}/#organization`,
        name: "قبل المشاهدة",
        url: `${PUBLIC_SITE_ORIGIN}/`,
      },
    ],
  }).replaceAll("<", "\\u003c");

  return (
    <main className="quality-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />

      <header className="quality-home__header">
        <Link className="quality-home__brand" href="/">قبل المشاهدة</Link>
        <nav aria-label="التنقل الرئيسي">
          <Link href="/titles">دليل العناوين</Link>
          <Link href="/review-policy">كيف نراجع؟</Link>
          <Link href="/corrections">التصحيح والبلاغات</Link>
        </nav>
      </header>

      <section className="quality-home__hero" aria-labelledby="home-title">
        <div className="quality-home__hero-copy">
          <span>دليل عربي يوضح ما نعرفه وما لا نعرفه</span>
          <h1 id="home-title">اعرف محتوى العمل قبل المشاهدة، من غير حكم متسرع.</h1>
          <p>
            ابحث بالعربي أو الإنجليزي. لو عندنا تحليل تحريري جزئي هنوضح الوقائع ومصادرها،
            ولو لم تكتمل بوابات المراجعة الموثقة فلن نعرض «مناسب» أو «غير مناسب» من عندنا.
          </p>
        </div>
        <div className="quality-home__search">
          <TitleSearchCombobox />
          <p>الاقتراحات تأتي من عناوين D1 فقط، والمطابقة التقريبية تظهر بصيغة «هل تقصد؟».</p>
        </div>
      </section>

      <section className="quality-home__published" aria-labelledby="published-title">
        <div className="quality-home__section-head">
          <div>
            <span>المحتوى الحقيقي المنشور</span>
            <h2 id="published-title">تحليلات منشورة حديثًا</h2>
          </div>
          <p>هذه هي الصفحات الأربع المنشورة حاليًا، ولا نعرض هنا أعمالًا أو أحكامًا تجريبية.</p>
        </div>

        <div className="quality-home__grid">
          {publications.map((review) => {
            const presentation = getEditorialPublicationPresentation(review);
            const titleHref = buildPublicCatalogTitleHref(review.titleId);
            const reviewHref = buildPublicEditorialReviewHref(review.id);
            return (
              <article className="quality-home__card" key={review.id}>
                <span className="quality-home__status">تحليل تحريري جزئي — الحكم غير مكتمل</span>
                <h3>{presentation.titleAr}</h3>
                <p className="quality-home__english" dir="ltr">{presentation.titleEn}</p>
                <p className="quality-home__year">{review.releaseYear}</p>
                <p>
                  وقائع مستخلصة ومتحقق منها من مراجع معلنة. هذا المسار لا يدّعي مشاهدة نسخة محددة ولا يملك سلطة إصدار حكم ملاءمة.
                </p>
                <div className="quality-home__card-actions">
                  {titleHref ? <Link href={titleHref}>صفحة العمل</Link> : null}
                  <Link href={reviewHref}>اقرأ التحليل</Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="quality-home__types" aria-labelledby="types-title">
        <div className="quality-home__section-head">
          <div>
            <span>نوعا المحتوى ليسا شيئًا واحدًا</span>
            <h2 id="types-title">إيه الفرق بين التحليل التحريري والمراجعة الموثقة؟</h2>
          </div>
        </div>
        <div className="quality-home__type-grid">
          <article>
            <strong>تحليل تحريري جزئي للعمل</strong>
            <p>
              يجمع وقائع من مراجع خارجية معلنة ويقارن الإسناد بينها. لا يدّعي أن فريقنا شاهد نسخة بمنصة ولغة ومدة محددة،
              ولا يصدر حكم ملاءمة طالما بقيت محاور غير محسومة.
            </p>
          </article>
          <article>
            <strong>مراجعة موثقة لنسخة محددة</strong>
            <p>
              ترتبط بمنصة ولغة ومدة وبصمة محتوى، ومراجعين مستقلين واعتماد وتدقيق. هذا هو المسار الوحيد الذي يمكنه الوصول
              إلى حكم أسري بعد اجتياز كل البوابات. لا توجد حاليًا مراجعة كاملة مؤهلة للحكم ضمن الصفحات الأربع أعلاه.
            </p>
          </article>
        </div>
        <Link className="quality-home__policy-link" href="/review-policy">اقرأ سياسة المراجعة كاملة</Link>
      </section>

      <section className="quality-home__principles" aria-label="قواعد الثقة">
        <article><strong>لا نعرف؟ نقول لا نعرف</strong><p>صمت المصدر لا يتحول إلى «غير موجود»، والمحور الناقص يظل غير محسوم.</p></article>
        <article><strong>المصدر ظاهر</strong><p>نوضح المرجع المرتبط، تاريخ الوصول، وما الذي يدعمه، من غير نسخ مراجعاته أو درجاته.</p></article>
        <article><strong>القرار له بوابة أعلى</strong><p>وجود تحليل مفيد لا يساوي مراجعة موثقة، ولا يختصر مسار الحكم.</p></article>
      </section>

      <footer className="quality-home__footer">
        <strong>© قبل المشاهدة</strong>
        <div><Link href="/privacy">الخصوصية</Link><Link href="/corrections">التصحيح</Link><Link href="/titles">الدليل</Link></div>
      </footer>
    </main>
  );
}
