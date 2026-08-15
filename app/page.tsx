import Link from "next/link";

import { buildPublicEditorialReviewHref } from "@/lib/editorial-review";
import { listEditorialPublications } from "@/lib/public-editorial-read";
import { buildPublicCatalogTitleHref, PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";

import TitleSearchCombobox from "./search/title-search-combobox";
import TitleArtwork from "./title-artwork";

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
        <Link className="quality-home__brand" href="/">قبل المشاهدة</Link>
        <nav aria-label="التنقل الرئيسي"><Link href="/titles">دليل العناوين</Link><Link href="/review-policy">كيف نراجع؟</Link><Link href="/corrections">التصحيح والبلاغات</Link></nav>
      </header>
      <section className="quality-home__hero" aria-labelledby="home-title">
        <div className="quality-home__hero-copy">
          <span>دليل عربي يساعدك تاخد قرار قبل المشاهدة</span>
          <h1 id="home-title">اعرف هل العمل ينفع للمشاهدة، وإيه اللي محتاج انتباه.</h1>
          <p>ابحث بالعربي أو الإنجليزي. التحليل التحريري الناضج يصدر حكمًا عمليًا على مستوى العمل، ويعرض الوقائع والمصادر والمحاور التي ما زالت غير محسومة بدل ما يخفيها.</p>
        </div>
        <div className="quality-home__search"><TitleSearchCombobox /><p>الاقتراحات تأتي من عناوين D1 فقط، والمطابقة التقريبية تظهر بصيغة «هل تقصد؟».</p></div>
      </section>
      <section className="quality-home__published" aria-labelledby="published-title">
        <div className="quality-home__section-head">
          <div><span>المحتوى الحقيقي المنشور</span><h2 id="published-title">تحليلات منشورة حديثًا</h2></div>
          <p>هذه أحدث أربع صفحات منشورة حاليًا من current-head في D1، وكل صفحة ناضجة تعرض حكمًا عمليًا على مستوى العمل من غير ادعاء مشاهدة نسخة محددة.</p>
        </div>
        <div className="quality-home__grid">
          {publications.map(({ review, presentation }) => {
            const titleHref = buildPublicCatalogTitleHref(review.titleId);
            return (
              <article className="quality-home__card" key={review.id}>
                <TitleArtwork titleId={review.titleId} className="quality-home__artwork" sizes="(max-width: 680px) 34vw, 150px" />
                <div className="quality-home__card-copy">
                  <span className="quality-home__status">تحليل متعدد المصادر — حكم عملي متاح</span>
                  <h3>{presentation.titleAr}</h3><p className="quality-home__english" dir="ltr">{presentation.titleEn}</p><p className="quality-home__year">{review.releaseYear}</p>
                  <p>نوضح ما ثبت وجوده، وما بقي غير محسوم، ونفصل الحكم العملي عن ختم الثقة الأعلى لنسخة مشاهدة محددة.</p>
                  <div className="quality-home__card-actions">{titleHref ? <Link href={titleHref}>صفحة العمل</Link> : null}<Link href={buildPublicEditorialReviewHref(review.id)}>اقرأ التحليل والحكم</Link></div>
                </div>
              </article>
            );
          })}
        </div>
        <Link className="quality-home__policy-link" href="/titles?editorialStatus=editorial">عرض كل التحليلات</Link>
      </section>
      <section className="quality-home__types" aria-labelledby="types-title">
        <div className="quality-home__section-head"><div><span>مستويان للثقة، مش منتجان منفصلان</span><h2 id="types-title">إيه الفرق بين الحكم العملي وختم النسخة المحددة؟</h2></div></div>
        <div className="quality-home__type-grid">
          <article><strong>حكم عملي على مستوى العمل</strong><p>يعتمد على تحليل تحريري ناضج ومتعدد المصادر. يجيب «ينفع للمشاهدة ولا لأ؟» مع إبقاء المحاور غير المحسومة ظاهرة، ومن غير اختراع Severity أو تحويل المجهول إلى «لا يوجد».</p></article>
          <article><strong>مراجعة موثقة لنسخة محددة</strong><p>ترتبط بمنصة ولغة ومدة وبصمة محتوى ومراجعين مستقلين واعتماد وتدقيق. دي درجة ثقة أعلى عندما نحتاج إثباتًا دقيقًا أن الحكم يخص نسخة بعينها.</p></article>
        </div>
        <Link className="quality-home__policy-link" href="/review-policy">اقرأ سياسة المراجعة كاملة</Link>
      </section>
      <section className="quality-home__principles" aria-label="قواعد الثقة">
        <article><strong>المجهول ما بيتحولش لآمن</strong><p>صمت المصدر لا يتحول إلى «غير موجود»، لكن المحور المجهول لا يمسح الحكم العملي كله في عمل ناضج.</p></article>
        <article><strong>المصدر ظاهر</strong><p>نوضح المرجع المرتبط، تاريخ الوصول، وما الذي يدعمه، من غير نسخ مراجعاته أو درجاته.</p></article>
        <article><strong>درجة الثقة واضحة</strong><p>نفرق بين حكم عملي على مستوى العمل وبين ختم أعلى لنسخة مشاهدة محددة، بدل استخدام «غير مكتمل» كإجابة دائمة.</p></article>
      </section>
      <footer className="quality-home__footer"><strong>© قبل المشاهدة</strong><div><Link href="/privacy">الخصوصية</Link><Link href="/corrections">التصحيح</Link><Link href="/titles">الدليل</Link></div></footer>
    </main>
  );
}