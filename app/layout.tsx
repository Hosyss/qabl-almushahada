import type { Metadata } from "next";
import "./globals.css";
import "./home-search-upgrade.css";
import { HomeSearchUpgrade } from "./home-search-upgrade";
import { PolicyLinks } from "./policy-links";

export const metadata: Metadata = {
  title: "قبل المشاهدة",
  description: "دليل عربي يساعد الأسرة على فهم محتوى الأفلام والمسلسلات واتخاذ قرار مشاهدة واضح ومطمئن.",
  other: {
    "codex-preview": "development",
  },
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
        <HomeSearchUpgrade />
        <PolicyLinks />
      </body>
    </html>
  );
}
