import { assessReviewQuality } from "./quality-gated.ts";
import type { QualityAssessment, ReviewBundle } from "./types.ts";

export type PublicationPreparation =
  | {
      allowed: false;
      quality: QualityAssessment;
      reason: "quality_gate";
    }
  | {
      allowed: true;
      quality: QualityAssessment;
      expectedRevision: number;
      nextRevision: number;
      auditPayload: {
        event: "bundle_verified";
        bundleId: string;
        previousRevision: number;
        nextRevision: number;
        confidence: QualityAssessment["confidence"];
        eligibleSubmissionIds: string[];
      };
    };

export function preparePublication(bundle: ReviewBundle, revision: number): PublicationPreparation {
  const quality = assessReviewQuality(bundle);
  if (!quality.publishable) {
    return { allowed: false, quality, reason: "quality_gate" };
  }

  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error("Publication revision must be a non-negative integer.");
  }

  return {
    allowed: true,
    quality,
    expectedRevision: revision,
    nextRevision: revision + 1,
    auditPayload: {
      event: "bundle_verified",
      bundleId: bundle.id,
      previousRevision: revision,
      nextRevision: revision + 1,
      confidence: quality.confidence,
      eligibleSubmissionIds: quality.eligibleSubmissionIds,
    },
  };
}

