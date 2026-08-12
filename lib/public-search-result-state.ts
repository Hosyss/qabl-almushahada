import type { PublicTitleSearchResult } from "./public-title-search.ts";

export type PublicSearchAvailability = "verified" | "in_review" | "catalog_only";

export function classifyPublicSearchAvailability(
  result: Pick<PublicTitleSearchResult, "hasVerifiedReview" | "hasReviewInProgress">,
): PublicSearchAvailability {
  if (result.hasVerifiedReview) return "verified";
  if (result.hasReviewInProgress) return "in_review";
  return "catalog_only";
}
