import type { EditorialPublicationPresentation } from "./editorial-publication-presentation.ts";
import type { EditorialReviewPublication } from "./editorial-review.ts";

export async function buildEditorialPublicationFingerprint(
  review: EditorialReviewPublication,
  presentation: EditorialPublicationPresentation,
): Promise<string> {
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
