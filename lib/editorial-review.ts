import {
  CATEGORY_LABELS_AR,
  CONTENT_CATEGORIES,
  type ContentCategory,
} from "./review-engine/index.ts";

export const EDITORIAL_REVIEW_POLICY_VERSION = "2026-08-13.1";
export const MAX_EDITORIAL_REVIEW_ID_LENGTH = 160;

export type EditorialSourceType = "published_review" | "official_classification";
export type EditorialClaimVerification = "corroborated" | "single_source";

export interface EditorialSourceReference {
  id: string;
  publisher: string;
  sourceType: EditorialSourceType;
  sourceUrl: string;
  accessedOn: string;
  independenceGroupId: string;
  supportedClaimIds: string[];
}

export interface EditorialClaim {
  id: string;
  category: ContentCategory;
  summaryAr: string;
  verification: EditorialClaimVerification;
  sourceIds: string[];
}

export interface EditorialReviewPublication {
  id: string;
  titleId: string;
  titleLabel: string;
  releaseYear: number;
  kind: "movie" | "series" | "episode" | "special";
  policyVersion: string;
  publishedAt: string;
  scopeAr: string;
  analysisAr: string;
  decisionStatus: "insufficient_data";
  decisionEligible: false;
  sources: EditorialSourceReference[];
  claims: EditorialClaim[];
  uncertainCategories: ContentCategory[];
}

export interface EditorialReviewIssue {
  code:
    | "PUBLICATION_ID_INVALID"
    | "TITLE_IDENTITY_INVALID"
    | "PUBLICATION_METADATA_INVALID"
    | "SOURCE_INVALID"
    | "SOURCE_DUPLICATE"
    | "CLAIM_INVALID"
    | "CLAIM_DUPLICATE"
    | "CLAIM_SOURCE_UNKNOWN"
    | "SOURCE_CLAIM_MISMATCH"
    | "CORROBORATION_INVALID"
    | "CATEGORY_PARTITION_INVALID"
    | "DECISION_GATE_INVALID";
  messageAr: string;
  sourceId?: string;
  claimId?: string;
  category?: ContentCategory;
}

export interface EditorialReviewAssessment {
  publishable: boolean;
  decisionEligible: false;
  decisionStatus: "insufficient_data";
  issues: EditorialReviewIssue[];
  corroboratedClaimCount: number;
  singleSourceClaimCount: number;
  uncertainCategoryCount: number;
}

