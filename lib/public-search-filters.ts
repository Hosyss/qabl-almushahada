import { getExampleAgeSeverityLimit } from "./review-engine/profile.ts";
import {
  classifyPublicSearchAvailability,
  type PublicSearchAvailability,
} from "./public-search-result-state.ts";
import type { PublicTitleKind, PublicTitleSearchResult } from "./public-title-search.ts";

export const PUBLIC_SEARCH_AGE_OPTIONS = [5, 8, 11, 14, 17] as const;

export type PublicSearchAgeOption = (typeof PUBLIC_SEARCH_AGE_OPTIONS)[number];
export type PublicSearchKindFilter = "all" | PublicTitleKind;
export type PublicSearchStatusFilter = "all" | PublicSearchAvailability;

export interface PublicSearchFilters {
  kind: PublicSearchKindFilter;
  age: PublicSearchAgeOption | null;
  status: PublicSearchStatusFilter;
}

export function parsePublicSearchFilters(input: {
  kind?: string | string[];
  age?: string | string[];
  status?: string | string[];
}): PublicSearchFilters {
  return {
    kind: parseKind(singleValue(input.kind)),
    age: parseAge(singleValue(input.age)),
    status: parseStatus(singleValue(input.status)),
  };
}

export function filterPublicTitleSearchResults(
  results: readonly PublicTitleSearchResult[],
  filters: PublicSearchFilters,
): PublicTitleSearchResult[] {
  const ageLimit = filters.age === null ? null : getExampleAgeSeverityLimit(filters.age);

  return results.filter((result) => {
    if (filters.kind !== "all" && result.kind !== filters.kind) return false;

    const availability = classifyPublicSearchAvailability(result);
    if (filters.status !== "all" && availability !== filters.status) return false;

    if (ageLimit !== null) {
      if (availability !== "verified" || result.verifiedMaxSeverity === null) return false;
      if (result.verifiedMaxSeverity > ageLimit) return false;
    }

    return true;
  });
}

export function hasActivePublicSearchFilters(filters: PublicSearchFilters): boolean {
  return filters.kind !== "all" || filters.age !== null || filters.status !== "all";
}

function singleValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseKind(value: string | undefined): PublicSearchKindFilter {
  if (value === "movie" || value === "series" || value === "episode" || value === "special") {
    return value;
  }
  return "all";
}

function parseAge(value: string | undefined): PublicSearchAgeOption | null {
  if (!value) return null;
  const parsed = Number(value);
  return (PUBLIC_SEARCH_AGE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as PublicSearchAgeOption)
    : null;
}

function parseStatus(value: string | undefined): PublicSearchStatusFilter {
  if (value === "verified" || value === "in_review" || value === "catalog_only") {
    return value;
  }
  return "all";
}
