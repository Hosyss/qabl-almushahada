import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "البحث | قبل المشاهدة",
  description: "ابحث في دليل «قبل المشاهدة» بالاسم العربي أو الإنجليزي مع نتائج محافظة وحالة المراجعة الحالية.",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
};

export default function SearchLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
