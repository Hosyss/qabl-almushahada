import type { Metadata } from "next";

import { PUBLIC_POLICY_PAGES } from "@/lib/public-policy-pages";
import { PublicPolicyPage } from "../policy-page";

export const metadata: Metadata = {
  title: "سياسة الخصوصية | قبل المشاهدة",
  description: "ما الذي يُحفظ محليًا في «قبل المشاهدة»، وما الذي يمر عبر الخادم، وما الذي لا نطلبه من الأسرة.",
};

export default function PrivacyPolicyPage() {
  return <PublicPolicyPage page={PUBLIC_POLICY_PAGES.privacy} />;
}
