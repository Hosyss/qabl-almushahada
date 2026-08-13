import type {
  EditorialClaimRow,
  EditorialClaimSourceRow,
  EditorialHeadRow,
  EditorialSourceRow,
  EditorialUncertainRow,
} from "@/db/public-editorial-read-model";
import { buildEditorialPublicationFingerprint, type EditorialPublicationPresentation } from "./editorial-publication-integrity.ts";
import {
  assessEditorialReviewPublication,
  type EditorialClaim,
  type EditorialReviewPublication,
  type EditorialSourceReference,
} from "./editorial-review.ts";
import type { ContentCategory } from "./review-engine/index.ts";

export interface PersistedEditorialReviewPublication extends EditorialReviewPublication {
  publicationPresentation: EditorialPublicationPresentation;
  contentFingerprint: string;
}
export interface PersistedEditorialPublication {
  review: PersistedEditorialReviewPublication;
  presentation: EditorialPublicationPresentation;
  fingerprint: string;
}

export async function hydratePersistedEditorialPublication(input: {
  head: EditorialHeadRow;
  sources: EditorialSourceRow[];
  claims: EditorialClaimRow[];
  links: EditorialClaimSourceRow[];
  uncertain: EditorialUncertainRow[];
}): Promise<PersistedEditorialPublication | null> {
  const { head, links } = input;
  if (!validHead(head)) return null;
  const sources: EditorialSourceReference[] = input.sources.map((source) => ({
    id: source.sourceKey,
    publisher: source.publisher,
    sourceType: source.sourceType as EditorialSourceReference["sourceType"],
    sourceUrl: source.sourceUrl,
    accessedOn: source.accessedOn,
    independenceGroupId: source.independenceGroupId,
    usageBasis: source.usageBasis as EditorialSourceReference["usageBasis"],
    rightsLabel: source.rightsLabel,
    rightsUrl: source.rightsUrl,
    usageNoteAr: source.usageNoteAr,
    ...(source.sourceVersion ? { sourceVersion: source.sourceVersion } : {}),
    supportedClaimIds: links.filter((link) => link.sourceKey === source.sourceKey).map((link) => link.claimKey),
  }));
  const claims: EditorialClaim[] = input.claims.map((claim) => ({
    id: claim.claimKey,
    category: claim.category as ContentCategory,
    summaryAr: claim.summaryAr,
    verification: claim.verification as EditorialClaim["verification"],
    sourceIds: links.filter((link) => link.claimKey === claim.claimKey).map((link) => link.sourceKey),
  }));
  const baseReview: EditorialReviewPublication = {
    id: head.publicId,
    titleId: head.titleId,
    titleLabel: head.titleLabel,
    releaseYear: head.releaseYear,
    kind: head.kind as EditorialReviewPublication["kind"],
    policyVersion: head.policyVersion,
    publishedAt: head.publishedAt,
    scopeAr: head.scopeAr,
    analysisAr: head.analysisAr,
    decisionStatus: "insufficient_data",
    decisionEligible: false,
    sources,
    claims,
    uncertainCategories: input.uncertain.map((row) => row.category as ContentCategory),
  };
  const assessment = assessEditorialReviewPublication(baseReview);
  if (!assessment.publishable || assessment.decisionEligible !== false) return null;
  const presentation = { titleAr: head.titleAr, titleEn: head.titleEn, revision: head.revision, updatedAt: head.updatedAt };
  const fingerprint = await buildEditorialPublicationFingerprint(baseReview, presentation);
  if (fingerprint !== head.contentFingerprint) return null;
  const review: PersistedEditorialReviewPublication = { ...baseReview, publicationPresentation: presentation, contentFingerprint: fingerprint };
  return { review, presentation, fingerprint };
}

function validHead(head: EditorialHeadRow) {
  return typeof head.snapshotId === "string" && head.snapshotId.length > 0 &&
    typeof head.publicId === "string" && typeof head.titleId === "string" &&
    typeof head.titleAr === "string" && head.titleAr.trim().length > 0 &&
    typeof head.titleEn === "string" && head.titleEn.trim().length > 0 &&
    Number.isInteger(head.releaseYear) && Number.isInteger(head.revision) && head.revision >= 1 &&
    head.decisionStatus === "insufficient_data" && head.decisionEligible === 0 &&
    /^sha256:[a-f0-9]{64}$/u.test(head.contentFingerprint);
}
