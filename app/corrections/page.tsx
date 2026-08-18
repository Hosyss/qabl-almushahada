import type { Metadata } from "next";

import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { PUBLIC_POLICY_PAGES } from "@/lib/public-policy-pages";
import { PublicPolicyPage } from "../policy-page";

export const metadata: Metadata = {
  title: "سياسة التصحيح | قبل المشاهدة",
  description: "كيف يوقف البلاغ الجوهري المراجعة الموثقة، وكيف تُحفظ revisions ويُعاد الاعتماد بعد التصحيح.",
  alternates: { canonical: `${PUBLIC_SITE_ORIGIN}/corrections` },
};

export default function CorrectionsPolicyPage() {
  return <PublicPolicyPage page={PUBLIC_POLICY_PAGES.corrections} />;
}
