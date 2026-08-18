import type { Metadata } from "next";
import Link from "next/link";

import { buildPublicEditorialReviewHref } from "@/lib/editorial-review";
import { listEditorialPublications } from "@/lib/public-editorial-read";
import { buildPublicCatalogTitleHref, PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";

import TitleSearchCombobox from "./search/title-search-combobox";
import TitleArtwork from "./title-artwork";

export const metadata: Metadata = {
  alternates: { canonical: `${PUBLIC_SITE_ORIGIN}/` },
};

export default async function Home() {
  const publications = await listEditorialPublications(4);
  const structuredData = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${PUBLIC_SITE_ORIGIN}/#website`, url: `${PUBLIC_SITE_ORIGIN}/`, name: "قبل المشاهدة", inLanguage: "ar" },
      { "@type": "Organization", "@id": `${PUBLIC_SITE_ORIGIN}/#organization`, name: "قبل المشاهدة", url: `${PUBLIC_SITE_ORIGIN}/` },
    ],
  }).replaceAll("<", "\\u003c");

  return (
    <main className="quality-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <header className="quality-home__header">
        <Link prefetch={false} className="quality-home__brand" href="/">قبل المشاهدة</Link>
        <nav aria-label="التنقل الرئيسي"><Link prefetch={false} href="/titles">دليل العناوين</Link><Link prefetch={false} href="/review-policy">كيف نراجع؟</Link><Link prefetch={false} href="/corrections">التصحيح والبلاغات</Link></nav>
      </header>
      <section className="quality-home__hero" aria-labelledby="home-title">
        <div className="quality-home__hero-copy">
          <span>دليل عربي يساعدك على اتخاذ قرار قبل المشاهدة</span>
          <h1 id="home-title">اعرف ما إذا كان العمل يلائم الإعدادات الحالية لأسرتك، وما الذي يحتاج إلى انتباه.</h1>
          <p>ابحث بالعربية أو الإنجليزية. التحليل الناضج يطلب عمر الطفل وبعض إعدادات الأسرة المحلية ثم يعرض نتيجة عملية، مع إبقاء الوقائع والمصادر والمحاور غير المحسومة واضحة بدل إخفائها أو اعتبارها آمنة.</p>
        </div>
        <div className="quality-home__search"><TitleSearchCombobox /><p>الاقتراحات تأتي من عناوين D1 فقط، والمطابقة التقريبية تظهر بصيغة «هل تقصد؟».</p></div>
      </section>
      <section className="quality-home__published" aria-labelledby="published-title">
        <div className="quality-home__section-head">
          <div><span>المحتوى الحقيقي المنشور</span><h2 id="published-title">تحليلات منشورة حديثًا</h2></div>
          <p>هذه أحدث أربع صفحات منشورة حاليًا من current-head في D1. حالة الحكم العملي موضحة داخل كل تحليل، من دون ادعاء مشاهدة نسخة محددة.</p>
        </div>
        <div className="quality-home__grid">
          {publications.map(({ review, presentation }) => {
            const titleHref = buildPublicCatalogTitleHref(review.titleId);
            return (
              <article className="quality-home__card" key={review.id}>
                <TitleArtwork titleId={review.titleId} className="quality-home__artwork" sizes="(max-width: 680px) 34vw, 150px" />
                <div className="quality-home__card-copy">
                  <span className="quality-home__status">تحليل متعدد المصادر — راجع حالة الحكم</span>
                  <h3>{presentation.titleAr}</h3><p className="quality-home__english" dir="ltr">{presentation.titleEn}</p><p className="quality-home__year">{review.releaseYear}</p>
                  <p>حدّد عمر الطفل والإعدادات المتاحة داخل صفحة التحليل للحصول على نتيجة عملية، مع توضيح الحدود الافتراضية المرتبطة بالعمر.</p>
                  <div className="quality-home__card-actions">{titleHref ? <Link prefetch={false} href={titleHref}>صفحة العمل</Link> : null}<Link prefetch={false} href={buildPublicEditorialReviewHref(review.id)}>اقرأ التحليل والحكم</Link></div>
                </div>
              </article>
            );
          })}
        </div>
        <Link prefetch={false} className="quality-home__policy-link" href="/titles?editorialStatus=editorial">عرض كل التحليلات</Link>
      </section>
      <section className="quality-home__types" aria-labelledby="types-title">
        <div className="quality-home__section-head"><div><span>مستويان للثقة ضمن المسار نفسه</span><h2 id="types-title">ما الفرق بين الحكم العملي وختم النسخة المحددة؟</h2></div></div>
        <div className="quality-home__type-grid">
          <article><strong>حكم عملي للأسرة</strong><p>يعتمد على تحليل تحريري ناضج ومتعدد المصادر وإعدادات محلية: يحدد المستخدم عمر الطفل وحد الخوف وتفضيل تجنب التنمر، بينما تُشتق بقية الحدود من إعدادات افتراضية مرتبطة بالعمر. لا يحوّل المحور غير المحسوم إلى «غير موجود»، ولا يخترع درجة شدة.</p></article>
          <article><strong>مراجعة موثقة لنسخة محددة</strong><p>ترتبط بمنصة ولغة ومدة وبصمة محتوى ومراجعين مستقلين واعتماد وتدقيق. هذه درجة ثقة أعلى عندما نحتاج إلى إثبات دقيق أن الحكم يخص نسخة بعينها.</p></article>
        </div>
        <Link prefetch={false} className="quality-home__policy-link" href="/review-policy">اقرأ سياسة المراجعة كاملة</Link>
      </section>
      <section className="quality-home__principles" aria-label="قواعد الثقة">
        <article><strong>المجهول لا يتحول إلى آمن</strong><p>صمت المصدر لا يتحول إلى «غير موجود». إذا كان المحور غير المحسوم قد يؤثر في النتيجة، تصبح الحالة «يحتاج انتباهك» بدل حكم إيجابي بلا دليل.</p></article>
        <article><strong>المصدر ظاهر</strong><p>نوضح المرجع المرتبط، تاريخ الوصول، وما الذي يدعمه، من غير نسخ مراجعاته أو درجاته.</p></article>
        <article><strong>لا «غير مكتمل» كإجابة دائمة</strong><p>العمل الناضج متعدد المصادر ينتقل إلى حكم عملي للأسرة؛ عدم اكتمال ختم النسخة المحددة لا يلغي وظيفة المنصة الأساسية.</p></article>
      </section>
      <footer className="quality-home__footer"><strong>© قبل المشاهدة</strong><div><Link prefetch={false} href="/privacy">الخصوصية</Link><Link prefetch={false} href="/corrections">التصحيح</Link><Link prefetch={false} href="/titles">الدليل</Link></div></footer>
    </main>
  );
}
