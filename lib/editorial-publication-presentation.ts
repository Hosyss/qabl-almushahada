import type { EditorialReviewPublication } from "./editorial-review.ts";

export interface EditorialPublicationPresentation {
  titleAr: string;
  titleEn: string;
  revision: number;
  updatedAt: string;
}

const PRESENTATION_BY_ID: Record<string, EditorialPublicationPresentation> = {
  "cars-2006-editorial-pilot-v1": {
    titleAr: "سيارات",
    titleEn: "Cars",
    revision: 4,
    updatedAt: "2026-08-13T21:35:00+03:00",
  },
  "et-1982-editorial-batch-v1": {
    titleAr: "إي تي",
    titleEn: "E.T. the Extra-Terrestrial",
    revision: 4,
    updatedAt: "2026-08-13T21:35:00+03:00",
  },
  "harry-potter-philosophers-stone-2001-editorial-batch-v1": {
    titleAr: "هاري بوتر وحجر الفيلسوف",
    titleEn: "Harry Potter and the Philosopher's Stone",
    revision: 4,
    updatedAt: "2026-08-13T21:35:00+03:00",
  },
  "minions-2015-editorial-batch-v1": {
    titleAr: "المينيون",
    titleEn: "Minions",
    revision: 4,
    updatedAt: "2026-08-13T21:35:00+03:00",
  },
};

export function getEditorialPublicationPresentation(review: Pick<EditorialReviewPublication, "id" | "titleLabel">): EditorialPublicationPresentation {
  return PRESENTATION_BY_ID[review.id] ?? {
    titleAr: review.titleLabel,
    titleEn: review.titleLabel,
    revision: 1,
    updatedAt: new Date(0).toISOString(),
  };
}

export async function buildEditorialPublicationContentFingerprint(review: EditorialReviewPublication): Promise<string> {
  const presentation = getEditorialPublicationPresentation(review);
  const payload = JSON.stringify({
    id: review.id,
    titleId: review.titleId,
    presentation,
    releaseYear: review.releaseYear,
    kind: review.kind,
    policyVersion: review.policyVersion,
    publishedAt: review.publishedAt,
    scopeAr: review.scopeAr,
    analysisAr: review.analysisAr,
    decisionStatus: review.decisionStatus,
    decisionEligible: review.decisionEligible,
    sources: [...review.sources].sort((a, b) => a.id.localeCompare(b.id)).map((source) => ({
      id: source.id,
      publisher: source.publisher,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      accessedOn: source.accessedOn,
      independenceGroupId: source.independenceGroupId,
      usageBasis: source.usageBasis,
      rightsLabel: source.rightsLabel,
      rightsUrl: source.rightsUrl,
      sourceVersion: source.sourceVersion ?? null,
      supportedClaimIds: [...source.supportedClaimIds].sort(),
    })),
    claims: [...review.claims].sort((a, b) => a.id.localeCompare(b.id)).map((claim) => ({
      id: claim.id,
      category: claim.category,
      summaryAr: claim.summaryAr,
      verification: claim.verification,
      sourceIds: [...claim.sourceIds].sort(),
    })),
    uncertainCategories: [...review.uncertainCategories].sort(),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
