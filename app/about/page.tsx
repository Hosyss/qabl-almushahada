import type { Metadata } from "next";
import Link from "next/link";

import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { PUBLIC_POLICY_NAV } from "@/lib/public-policy-pages";

import styles from "../policy.module.css";

export const metadata: Metadata = {
  title: "عن قبل المشاهدة",
  description:
    "تعرّف على طريقة عمل قبل المشاهدة، والفرق بين الدليل والتحليل التحريري والحكم العملي للأسرة، وحدود ما يمكن للموقع أن يؤكده.",
  alternates: { canonical: `${PUBLIC_SITE_ORIGIN}/about` },
};

const sections = [
  {
    id: "purpose",
    title: "ما هو «قبل المشاهدة»؟",
    paragraphs: [
      "«قبل المشاهدة» دليل عربي يساعد الأسرة على فهم محتوى فيلم أو مسلسل قبل اتخاذ قرار المشاهدة. الهدف هو عرض معلومات عملية ومحددة عن المحتوى، لا اختصار العمل كله في رقم أو تقييم عام.",
      "الموقع ليس خدمة بث، ولا جهة تصنيف عمري رسمية، ولا يستبدل معرفة الأسرة بحساسية أطفالها أو سياقها الخاص.",
    ],
  },
  {
    id: "layers",
    title: "ثلاث طبقات مختلفة لا نخلط بينها",
    items: [
      "الدليل: يثبت أن العمل موجود في الكتالوج ويعرض بيانات تعريفية عنه. وجود العمل في الدليل لا يعني أنه خضع لمراجعة مكتملة.",
      "التحليل التحريري: يعرض وقائع وملاحظات منشورة عن المحتوى مع حالة الأدلة وحدودها، ولا يحول المعلومة الناقصة إلى تأكيد سلبي.",
      "الحكم العملي للأسرة: يطبّق حدود الأسرة المختارة على ما تسمح به الأدلة المنشورة فقط. إذا لم تكفِ المعلومات، فالنتيجة تبقى غير حاسمة بدل التخمين.",
    ],
  },
  {
    id: "unknown",
    title: "المجهول ليس «لا يوجد»",
    paragraphs: [
      "غياب دليل على نوع من المحتوى لا يعني تلقائيًا أن هذا المحتوى غير موجود. لذلك نحافظ على الفرق بين المعلومة المؤكدة، والمعلومة غير المكتملة، وعدم وجود الواقعة المثبت فعلًا.",
      "هذا المبدأ هو سبب ظهور حالات مثل «البيانات غير كافية» أو «يحتاج إلى انتباه» بدل إعطاء طمأنة لا تدعمها الأدلة.",
    ],
  },
  {
    id: "review",
    title: "كيف تُراجع المعلومات؟",
    paragraphs: [
      "المراجعات الموثقة ترتبط بنسخة محددة من العمل وتخضع لبوابات جودة واستقلال موضحة بالتفصيل في سياسة المراجعة. الصفحة العامة تعيد فحص الحالة عند القراءة، ولا تعتمد حالة قديمة إذا ظهر تعارض أو بلاغ جوهري مفتوح.",
      "التحليل التحريري يحتفظ أيضًا بحدود المصدر ونطاق الدليل. لا ننسب إلى المصدر ما لم يقله، ولا نستخدم الصمت داخل المصدر لإثبات عدم وجود محتوى حساس.",
    ],
  },
  {
    id: "family",
    title: "إعدادات الأسرة",
    paragraphs: [
      "يمكن للأسرة تعديل بعض الحدود التي تؤثر في الحكم العملي، مثل العمر وحد الخوف وخيار تجنب التنمر. ميزة الحفظ الحالية تحتفظ بهذه الإعدادات محليًا في المتصفح، ولا تطلب اسم الطفل أو تاريخ ميلاده.",
      "الحكم العملي ليس تصنيفًا عمريًا رسميًا؛ هو نتيجة مشتقة من حدود الأسرة ومن الأدلة المتاحة لذلك العمل والنسخة.",
    ],
  },
  {
    id: "limits",
    title: "ما الذي لا يفعله الموقع؟",
    items: [
      "لا يعرض أفلامًا أو حلقات ولا يقدم روابط مشاهدة بوصفها جزءًا من خدمة بث.",
      "لا يخترع شدة أو نسخة أو مراجعًا أو بصمة محتوى أو ترخيصًا مفقودًا.",
      "لا يعتبر وجود العمل في الكتالوج مساويًا لاجتياز مراجعة بشرية.",
      "لا يحوّل غياب المعلومة إلى حكم مطمئن.",
      "لا يعد أي تصنيف صادر منه تصنيفًا عمريًا رسميًا عامًا.",
    ],
  },
  {
    id: "transparency",
    title: "الشفافية والتصحيح",
    paragraphs: [
      "يمكنك قراءة سياسة المراجعة وسياسة الخصوصية وسياسة التصحيح لمعرفة القواعد الحالية بالتفصيل. هذه الصفحات تصف السلوك الفعلي للمنتج وتُحدّث عندما يتغير هذا السلوك.",
    ],
  },
] as const;

export default function AboutPage() {
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

        <nav className={styles.nav} aria-label="روابط الشفافية">
          <Link href="/about" aria-current="page">عن الموقع</Link>
          {PUBLIC_POLICY_NAV.map((item) => (
            <Link key={item.href} href={item.href}>{item.label}</Link>
          ))}
        </nav>
      </header>

      <section className={styles.hero}>
        <span className={styles.eyebrow}>عن المشروع</span>
        <h1>كيف يساعدك «قبل المشاهدة»؟</h1>
        <p>
          نعرض ما نعرفه عن محتوى العمل وحدود ما لا نعرفه، ثم نفصل بين بيانات الكتالوج والتحليل المنشور والحكم العملي للأسرة حتى لا تتحول المعلومة الناقصة إلى يقين زائف.
        </p>
        <small>آخر تحديث: 18 أغسطس 2026</small>
      </section>

      <div className={styles.layout}>
        <aside className={styles.toc} aria-label="محتويات الصفحة">
          <strong>في هذه الصفحة</strong>
          {sections.map((section) => (
            <a href={`#${section.id}`} key={section.id}>{section.title}</a>
          ))}
        </aside>

        <article className={styles.content}>
          {sections.map((section) => (
            <section className={styles.section} id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {"paragraphs" in section
                ? section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)
                : null}
              {"items" in section ? (
                <ul>
                  {section.items?.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}

          <section className={styles.section} aria-labelledby="about-links-title">
            <h2 id="about-links-title">اقرأ القواعد بالتفصيل</h2>
            <p>
              <Link href="/review-policy">سياسة المراجعة</Link>
              {" · "}
              <Link href="/privacy">سياسة الخصوصية</Link>
              {" · "}
              <Link href="/corrections">سياسة التصحيح</Link>
            </p>
          </section>
        </article>
      </div>

      <footer className={styles.footer}>
        <p>المعلومة المفيدة تبدأ بتوضيح ما نعرفه وما لا نستطيع تأكيده.</p>
        <div>
          <Link href="/">الرئيسية</Link>
          <Link href="/titles">دليل المحتوى</Link>
        </div>
      </footer>
    </main>
  );
}
