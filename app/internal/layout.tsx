import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "منطقة داخلية | قبل المشاهدة",
  robots: { index: false, follow: false },
};

export default function InternalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
