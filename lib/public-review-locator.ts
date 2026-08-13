export type PublicReviewLocator =
  | { kind: "human"; id: string }
  | { kind: "evidence"; id: string }
  | { kind: "editorial"; id: string };

export type PublicReviewLocatorInput = {
  bundleId?: string | string[];
  publicationId?: string | string[];
  editorialId?: string | string[];
};

export function parsePublicReviewLocator(
  input: PublicReviewLocatorInput,
): PublicReviewLocator | null {
  const candidates: PublicReviewLocator[] = [];

  const bundleId = singleValue(input.bundleId);
  if (bundleId) candidates.push({ kind: "human", id: bundleId });

  const publicationId = singleValue(input.publicationId);
  if (publicationId) candidates.push({ kind: "evidence", id: publicationId });

  const editorialId = singleValue(input.editorialId);
  if (editorialId) candidates.push({ kind: "editorial", id: editorialId });

  return candidates.length === 1 ? candidates[0] : null;
}

function singleValue(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}
