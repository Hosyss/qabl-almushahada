import { searchPublicTitles } from "@/db/public-title-search-service";

const MAX_SUGGESTIONS = 5;

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return Response.json({ suggestions: [] }, { headers: { "cache-control": "no-store" } });
  }

  try {
    const results = await searchPublicTitles({ query });
    const suggestions = results.slice(0, MAX_SUGGESTIONS).map((result) => ({
      id: result.id,
      canonicalName: result.canonicalName,
      originalName: result.originalName,
      kind: result.kind,
      releaseYear: result.releaseYear,
    }));

    return Response.json(
      { suggestions },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return Response.json(
        { suggestions: [], error: "invalid_query" },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    return Response.json(
      { suggestions: [], error: "temporarily_unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
