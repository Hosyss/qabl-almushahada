import {
  CATEGORY_LABELS_AR,
  CONTENT_CATEGORIES,
  assessReviewQuality,
  type ContentCategory,
  type ContentObservation,
  type QualityAssessment,
  type ReviewBundle,
  type Severity,
} from "./review-engine/index.ts";

export const MAX_PUBLIC_REVIEW_BUNDLE_ID_LENGTH = 160;

export interface ParsedPublicReviewLocator {
  bundleId: string;
}

export interface PublicReviewMetadata {
  bundleId: string;
  titleId: string;
  canonicalName: string;
  originalName: string | null;
  kind: "movie" | "series" | "episode" | "special";
  releaseYear: number;
  versionId: string;
  editionLabel: string;
  platform: string;
  language: string;
  runtimeSeconds: number;
  publishedAt: string;
  approvedAt: string;
}

export interface PublicReviewFact {
  id: string;
  severity: Exclude<Severity, 0>;
  startSecond: number;
  endSecond: number;
  frequency: ContentObservation["frequency"];
  context: ContentObservation["context"];
  spoilerLevel: ContentObservation["spoilerLevel"];
  summary: string;
}

export interface PublicReviewCategory {
  id: ContentCategory;
  labelAr: string;
  severity: Severity;
  facts: PublicReviewFact[];
}

export interface PublicReviewView {
  bundleId: string;
  title: {
    id: string;
    canonicalName: string;
    originalName: string | null;
    kind: PublicReviewMetadata["kind"];
    releaseYear: number;
  };
  version: {
    id: string;
    editionLabel: string;
    platform: string;
    language: string;
    runtimeSeconds: number;
  };
  publishedAt: string;
  approvedAt: string;
  confidence: QualityAssessment["confidence"];
  reviewerCount: number;
  observationCount: number;
  highestCategory: ContentCategory | null;
  categories: PublicReviewCategory[];
}

export function parsePublicReviewLocator(input: unknown): ParsedPublicReviewLocator {
  if (!isPlainObject(input)) throw new TypeError("Public review locator must be an object");
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "bundleId") {
    throw new TypeError("Public review locator accepts only bundleId");
  }
  if (typeof input.bundleId !== "string") throw new TypeError("bundleId must be a string");
  const bundleId = input.bundleId.trim();
  if (!bundleId || bundleId.length > MAX_PUBLIC_REVIEW_BUNDLE_ID_LENGTH) {
    throw new RangeError("bundleId length is invalid");
  }
  if (/[\u0000-\u001F\u007F]/u.test(bundleId)) {
    throw new TypeError("bundleId contains control characters");
  }
  return { bundleId };
}

export function buildPublicReviewView(
  metadata: PublicReviewMetadata,
  bundle: ReviewBundle,
): PublicReviewView | null {
  if (metadata.bundleId !== bundle.id || metadata.versionId !== bundle.version.id) return null;
  if (metadata.titleId !== bundle.version.titleId) return null;
  if (metadata.runtimeSeconds !== bundle.version.runtimeSeconds) return null;

  const quality = assessReviewQuality(bundle);
  if (!quality.publishable || quality.status !== "verified") return null;

  const eligibleSubmissionIds = new Set(quality.eligibleSubmissionIds);
  const eligibleSubmissions = bundle.submissions.filter((submission) =>
    eligibleSubmissionIds.has(submission.id),
  );
  const observations = eligibleSubmissions.flatMap((submission) => submission.observations);

  const categories = CONTENT_CATEGORIES.map((category): PublicReviewCategory => {
    const facts = observations
      .filter((observation) => observation.category === category)
      .slice()
      .sort(
        (a, b) =>
          a.startSecond - b.startSecond ||
          b.severity - a.severity ||
          a.id.localeCompare(b.id),
      )
      .map((observation) => ({
        id: observation.id,
        severity: observation.severity,
        startSecond: observation.startSecond,
        endSecond: observation.endSecond,
        frequency: observation.frequency,
        context: observation.context,
        spoilerLevel: observation.spoilerLevel,
        summary: observation.summary,
      }));
    const severity = facts.reduce<Severity>(
      (maximum, fact) => Math.max(maximum, fact.severity) as Severity,
      0,
    );
    return { id: category, labelAr: CATEGORY_LABELS_AR[category], severity, facts };
  });

  const highestCategory = categories.reduce<PublicReviewCategory | null>((highest, category) => {
    if (!highest || category.severity > highest.severity) return category;
    return highest;
  }, null);

  return {
    bundleId: metadata.bundleId,
    title: {
      id: metadata.titleId,
      canonicalName: metadata.canonicalName,
      originalName: metadata.originalName,
      kind: metadata.kind,
      releaseYear: metadata.releaseYear,
    },
    version: {
      id: metadata.versionId,
      editionLabel: metadata.editionLabel,
      platform: metadata.platform,
      language: metadata.language,
      runtimeSeconds: metadata.runtimeSeconds,
    },
    publishedAt: metadata.publishedAt,
    approvedAt: metadata.approvedAt,
    confidence: quality.confidence,
    reviewerCount: new Set(eligibleSubmissions.map((submission) => submission.reviewer.id)).size,
    observationCount: observations.length,
    highestCategory: highestCategory && highestCategory.severity > 0 ? highestCategory.id : null,
    categories,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
