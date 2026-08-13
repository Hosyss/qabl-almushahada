import { NextResponse } from "next/server";

import { searchPublicTitleDiscovery } from "@/db/public-title-search-service";
import { buildPublicCatalogTitleHref } from "@/lib/public-catalog";
import {
  formatPublicTitleSuggestionLabel,
  getPublicTitleDisplayNames,
  MAX_PUBLIC_TITLE_SEARCH_QUERY_LENGTH,
} from "@/lib/public-title-search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const queryValues = url.searchParams.getAll("q");
  if (queryValues.length > 1 || [...url.searchParams.keys()].some((key) => key !== "q")) {
    return NextResponse.json({ error: "invalid_search_request", suggestions: [] }, { status: 400, headers: safeHeaders() });
  }

  const rawQuery = queryValues[0] ?? "";
  if (rawQuery.trim().length < 2) {
    return NextResponse.json({ mode: "empty", suggestions: [] }, { headers: safeHeaders() });
  }
  if (rawQuery.length > MAX_PUBLIC_TITLE_SEARCH_QUERY_LENGTH * 2) {
    return NextResponse.json({ error: "invalid_query", suggestions: [] }, { status: 400, headers: safeHeaders() });
  }

  try {
    const discovery = await searchPublicTitleDiscovery({ query: rawQuery });
    const source = discovery.matches.length > 0 ? discovery.matches : discovery.didYouMean;
    const mode = discovery.matches.length > 0 ? "matches" : discovery.didYouMean.length > 0 ? "did_you_mean" : "none";
    const suggestions = source.slice(0, 5).flatMap((result) => {
      const href = buildPublicCatalogTitleHref(result.id);
      if (!href) return [];
      const names = getPublicTitleDisplayNames(result);
      return [{
        id: result.id,
        arabicName: names.arabicName,
        englishName: names.englishName,
        releaseYear: result.releaseYear,
        kind: result.kind,
        href,
        displayLabel: formatPublicTitleSuggestionLabel(result),
        matchKind: result.matchKind,
      }];
    });
    return NextResponse.json({ mode, suggestions }, { headers: safeHeaders() });
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return NextResponse.json({ error: "invalid_query", suggestions: [] }, { status: 400, headers: safeHeaders() });
    }
    return NextResponse.json({ error: "search_unavailable", suggestions: [] }, { status: 503, headers: safeHeaders() });
  }
}

function safeHeaders() {
  return { "cache-control": "no-store", "x-content-type-options": "nosniff" };
}
