"use server";

import { searchPublicTitles } from "@/db/public-title-search-service";
import type { PublicTitleSearchResult } from "@/lib/public-title-search";

export type PublicTitleSearchActionResult =
  | { ok: true; results: PublicTitleSearchResult[] }
  | { ok: false; code: "INVALID_QUERY" | "SEARCH_UNAVAILABLE"; messageAr: string };

export async function searchPublicTitlesAction(query: string): Promise<PublicTitleSearchActionResult> {
  try {
    return { ok: true, results: await searchPublicTitles({ query }) };
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      return {
        ok: false,
        code: "INVALID_QUERY",
        messageAr: "اكتب اسمًا أوضح للفيلم أو المسلسل، من حرفين على الأقل.",
      };
    }

    console.error("Public title search failed", error instanceof Error ? error.message : "unknown error");
    return {
      ok: false,
      code: "SEARCH_UNAVAILABLE",
      messageAr: "تعذّر البحث الآن. حاول مرة أخرى بعد قليل.",
    };
  }
}
