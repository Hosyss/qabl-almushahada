import { PUBLIC_SITE_ORIGIN } from "@/lib/public-catalog";

export function GET() {
  const body = `User-agent: *\nAllow: /\nDisallow: /internal\nDisallow: /api/\nSitemap: ${PUBLIC_SITE_ORIGIN}/sitemap.xml\n`;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
