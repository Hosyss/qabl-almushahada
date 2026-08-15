import type { ContentCategory, FamilyProfile } from "./review-engine/types.ts";
import {
  assessEditorialReviewPublication,
  type EditorialReviewPublication,
} from "./editorial-review.ts";
import { claimHasPersistableDecisionEvidence } from "./editorial-work-level-decision.ts";

export const EDITORIAL_PRACTICAL_MIN_AGE_DAYS = 90;

export type EditorialPracticalVerdictOutcome =
  | "watch"
  | "watch_with_guidance"
  | "not_recommended"
  | "not_ready";

export type EditorialPracticalVerdictConfidence = "medium" | "low" | "unavailable";

export interface EditorialPracticalVerdict {
  outcome: EditorialPracticalVerdictOutcome;
  confidence: EditorialPracticalVerdictConfidence;
  establishedWork: boolean;
  familyProfileApplied: boolean;
  determiningCategories: ContentCategory[];
  knownPresentCategories: ContentCategory[];
  decisionSupportedPresentCategories: ContentCategory[];
  unknownCategories: ContentCategory[];
  referenceOnlyCategories: ContentCategory[];
  independentSourceGroupCount: number;
  corroboratedClaimCount: number;
  reasonCode:
    | "established_editorial_guidance"
    | "zero_tolerance_content_present"
    | "full_editorial_coverage"
    | "publication_quality_failed"
    | "work_not_old_enough"
    | "editorial_corpus_too_thin";
}

export function isEditorialWorkEstablished(options: {
  releaseYear: number;
  releaseDate?: string | null;
  now?: Date;
}): boolean {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new TypeError("now must be a valid date");

  if (options.releaseDate) {
    const releaseMs = Date.parse(`${options.releaseDate}T00:00:00Z`);
    if (!Number.isFinite(releaseMs) || releaseMs > now.getTime()) return false;
    const ageDays = Math.floor((now.getTime() - releaseMs) / 86_400_000);
    return ageDays >= EDITORIAL_PRACTICAL_MIN_AGE_DAYS;
  }

  const currentYear = now.getUTCFullYear();
  if (options.releaseYear <= currentYear - 2) return true;

  // With year-only catalog data, a title from the previous calendar year is
  // guaranteed to be at least 90 days old only once April begins. We do not
  // guess a month/day for same-year titles.
  if (options.releaseYear === currentYear - 1) {
    const guaranteedNinetyDayPoint = Date.UTC(currentYear, 3, 1);
    return now.getTime() >= guaranteedNinetyDayPoint;
  }

  return false;
}

