import {
  buildEditorialPublicationContentFingerprint,
  getEditorialPublicationPresentation,
} from "../lib/editorial-publication-presentation.ts";
import { listEditorialReviewPublications } from "../lib/editorial-review-registry.ts";

const rows = [];
for (const review of listEditorialReviewPublications()) {
  rows.push({
    review,
    presentation: getEditorialPublicationPresentation(review),
    fingerprint: await buildEditorialPublicationContentFingerprint(review),
  });
}
process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