export function assessEditorialReviewPublication(
  publication: EditorialReviewPublication,
): EditorialReviewAssessment {
  const issues: EditorialReviewIssue[] = [];

  if (!isBoundedText(publication.id, 1, MAX_EDITORIAL_REVIEW_ID_LENGTH)) {
    issues.push({ code: "PUBLICATION_ID_INVALID", messageAr: "معرّف النشر التحريري غير صالح." });
  }

  if (
    !isBoundedText(publication.titleId, 1, 160) ||
    !isBoundedText(publication.titleLabel, 1, 240) ||
    !Number.isInteger(publication.releaseYear) ||
    publication.releaseYear < 1880 ||
    publication.releaseYear > 2200 ||
    !["movie", "series", "episode", "special"].includes(publication.kind)
  ) {
    issues.push({ code: "TITLE_IDENTITY_INVALID", messageAr: "هوية العمل في النشر التحريري غير مكتملة." });
  }

  if (
    publication.policyVersion !== EDITORIAL_REVIEW_POLICY_VERSION ||
    !isValidInstant(publication.publishedAt) ||
    !isBoundedText(publication.scopeAr, 20, 1200) ||
    !isBoundedText(publication.analysisAr, 40, 2400)
  ) {
    issues.push({
      code: "PUBLICATION_METADATA_INVALID",
      messageAr: "بيانات النشر أو نطاق التحليل التحريري غير صالحة.",
    });
  }

  if (publication.decisionStatus !== "insufficient_data" || publication.decisionEligible !== false) {
    issues.push({
      code: "DECISION_GATE_INVALID",
      messageAr: "المسار التحريري الجزئي لا يملك سلطة إصدار حكم ملاءمة مكتمل.",
    });
  }

  const sourcesById = new Map<string, EditorialSourceReference>();
  for (const source of publication.sources) {
    if (sourcesById.has(source.id)) {
      issues.push({
        code: "SOURCE_DUPLICATE",
        sourceId: source.id,
        messageAr: "يوجد معرّف مصدر مكرر داخل النشر التحريري.",
      });
      continue;
    }
    sourcesById.set(source.id, source);

    if (
      !isBoundedText(source.id, 1, 160) ||
      !isBoundedText(source.publisher, 2, 160) ||
      !["published_review", "official_classification"].includes(source.sourceType) ||
      !isHttpsUrl(source.sourceUrl) ||
      !isIsoDate(source.accessedOn) ||
      !isBoundedText(source.independenceGroupId, 2, 160) ||
      source.supportedClaimIds.length === 0 ||
      new Set(source.supportedClaimIds).size !== source.supportedClaimIds.length ||
      source.supportedClaimIds.some((id) => !isBoundedText(id, 1, 160))
    ) {
      issues.push({
        code: "SOURCE_INVALID",
        sourceId: source.id,
        messageAr: "بيانات مصدر تحريري أو تاريخ الوصول أو قائمة الادعاءات غير صالحة.",
      });
    }
  }

  const claimsById = new Map<string, EditorialClaim>();
  for (const claim of publication.claims) {
    if (claimsById.has(claim.id)) {
      issues.push({
        code: "CLAIM_DUPLICATE",
        claimId: claim.id,
        category: claim.category,
        messageAr: "يوجد معرّف واقعة تحريرية مكرر.",
      });
      continue;
    }
    claimsById.set(claim.id, claim);

    if (
      !isBoundedText(claim.id, 1, 160) ||
      !(CONTENT_CATEGORIES as readonly string[]).includes(claim.category) ||
      !isBoundedText(claim.summaryAr, 20, 1000) ||
      !["corroborated", "single_source"].includes(claim.verification) ||
      claim.sourceIds.length === 0 ||
      new Set(claim.sourceIds).size !== claim.sourceIds.length
    ) {
      issues.push({
        code: "CLAIM_INVALID",
        claimId: claim.id,
        category: claim.category,
        messageAr: "الواقعة التحريرية تحتوي بيانات غير صالحة أو غير قابلة للتتبع.",
      });
    }

    const claimSources = claim.sourceIds
      .map((sourceId) => sourcesById.get(sourceId))
      .filter((source): source is EditorialSourceReference => Boolean(source));

    if (claimSources.length !== claim.sourceIds.length) {
      issues.push({
        code: "CLAIM_SOURCE_UNKNOWN",
        claimId: claim.id,
        category: claim.category,
        messageAr: "الواقعة التحريرية تشير إلى مصدر غير موجود داخل النشر.",
      });
    }

    const independenceGroups = new Set(claimSources.map((source) => source.independenceGroupId));
    if (
      (claim.verification === "corroborated" && independenceGroups.size < 2) ||
      (claim.verification === "single_source" && independenceGroups.size !== 1)
    ) {
      issues.push({
        code: "CORROBORATION_INVALID",
        claimId: claim.id,
        category: claim.category,
        messageAr: "وصف مستوى التحقق لا يطابق عدد المصادر المستقلة التي تدعم الواقعة.",
      });
    }
  }

  for (const source of publication.sources) {
    for (const claimId of source.supportedClaimIds) {
      const claim = claimsById.get(claimId);
      if (!claim || !claim.sourceIds.includes(source.id)) {
        issues.push({
          code: "SOURCE_CLAIM_MISMATCH",
          sourceId: source.id,
          claimId,
          messageAr: "ربط المصدر بالواقعة غير متطابق في الاتجاهين.",
        });
      }
    }
  }

  for (const claim of publication.claims) {
    for (const sourceId of claim.sourceIds) {
      const source = sourcesById.get(sourceId);
      if (source && !source.supportedClaimIds.includes(claim.id)) {
        issues.push({
          code: "SOURCE_CLAIM_MISMATCH",
          sourceId,
          claimId: claim.id,
          category: claim.category,
          messageAr: "الواقعة تشير إلى مصدر لا يسجل أنه يدعمها.",
        });
      }
    }
  }

  const presentCategories = new Set(publication.claims.map((claim) => claim.category));
  const uncertainCategories = new Set(publication.uncertainCategories);
  const partitionIsValid =
    uncertainCategories.size === publication.uncertainCategories.length &&
    publication.uncertainCategories.every((category) =>
      (CONTENT_CATEGORIES as readonly string[]).includes(category),
    ) &&
    [...presentCategories].every((category) => !uncertainCategories.has(category)) &&
    CONTENT_CATEGORIES.every(
      (category) => presentCategories.has(category) || uncertainCategories.has(category),
    );

  if (!partitionIsValid) {
    issues.push({
      code: "CATEGORY_PARTITION_INVALID",
      messageAr: "كل محور يجب أن يكون إما مدعومًا بواقعة منشورة أو معلّمًا صراحة بأنه غير محسوم.",
    });
  }

  return {
    publishable: issues.length === 0 && publication.claims.length > 0 && publication.sources.length > 0,
    decisionEligible: false,
    decisionStatus: "insufficient_data",
    issues,
    corroboratedClaimCount: publication.claims.filter((claim) => claim.verification === "corroborated").length,
    singleSourceClaimCount: publication.claims.filter((claim) => claim.verification === "single_source").length,
    uncertainCategoryCount: publication.uncertainCategories.length,
  };
}

export function parseEditorialReviewId(value: unknown): string {
  if (typeof value !== "string") throw new TypeError("editorialId must be a string");
  const editorialId = value.trim();
  if (!isBoundedText(editorialId, 1, MAX_EDITORIAL_REVIEW_ID_LENGTH)) {
    throw new RangeError("editorialId length is invalid");
  }
  if (/[\u0000-\u001F\u007F]/u.test(editorialId)) {
    throw new TypeError("editorialId contains control characters");
  }
  return editorialId;
}

export function buildPublicEditorialReviewHref(editorialId: string): string {
  return `/review?editorialId=${encodeURIComponent(parseEditorialReviewId(editorialId))}`;
}

export function getEditorialCategoryLabelAr(category: ContentCategory): string {
  return CATEGORY_LABELS_AR[category];
}

function isBoundedText(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max &&
    !value.includes("\u0000")
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  return Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function isValidInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}
