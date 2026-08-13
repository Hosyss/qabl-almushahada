import type { Metadata } from "next";

import { PUBLIC_POLICY_PAGES } from "@/lib/public-policy-pages";
import { PublicPolicyPage } from "../policy-page";

export const metadata: Metadata = {
  title: "سياسة التصحيح | قبل المشاهدة",
  description: "كيف يوقف البلاغ الجوهري المراجعة الموثقة، وكيف تُحفظ revisions ويُعاد الاعتماد بعد التصحيح.",
};

export default function CorrectionsPolicyPage() {
  return <PublicPolicyPage page={PUBLIC_POLICY_PAGES.corrections} />;
}
