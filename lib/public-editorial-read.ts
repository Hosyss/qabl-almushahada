import { findEditorialHeadByPublicId, findEditorialHeadByTitleId, listEditorialHeads, loadEditorialChildren } from "@/db/public-editorial-d1";
import { hydratePersistedEditorialPublication, type PersistedEditorialPublication } from "./editorial-publication-hydrate.ts";
import { parseEditorialReviewId } from "./editorial-review.ts";

export async function loadEditorialPublicationById(value: unknown) {
  const head = await findEditorialHeadByPublicId(parseEditorialReviewId(value));
  return head ? hydratePersistedEditorialPublication({ head, ...(await loadEditorialChildren(head.snapshotId)) }) : null;
}

export async function loadEditorialPublicationForTitleId(value: unknown) {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 160) throw new TypeError("titleId is invalid");
  const head = await findEditorialHeadByTitleId(value.trim());
  return head ? hydratePersistedEditorialPublication({ head, ...(await loadEditorialChildren(head.snapshotId)) }) : null;
}

export async function listEditorialPublications(limit = 100): Promise<PersistedEditorialPublication[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("Editorial list limit must be 1..100");
  const result: PersistedEditorialPublication[] = [];
  for (const head of await listEditorialHeads(limit)) {
    const item = await hydratePersistedEditorialPublication({ head, ...(await loadEditorialChildren(head.snapshotId)) });
    if (item) result.push(item);
  }
  return result;
}
