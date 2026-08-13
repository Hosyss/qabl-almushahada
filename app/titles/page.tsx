import type { Metadata } from "next";
import Link from "next/link";

import { listPublicCatalogTitles } from "@/db/public-catalog-service";
import {
  buildPublicCatalogTitleHref,
  PUBLIC_SITE_ORIGIN,
} from "@/lib/public-catalog";

import styles from "../title/catalog.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "دليل الأفلام والمسلسلات | قبل المشاهدة",
  description:
    "دليل عناوين حقيقي مبني على بيانات Wikidata المرخصة CC0. وجود العمل في الدليل لا يعني وجود مراجعة ملاءمة منشورة.",
  alternates: {
    canonical: `${PUBLIC_SITE_ORIGIN}/titles`,
  },
};

export default async function TitlesPage() {
  let titles = [] as Awaited<ReturnType<typeof listPublicCatalogTitles>>;
  let unavailable = false;
  try {
    titles = await listPublicCatalogTitles(200);
  } catch {
    unavailable = true;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link className={styles.brand} href="/">قبل المشاهدة</Link>
          <Link className={styles.back} href="/search">البحث في الدليل</Link>
        </header>

        <section className={styles.hero}>
          <span className={styles.kicker}>كتالوج قانوني قابل للتتبع</span>
          <h1>دليل الأفلام والمسلسلات</h1>
          <p>
            هذه الصفحات مبنية على metadata من Wikidata تحت CC0. تسجيل العمل هنا يثبت وجوده في الكتالوج فقط؛
            لا يعني أننا نشرنا مراجعة محتوى أو حكم ملاءمة للأسرة.
          </p>
        </section>

        {unavailable ? (
          <section className={`${styles.notice} ${styles.empty}`}>
            <h2>الدليل غير متاح مؤقتًا</h2>
            <p>تعذّر تحميل بيانات الكتالوج الآن. لم نستبدلها ببيانات تجريبية.</p>
          </section>
        ) : titles.length === 0 ? (
          <section className={`${styles.notice} ${styles.empty}`}>
            <h2>لا توجد عناوين production بعد</h2>
            <p>لن نملأ هذه الصفحة بمراجعات أو أعمال مصطنعة. تظهر العناوين فقط بعد استيراد قانوني موثق.</p>
          </section>
        ) : (
          <section className={styles.grid} aria-label="عناوين الكتالوج">
            {titles.map((title) => {
              const href = buildPublicCatalogTitleHref(title.titleId);
              if (!href) return null;
              return (
                <article className={styles.card} key={title.titleId}>
                  <span className={styles.badge}>{title.kind === "movie" ? "فيلم" : "مسلسل"}</span>
                  <h2>{title.canonicalName}</h2>
                  {title.originalName && title.originalName !== title.canonicalName ? (
                    <p dir="auto">{title.originalName}</p>
                  ) : null}
                  <div className={styles.meta}>
                    <span>{title.releaseYear}</span>
                    <span>Wikidata</span>
                    <span>CC0 1.0</span>
                  </div>
                  <Link className={styles.cardLink} href={href}>فتح صفحة العنوان ←</Link>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
