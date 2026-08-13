import {
  CATEGORY_LABELS_AR,
  CONTENT_CATEGORIES,
  type ContentCategory,
  type Severity,
} from "./review-engine/index.ts";
import {
  assessEvidenceReview,
  type EvidenceCategoryAssertion,
  type EvidenceFact,
  type EvidenceSourceRef,
} from "./evidence-review.ts";
import { EVIDENCE_PUBLIC_DISCLOSURE_AR } from "./evidence-publication.ts";

export const MAX_PUBLIC_EVIDENCE_PUBLICATION_ID_LENGTH = 160;

export interface ParsedPublicEvidenceReviewLocator {
  publicationId: string;
}

export interface PublicEvidenceReviewMetadata {
  publicationId: string;
  headRevision: number;
  publicationRevision: number;
  reviewMethod: "evidence_based";
  humanWatchConfirmed: false;
  publicationGateVersion: string;
  publishedAt: string;
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
}

export interface PublicEvidenceReviewSource {
  id: string;
  sourceKey: string;
  sourceUrl: string;
  sourceRevision: string | null;
  sourceLicense: string;
  licenseUrl: string;
  attributionText: string | null;
  shareAlike: boolean;
  retrievedAt: string;
}

export interface PublicEvidenceReviewFact {
  id: string;
  sourceId: string;
  sourceLocator: string;
  severity: 1 | 2 | 3 | 4;
  frequency: EvidenceFact["frequency"];
  context: EvidenceFact["context"];
  spoilerLevel: EvidenceFact["spoilerLevel"];
  summary: string;
  startSecond: number | null;
  endSecond: number | null;
}

export interface PublicEvidenceReviewCategory {
  id: ContentCategory;
  labelAr: string;
  coverage: "none" | "present";
  severity: Severity;
  facts: PublicEvidenceReviewFact[];
}

export interface PublicEvidenceReviewView {
  publicationId: string;
  reviewMethod: "evidence_based";
  humanWatchConfirmed: false;
  disclosureAr: string;
  publicationGateVersion: string;
  title: {
    id: string;
    canonicalName: string;
    originalName: string | null;
    kind: PublicEvidenceReviewMetadata["kind"];
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
  sourceCount: number;
  factCount: number;
  highestCategory: ContentCategory | null;
  sources: PublicEvidenceReviewSource[];
  categories: PublicEvidenceReviewCategory[];
}

export function parsePublicEvidenceReviewLocator(input: unknown): ParsedPublicEvidenceReviewLocator {
  if (!isPlainObject(input)) throw new TypeError("Public evidence review locator must be an object");
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "publicationId") {
    throw new TypeError("Public evidence review locator accepts only publicationId");
  }
  if (typeof input.publicationId !== "string") throw new TypeError("publicationId must be a string");
  const publicationId = input.publicationId.trim();
  if (!publicationId || publicationId.length > MAX_PUBLIC_EVIDENCE_PUBLICATION_ID_LENGTH) {
    throw new RangeError("publicationId length is invalid");
  }
  if (/[\u0000-\u001F\u007F]/u.test(publicationId)) {
    throw new TypeError("publicationId contains control characters");
  }
  return { publicationId };
}

export function buildPublicEvidenceReviewHref(publicationId: string): string {
  const locator = parsePublicEvidenceReviewLocator({ publicationId });
  return `/review?publicationId=${encodeURIComponent(locator.publicationId)}`;
}

export function buildPublicEvidenceReviewView(options: {
  metadata: PublicEvidenceReviewMetadata;
  sources: PublicEvidenceReviewSource[];
  evidenceSources: EvidenceSourceRef[];
  assertions: EvidenceCategoryAssertion[];
  facts: EvidenceFact[];
}): PublicEvidenceReviewView | null {
  const { metadata, sources, evidenceSources, assertions, facts } = options;
  if (metadata.reviewMethod !== "evidence_based" || metadata.humanWatchConfirmed !== false) return null;
  if (!isValidInstant(metadata.publishedAt) || !isNonEmptyString(metadata.publicationGateVersion)) return null;
  if (metadata.headRevision !== metadata.publicationRevision || metadata.publicationRevision < 1) return null;
  if (metadata.versionId !== evidenceSources[0]?.versionId && evidenceSources.length > 0) return null;
  if (sources.length === 0 || sources.length !== evidenceSources.length) return null;
  if (new Set(sources.map((source) => source.id)).size !== sources.length) return null;
  if (new Set(evidenceSources.map((source) => source.id)).size !== evidenceSources.length) return null;
  if (sources.some((source) => !evidenceSources.some((evidence) => evidence.id === source.id))) return null;

  const assessment = assessEvidenceReview({
    versionId: metadata.versionId,
    sources: evidenceSources,
    assertions,
    facts,
  });
  if (assessment.status !== "ready" || !assessment.engineEligible || assessment.issues.length > 0) return null;

  const assertionsById = new Map(assertions.map((assertion) => [assertion.id, assertion]));
  const publicFacts = new Map<string, PublicEvidenceReviewFact>();
  for (const fact of assessment.resolvedFacts) {
    const assertion = assertionsById.get(fact.assertionId);
    if (!assertion || assertion.result !== "present") return null;
    publicFacts.set(fact.id, {
      id: fact.id,
      sourceId: assertion.evidenceSourceId,
      sourceLocator: assertion.sourceLocator,
      severity: fact.severity,
      frequency: fact.frequency,
      context: fact.context,
      spoilerLevel: fact.spoilerLevel,
      summary: fact.summaryAr,
      startSecond: fact.startSecond,
      endSecond: fact.endSecond,
    });
  }

  const categories = CONTENT_CATEGORIES.map((category): PublicEvidenceReviewCategory => {
    const coverage = assessment.categoryCoverage[category];
    if (coverage.status !== "covered_none" && coverage.status !== "covered_present") {
      throw new TypeError(`Unexpected publishable evidence coverage: ${category}`);
    }
    const categoryFacts = coverage.factIds
      .map((factId) => publicFacts.get(factId))
      .filter((fact): fact is PublicEvidenceReviewFact => Boolean(fact))
      .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id));
    return {
      id: category,
      labelAr: CATEGORY_LABELS_AR[category],
      coverage: coverage.status === "covered_present" ? "present" : "none",
      severity: coverage.maxSeverity,
      facts: categoryFacts,
    };
  });

  const highest = categories.reduce<PublicEvidenceReviewCategory | null>((current, category) => {
    if (!current || category.severity > current.severity) return category;
    return current;
  }, null);

  return {
    publicationId: metadata.publicationId,
    reviewMethod: "evidence_based",
    humanWatchConfirmed: false,
    disclosureAr: EVIDENCE_PUBLIC_DISCLOSURE_AR,
    publicationGateVersion: metadata.publicationGateVersion,
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
    sourceCount: sources.length,
    factCount: publicFacts.size,
    highestCategory: highest && highest.severity > 0 ? highest.id : null,
    sources: sources.map((source) => ({ ...source })),
    categories,
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
