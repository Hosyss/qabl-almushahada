import type { Metadata } from "next";

import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { PUBLIC_POLICY_PAGES, type PublicPolicyPage as PublicPolicyPageData } from "@/lib/public-policy-pages";
import { PublicPolicyPage } from "../policy-page";

export const metadata: Metadata = {
  title: "سياسة المراجعة | قبل المشاهدة",
  description: "الفرق بين التحليل التحريري الجزئي والمراجعة الموثقة لنسخة محددة، وبوابات الاستقلال والتدقيق قبل أي حكم أسري.",
  alternates: { canonical: `${PUBLIC_SITE_ORIGIN}/review-policy` },
};

const base = PUBLIC_POLICY_PAGES.review;
const reviewPage: PublicPolicyPageData = {
  ...base,
  summary:
    "نفرّق بوضوح بين تحليل تحريري جزئي للعمل، وبين مراجعة موثقة لنسخة محددة. التحليل الجزئي يعرض وقائع من مراجع معلنة من غير ادعاء مشاهدة نسخة بعينها، بينما الحكم الأسري لا يمر إلا من مسار النسخة المحددة والاستقلال والاعتماد والتدقيق.",
  sections: [
    {
      id: "content-types",
      title: "نوعان مختلفان من المحتوى",
      paragraphs: [
        "التحليل التحريري الجزئي للعمل يجمع وقائع عامة من مراجع خارجية معلنة ويبيّن قوة الإسناد وما بقي غير محسوم. هذا المسار لا يدّعي أن فريقنا شاهد منصة أو لغة أو مدة أو بصمة محتوى محددة، ولا يصدر حكم ملاءمة.",
        "المراجعة الموثقة لنسخة محددة ترتبط بمنصة ولغة ومدة وبصمة محتوى ومراجعين مستقلين واعتماد وتدقيق. هذه فقط هي الدورة التي يمكنها الوصول إلى قرار أسري بعد اكتمال كل البوابات.",
      ],
    },
    ...base.sections.map((section) => {
      if (section.id !== "limits") return section;
      return {
        ...section,
        paragraphs: [
          "«قبل المشاهدة» دليل قرار أسري مبني على وقائع مراجعة، وليس جهة تصنيف عمري رسمية ولا بديلًا عن معرفة الوالدين بحساسية أطفالهم.",
          "وجود عنوان في الكتالوج أو وجود تحليل تحريري جزئي لا يعني اكتمال مراجعة موثقة لنسخة محددة، ولا يسمح بعرض حكم «مناسب» أو «غير مناسب» من دون البوابات المطلوبة.",
        ],
      };
    }),
  ],
};

export default function ReviewPolicyPage() {
  return <PublicPolicyPage page={reviewPage} />;
}
