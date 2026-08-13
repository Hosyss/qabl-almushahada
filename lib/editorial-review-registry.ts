import {
  assessEditorialReviewPublication,
  parseEditorialReviewId,
  type EditorialReviewPublication,
} from "./editorial-review.ts";
import { CARS_2006_EDITORIAL_REVIEW } from "./editorial-review-publications/cars-2006.ts";
import { ET_1982_EDITORIAL_REVIEW } from "./editorial-review-publications/et-1982.ts";
import { HARRY_POTTER_2001_EDITORIAL_REVIEW } from "./editorial-review-publications/harry-potter-2001.ts";
import { MINIONS_2015_EDITORIAL_REVIEW } from "./editorial-review-publications/minions-2015.ts";

const EDITORIAL_REVIEW_PUBLICATIONS = [
  CARS_2006_EDITORIAL_REVIEW,
  ET_1982_EDITORIAL_REVIEW,
  HARRY_POTTER_2001_EDITORIAL_REVIEW,
  MINIONS_2015_EDITORIAL_REVIEW,
] as const;

export function getEditorialReviewPublicationById(
  editorialId: string,
): EditorialReviewPublication | null {
  const normalized = parseEditorialReviewId(editorialId);
  const publication = EDITORIAL_REVIEW_PUBLICATIONS.find((item) => item.id === normalized) ?? null;
  if (!publication) return null;
  return getValidatedPublication(publication);
}

export function getEditorialReviewPublicationForTitleId(
  titleId: string,
): EditorialReviewPublication | null {
  const publication = EDITORIAL_REVIEW_PUBLICATIONS.find((item) => item.titleId === titleId) ?? null;
  if (!publication) return null;
  return getValidatedPublication(publication);
}

export function listEditorialReviewPublications(): EditorialReviewPublication[] {
  return EDITORIAL_REVIEW_PUBLICATIONS.map((publication) => {
    const validated = getValidatedPublication(publication);
    if (!validated) throw new TypeError(`Invalid editorial review publication: ${publication.id}`);
    return validated;
  });
}

function getValidatedPublication(
  publication: EditorialReviewPublication,
): EditorialReviewPublication | null {
  const assessment = assessEditorialReviewPublication(publication);
  if (!assessment.publishable || assessment.decisionEligible !== false) return null;
  return {
    ...publication,
    sources: publication.sources.map((source) => ({
      ...source,
      supportedClaimIds: [...source.supportedClaimIds],
    })),
    claims: publication.claims.map((claim) => ({ ...claim, sourceIds: [...claim.sourceIds] })),
    uncertainCategories: [...publication.uncertainCategories],
  };
}
