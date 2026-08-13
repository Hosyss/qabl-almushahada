import { getEditorialPublicationPresentation } from "@/lib/editorial-publication-presentation";
import { buildPublicEditorialReviewCanonicalUrl } from "@/lib/editorial-review";
import { listEditorialReviewPublications } from "@/lib/editorial-review-registry";
import { buildPublicCatalogTitleHref, PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";

export async function GET() {
  const editorialReviews = listEditorialReviewPublications();
  const urls = [
    `<url><loc>${PUBLIC_SITE_ORIGIN}/</loc></url>`,
    `<url><loc>${PUBLIC_SITE_ORIGIN}/titles</loc></url>`,
    `<url><loc>${PUBLIC_SITE_ORIGIN}/review-policy</loc></url>`,
    `<url><loc>${PUBLIC_SITE_ORIGIN}/corrections</loc></url>`,
    `<url><loc>${PUBLIC_SITE_ORIGIN}/privacy</loc></url>`,
    ...editorialReviews.flatMap((review) => {
      const presentation = getEditorialPublicationPresentation(review);
      const lastmod = presentation.updatedAt.slice(0, 10);
      const titleHref = buildPublicCatalogTitleHref(review.titleId);
      return [
        ...(titleHref ? [`<url><loc>${PUBLIC_SITE_ORIGIN}${titleHref}</loc><lastmod>${lastmod}</lastmod></url>`] : []),
        `<url><loc>${buildPublicEditorialReviewCanonicalUrl(review.id)}</loc><lastmod>${lastmod}</lastmod></url>`,
      ];
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=1800",
    },
  });
}