export function decidePracticalEditorialVerdict(options: {
  review: EditorialReviewPublication;
  publicationQualityPassed?: boolean;
  family?: FamilyProfile | null;
  releaseDate?: string | null;
  now?: Date;
}): EditorialPracticalVerdict {
  const assessment = assessEditorialReviewPublication(options.review);
  const publicationQualityPassed = options.publicationQualityPassed ?? assessment.publishable;
  const establishedWork = isEditorialWorkEstablished({
    releaseYear: options.review.releaseYear,
    releaseDate: options.releaseDate,
    now: options.now,
  });

  const independentSourceGroupCount = new Set(
    options.review.sources.map((source) => source.independenceGroupId),
  ).size;
  const corroboratedClaimCount = options.review.claims.filter(
    (claim) => claim.verification === "corroborated",
  ).length;
  const knownPresentCategories = unique(options.review.claims.map((claim) => claim.category));
  const decisionSupportedClaims = options.review.claims.filter((claim) =>
    claimHasPersistableDecisionEvidence(claim, options.review),
  );
  const decisionSupportedPresentCategories = unique(
    decisionSupportedClaims.map((claim) => claim.category),
  );
  const referenceOnlyCategories = unique(
    options.review.claims
      .filter((claim) => !claimHasPersistableDecisionEvidence(claim, options.review))
      .map((claim) => claim.category),
  );
  const unknownCategories = [...options.review.uncertainCategories];

  const base = {
    establishedWork,
    familyProfileApplied: Boolean(options.family),
    determiningCategories: [] as ContentCategory[],
    knownPresentCategories,
    decisionSupportedPresentCategories,
    unknownCategories,
    referenceOnlyCategories,
    independentSourceGroupCount,
    corroboratedClaimCount,
  };

  if (!publicationQualityPassed || !assessment.publishable) {
    return {
      ...base,
      outcome: "not_ready",
      confidence: "unavailable",
      reasonCode: "publication_quality_failed",
    };
  }

  if (!establishedWork) {
    return {
      ...base,
      outcome: "not_ready",
      confidence: "unavailable",
      reasonCode: "work_not_old_enough",
    };
  }

  // A practical verdict needs a real editorial corpus, not merely an old title.
  // Two independent source groups plus at least one corroborated claim keeps the
  // path from turning age alone into authority.
  if (independentSourceGroupCount < 2 || corroboratedClaimCount < 1) {
    return {
      ...base,
      outcome: "not_ready",
      confidence: "unavailable",
      reasonCode: "editorial_corpus_too_thin",
    };
  }

  if (options.family) {
    // A verified present category necessarily has severity > 0. Therefore it can
    // safely exceed a family limit of zero without inventing a numeric severity.
    const zeroToleranceExceedances = decisionSupportedPresentCategories.filter(
      (category) => options.family!.maxSeverity[category] === 0,
    );
    if (zeroToleranceExceedances.length > 0) {
      return {
        ...base,
        outcome: "not_recommended",
        confidence: "medium",
        determiningCategories: zeroToleranceExceedances,
        reasonCode: "zero_tolerance_content_present",
      };
    }
  }

  if (unknownCategories.length === 0 && referenceOnlyCategories.length === 0) {
    return {
      ...base,
      outcome: "watch",
      confidence: "medium",
      reasonCode: "full_editorial_coverage",
    };
  }

  // Unknown stays unknown. It lowers the strength of the recommendation, but it
  // no longer erases a useful verdict for an established, quality-passed work.
  return {
    ...base,
    outcome: "watch_with_guidance",
    confidence: "medium",
    reasonCode: "established_editorial_guidance",
  };
}

export const EDITORIAL_PRACTICAL_OUTCOME_LABELS_AR = {
  watch: "ينفع للمشاهدة",
  watch_with_guidance: "ينفع للمشاهدة مع انتباه",
  not_recommended: "لا أنصح به وفق حدود أسرتك",
  not_ready: "الحكم العملي غير جاهز بعد",
} as const;

export function buildPracticalEditorialVerdictSummaryAr(
  verdict: EditorialPracticalVerdict,
): string {
  if (verdict.outcome === "not_recommended") {
    return "وجدنا محتوى موثّقًا في محور اخترت له حدًا صفرًا؛ لذلك يتجاوز حدود أسرتك من غير اختراع درجة شدة.";
  }
  if (verdict.outcome === "watch") {
    return "التحليل التحريري الناضج لا يحتوي محورًا غير محسوم في هذا السجل، لذلك الحكم العملي يسمح بالمشاهدة على مستوى العمل.";
  }
  if (verdict.outcome === "watch_with_guidance") {
    return "العمل قديم بما يكفي وله تحليل متعدد المصادر؛ ينفع للمشاهدة مع الانتباه للوقائع والمحاور غير المحسومة الموضحة أدناه.";
  }
  if (verdict.reasonCode === "work_not_old_enough") {
    return "لم نثبت بعد مرور 90 يومًا على الإصدار، لذلك لا نصدر حكمًا عمليًا مبكرًا.";
  }
  if (verdict.reasonCode === "editorial_corpus_too_thin") {
    return "العنوان موجود، لكن التحليل الحالي لا يملك بعد مصدرين مستقلين وواقعة واحدة مؤكدة بينهما على الأقل.";
  }
  return "سجل التحليل لم يجتز بوابة الجودة، لذلك لا نستخدمه لإصدار حكم.";
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
