import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { EditorialPublicationPresentation } from "../lib/editorial-publication-integrity.ts";
import type { EditorialReviewPublication } from "../lib/editorial-review.ts";

export interface FrozenEditorialBootstrapFixture {
  review: EditorialReviewPublication;
  presentation: EditorialPublicationPresentation;
  fingerprint: string;
}

const fixtureDir = path.join(process.cwd(), "data", "editorial-bootstrap");

export const FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES: FrozenEditorialBootstrapFixture[] = readdirSync(fixtureDir)
  .filter((name) => name.endsWith(".json"))
  .sort()
  .map((name) => JSON.parse(readFileSync(path.join(fixtureDir, name), "utf8")) as FrozenEditorialBootstrapFixture);

export function listFrozenEditorialReviews(): EditorialReviewPublication[] {
  return FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.map(({ review }) => structuredClone(review));
}

export function getFrozenEditorialReviewById(editorialId: string): EditorialReviewPublication | null {
  const review = FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.find((fixture) => fixture.review.id === editorialId)?.review;
  return review ? structuredClone(review) : null;
}

export function getFrozenEditorialReviewForTitleId(titleId: string): EditorialReviewPublication | null {
  const review = FROZEN_EDITORIAL_BOOTSTRAP_FIXTURES.find((fixture) => fixture.review.titleId === titleId)?.review;
  return review ? structuredClone(review) : null;
}
