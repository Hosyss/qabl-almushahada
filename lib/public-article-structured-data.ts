import { PUBLIC_SITE_ORIGIN } from "./public-catalog";

type PublicArticleStructuredDataInput = Readonly<{
  headline: string;
  description: string;
  canonical: string;
  datePublished: string;
  dateModified?: string;
}>;

export function buildPublicArticleStructuredData(input: PublicArticleStructuredDataInput): string {
  const headline = requireText(input.headline, "headline");
  const description = requireText(input.description, "description");
  const canonical = requirePublicCanonical(input.canonical);
  const datePublished = requireIsoDate(input.datePublished, "datePublished");
  const dateModified = input.dateModified ? requireIsoDate(input.dateModified, "dateModified") : undefined;

  const payload = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    inLanguage: "ar",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    author: {
      "@type": "Organization",
      name: "قبل المشاهدة",
      url: PUBLIC_SITE_ORIGIN,
    },
    publisher: {
      "@type": "Organization",
      name: "قبل المشاهدة",
      url: PUBLIC_SITE_ORIGIN,
    },
    datePublished,
    ...(dateModified ? { dateModified } : {}),
  };

  return JSON.stringify(payload).replaceAll("<", "\\u003c");
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required for public Article structured data.`);
  return normalized;
}

function requirePublicCanonical(value: string): string {
  const normalized = requireText(value, "canonical");
  const url = new URL(normalized);
  if (url.origin !== PUBLIC_SITE_ORIGIN || url.protocol !== "https:") {
    throw new Error("Article canonical must use the public site origin.");
  }
  return url.toString();
}

function requireIsoDate(value: string, field: string): string {
  const normalized = requireText(value, field);
  const timestamp = Date.parse(normalized);
  if (!Number.isFinite(timestamp)) throw new Error(`${field} must be a valid ISO-compatible date.`);
  return normalized;
}
