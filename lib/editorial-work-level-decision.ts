import {
  CONTENT_CATEGORIES,
  type ContentCategory,
  type FamilyProfile,
  type ObservedSeverity,
} from "./review-engine/types.ts";
import {
  CONTENT_SOURCE_POLICIES,
  assertSourceProvenancePersistenceAllowed,
} from "./content-source-policy.ts";
import {
  decideAsymmetricallyForFamily,
  emptyAsymmetricCategoryEvidence,
  type AsymmetricFamilyDecision,
  type AsymmetricPreferenceMode,
} from "./asymmetric-family-decision.ts";
import type {
  EditorialClaim,
  EditorialReviewPublication,
  EditorialSourceReference,
} from "./editorial-review.ts";

export const JURASSIC_C2A_EDITORIAL_ID = "jurassic-park-1993-editorial-c1-v1";

export interface EditorialClaimSeverityEvidence {
  severity: ObservedSeverity;
  sourceIds: string[];
  verified: true;
}

export interface EditorialWorkLevelEvidenceSummary {
  scope: "work_level";
  publicationQualityPassed: boolean;
  allowedSourceIds: string[];
  excludedReferenceOnlySourceIds: string[];
  verifiedPresentCategories: ContentCategory[];
  decisionUnknownCategories: ContentCategory[];
  editorialUncertainCategories: ContentCategory[];
  referenceOnlyCategories: ContentCategory[];
  severityMissingCategories: ContentCategory[];
  rejectedSeverityClaimIds: string[];
  sourceUrls: string[];
}

export interface EditorialWorkLevelDecisionResult {
  decision: AsymmetricFamilyDecision;
  evidence: EditorialWorkLevelEvidenceSummary;
}

export function summarizeEditorialWorkLevelEvidence(
  review: EditorialReviewPublication,
  severityEvidenceByClaimId: Readonly<Record<string, EditorialClaimSeverityEvidence>> = {},
  publicationQualityPassed = false,
): {
  summary: EditorialWorkLevelEvidenceSummary;
  categories: ReturnType<typeof emptyAsymmetricCategoryEvidence>;
} {
  const categories = emptyAsymmetricCategoryEvidence();
  const allowedSources = publicationQualityPassed
    ? review.sources.filter(isPersistableDecisionSource)
    : [];
  const allowedSourceIds = new Set(allowedSources.map((source) => source.id));
  const excludedReferenceOnlySourceIds = review.sources
    .filter((source) => !allowedSourceIds.has(source.id))
    .map((source) => source.id);

  const referenceOnlyCategories = new Set<ContentCategory>();
  const verifiedPresentCategories = new Set<ContentCategory>();
  const rejectedSeverityClaimIds = new Set<string>();

  for (const claim of review.claims) {
    const usableSourceIds = claim.sourceIds.filter((sourceId) => allowedSourceIds.has(sourceId));
    if (usableSourceIds.length === 0) {
      referenceOnlyCategories.add(claim.category);
      continue;
    }

    verifiedPresentCategories.add(claim.category);
    const severityEvidence = severityEvidenceByClaimId[claim.id];
    const severityIsEligible = severityEvidence
      ? severityEvidence.verified === true &&
        severityEvidence.sourceIds.length > 0 &&
        severityEvidence.sourceIds.every((sourceId) => usableSourceIds.includes(sourceId))
      : false;

    if (severityEvidence && !severityIsEligible) rejectedSeverityClaimIds.add(claim.id);

    categories[claim.category] = {
      category: claim.category,
      status: "present",
      severity: severityIsEligible ? severityEvidence.severity : null,
      decisionEligible: true,
      sourceIds: usableSourceIds,
      evidenceIds: [claim.id],
      flags: [],
    };
  }

  const decisionUnknownCategories = CONTENT_CATEGORIES.filter(
    (category) => categories[category].status === "unknown",
  );
  const severityMissingCategories = CONTENT_CATEGORIES.filter(
    (category) => categories[category].status === "present" && categories[category].severity === null,
  );

  return {
    categories,
    summary: {
      scope: "work_level",
      publicationQualityPassed,
      allowedSourceIds: [...allowedSourceIds],
      excludedReferenceOnlySourceIds,
      verifiedPresentCategories: [...verifiedPresentCategories],
      decisionUnknownCategories,
      editorialUncertainCategories: [...review.uncertainCategories],
      referenceOnlyCategories: [...referenceOnlyCategories],
      severityMissingCategories,
      rejectedSeverityClaimIds: [...rejectedSeverityClaimIds],
      sourceUrls: allowedSources.map((source) => source.sourceUrl),
    },
  };
}

export function decideEditorialWorkLevelForFamily(options: {
  review: EditorialReviewPublication;
  family: FamilyProfile;
  usedDefaultPreferences: boolean;
  preferenceMode?: AsymmetricPreferenceMode;
  severityEvidenceByClaimId?: Readonly<Record<string, EditorialClaimSeverityEvidence>>;
  publicationQualityPassed: boolean;
}): EditorialWorkLevelDecisionResult {
  const { summary, categories } = summarizeEditorialWorkLevelEvidence(
    options.review,
    options.severityEvidenceByClaimId,
    options.publicationQualityPassed,
  );
  const decision = decideAsymmetricallyForFamily({
    scope: "work_level",
    exactVersionIdentityEstablished: false,
    usedDefaultPreferences: options.usedDefaultPreferences,
    preferenceMode:
      options.preferenceMode ?? (options.usedDefaultPreferences ? "defaults_only" : "fully_custom"),
    fullEvidenceGatePassed: false,
    family: options.family,
    categories,
  });
  return { decision, evidence: summary };
}

export function isPersistableDecisionSource(source: EditorialSourceReference): boolean {
  if (source.usageBasis !== "open_license" || source.sourceType !== "open_encyclopedia") {
    return false;
  }

  let url: URL;
  try {
    url = new URL(source.sourceUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !/(^|\.)wikipedia\.org$/u.test(url.hostname)) return false;

  try {
    const policy = assertSourceProvenancePersistenceAllowed("wikipedia", "analysis_evidence");
    return (
      policy === CONTENT_SOURCE_POLICIES.wikipedia &&
      source.rightsLabel === policy.licenseLabel &&
      source.rightsUrl === policy.licenseUrl &&
      Boolean(source.sourceVersion)
    );
  } catch {
    return false;
  }
}

export function claimHasPersistableDecisionEvidence(
  claim: EditorialClaim,
  review: EditorialReviewPublication,
): boolean {
  const sources = new Map(review.sources.map((source) => [source.id, source]));
  return claim.sourceIds.some((sourceId) => {
    const source = sources.get(sourceId);
    return source ? isPersistableDecisionSource(source) : false;
  });
}
