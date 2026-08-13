import Link from "next/link";

import type { PublicPolicyPage as PublicPolicyPageData } from "@/lib/public-policy-pages";
import { PUBLIC_POLICY_NAV } from "@/lib/public-policy-pages";

import styles from "./policy.module.css";

type PublicPolicyPageProps = {
  page: PublicPolicyPageData;
};

export function PublicPolicyPage({ page }: PublicPolicyPageProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="قبل المشاهدة — الرئيسية">
          <span className={styles.brandMark} aria-hidden="true">ق</span>
          <span>
            <strong>قبل المشاهدة</strong>
            <small>دليل عربي للقرار</small>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="صفحات السياسات">
          {PUBLIC_POLICY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.href === page.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>{page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.summary}</p>
        <small>آخر تحديث: {page.updatedAt}</small>
      </section>

      <div className={styles.layout}>
        <aside className={styles.toc} aria-label="محتويات الصفحة">
          <strong>في هذه الصفحة</strong>
          {page.sections.map((section) => (
            <a href={`#${section.id}`} key={section.id}>
              {section.title}
            </a>
          ))}
        </aside>

        <article className={styles.content}>
          {page.notice ? (
            <div className={styles.notice} role="note">
              <strong>ملاحظة حالية</strong>
              <p>{page.notice}</p>
            </div>
          ) : null}

          {page.sections.map((section) => (
            <section className={styles.section} id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items ? (
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </article>
      </div>

      <footer className={styles.footer}>
        <p>هذه الصفحات تصف السلوك الحالي للمنتج، وليست بديلًا عن مراجعة الأسرة للمحتوى بنفسها.</p>
        <div>
          <Link href="/">الرئيسية</Link>
          <Link href="/search">البحث</Link>
        </div>
      </footer>
    </main>
  );
}
