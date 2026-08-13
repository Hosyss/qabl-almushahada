import { listPublicCatalogTitles } from "@/db/public-catalog-service";
import { buildPublicEditorialReviewCanonicalUrl } from "@/lib/editorial-review";
import { listEditorialReviewPublications } from "@/lib/editorial-review-registry";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";

export async function GET() {
  try {
    const titles = await listPublicCatalogTitles(500);
    const editorialReviews = listEditorialReviewPublications();
    const urls = [
      `<url><loc>${PUBLIC_SITE_ORIGIN}/</loc></url>`,
      `<url><loc>${PUBLIC_SITE_ORIGIN}/titles</loc></url>`,
      ...titles.map(
        (title) =>
          `<url><loc>${PUBLIC_SITE_ORIGIN}/title/${title.qid}</loc><lastmod>${title.retrievedAt.slice(0, 10)}</lastmod></url>`,
      ),
      ...editorialReviews.map(
        (review) =>
          `<url><loc>${buildPublicEditorialReviewCanonicalUrl(review.id)}</loc><lastmod>${review.publishedAt.slice(0, 10)}</lastmod></url>`,
      ),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=1800",
      },
    });
  } catch {
    return new Response("Catalog sitemap is temporarily unavailable.\n", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
