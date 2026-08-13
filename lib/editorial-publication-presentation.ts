import { buildEditorialPublicationFingerprint } from "./editorial-publication-integrity.ts";
import type { EditorialReviewPublication } from "./editorial-review.ts";

export interface EditorialPublicationPresentation {
  titleAr: string;
  titleEn: string;
  revision: number;
  updatedAt: string;
}

const PRESENTATION_BY_ID: Record<string, EditorialPublicationPresentation> = {
  "cars-2006-editorial-pilot-v1": { titleAr: "سيارات", titleEn: "Cars", revision: 4, updatedAt: "2026-08-13T21:35:00+03:00" },
  "et-1982-editorial-batch-v1": { titleAr: "إي تي", titleEn: "E.T. the Extra-Terrestrial", revision: 4, updatedAt: "2026-08-13T21:35:00+03:00" },
  "harry-potter-philosophers-stone-2001-editorial-batch-v1": { titleAr: "هاري بوتر وحجر الفيلسوف", titleEn: "Harry Potter and the Philosopher's Stone", revision: 4, updatedAt: "2026-08-13T21:35:00+03:00" },
  "minions-2015-editorial-batch-v1": { titleAr: "المينيون", titleEn: "Minions", revision: 4, updatedAt: "2026-08-13T21:35:00+03:00" },
};

export function getEditorialPublicationPresentation(review: Pick<EditorialReviewPublication, "id" | "titleLabel">): EditorialPublicationPresentation {
  return PRESENTATION_BY_ID[review.id] ?? { titleAr: review.titleLabel, titleEn: review.titleLabel, revision: 1, updatedAt: new Date(0).toISOString() };
}

export function buildEditorialPublicationContentFingerprint(review: EditorialReviewPublication): Promise<string> {
  return buildEditorialPublicationFingerprint(review, getEditorialPublicationPresentation(review));
}
