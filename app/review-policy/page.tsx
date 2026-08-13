import type { Metadata } from "next";

import { PUBLIC_POLICY_PAGES } from "@/lib/public-policy-pages";
import { PublicPolicyPage } from "../policy-page";

export const metadata: Metadata = {
  title: "سياسة المراجعة | قبل المشاهدة",
  description: "كيف يراجع «قبل المشاهدة» النسخ، ويطبق الاستقلال والتدقيق وبوابات الجودة قبل نشر مراجعة موثقة.",
};

export default function ReviewPolicyPage() {
  return <PublicPolicyPage page={PUBLIC_POLICY_PAGES.review} />;
}
