import type { Metadata } from "next";
import "./globals.css";
import "./home-search-upgrade.css";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";
import { PolicyLinks } from "./policy-links";

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_ORIGIN),
  title: "قبل المشاهدة",
  description: "دليل عربي يساعد الأسرة على فهم محتوى الأفلام والمسلسلات واتخاذ قرار مشاهدة واضح ومطمئن.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <PolicyLinks />
      </body>
    </html>
  );
}
