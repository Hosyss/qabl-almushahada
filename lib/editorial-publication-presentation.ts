import {
  buildEditorialPublicationFingerprint,
  type EditorialPublicationPresentation,
} from "./editorial-publication-integrity.ts";
import type { EditorialReviewPublication } from "./editorial-review.ts";

type PersistedEditorialCarrier = EditorialReviewPublication & {
  publicationPresentation?: EditorialPublicationPresentation;
  contentFingerprint?: string;
};

export function getEditorialPublicationPresentation(
  review: EditorialReviewPublication,
): EditorialPublicationPresentation {
  const presentation = (review as PersistedEditorialCarrier).publicationPresentation;
  if (!presentation || !isValidPresentation(presentation)) {
    throw new TypeError("Persisted editorial presentation metadata is missing or invalid");
  }
  return presentation;
}

export async function buildEditorialPublicationContentFingerprint(
  review: EditorialReviewPublication,
): Promise<string> {
  const carrier = review as PersistedEditorialCarrier;
  const presentation = getEditorialPublicationPresentation(review);
  const calculated = await buildEditorialPublicationFingerprint(review, presentation);
  if (typeof carrier.contentFingerprint !== "string" || carrier.contentFingerprint !== calculated) {
    throw new TypeError("Persisted editorial content fingerprint is missing or mismatched");
  }
  return calculated;
}

function isValidPresentation(value: EditorialPublicationPresentation): boolean {
  return typeof value.titleAr === "string" && value.titleAr.trim().length > 0
    && typeof value.titleEn === "string" && value.titleEn.trim().length > 0
    && Number.isInteger(value.revision) && value.revision >= 1
    && typeof value.updatedAt === "string" && !Number.isNaN(Date.parse(value.updatedAt));
}
