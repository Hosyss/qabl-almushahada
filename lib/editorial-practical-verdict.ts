import type { ContentCategory, FamilyProfile } from "./review-engine/types.ts";
import {
  assessEditorialReviewPublication,
  type EditorialReviewPublication,
} from "./editorial-review.ts";
import { claimHasPersistableDecisionEvidence } from "./editorial-work-level-decision.ts";

export const EDITORIAL_PRACTICAL_MIN_AGE_DAYS = 90;

export type EditorialPracticalVerdictOutcome =
  | "watch"
  | "needs_attention"
  | "not_recommended"
  | "needs_family_profile"
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
  attentionCategories: ContentCategory[];
  independentSourceGroupCount: number;
  corroboratedClaimCount: number;
  reasonCode:
    | "within_provable_family_bounds"
    | "family_profile_required"
    | "attention_required_for_unbounded_or_unknown_content"
    | "zero_tolerance_content_present"
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

  // The catalog currently stores only release year. A title from the previous
  // calendar year is guaranteed to be at least 90 days old only from April 1.
  // Same-year titles never get a fabricated month/day.
  if (options.releaseYear === currentYear - 1) {
    return now.getTime() >= Date.UTC(currentYear, 3, 1);
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
    attentionCategories: [] as ContentCategory[],
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

  // Age is not evidence. Mature work still needs a real multi-source editorial corpus.
  if (independentSourceGroupCount < 2 || corroboratedClaimCount < 1) {
    return {
      ...base,
      outcome: "not_ready",
      confidence: "unavailable",
      reasonCode: "editorial_corpus_too_thin",
    };
  }

  if (!options.family) {
    return {
      ...base,
      outcome: "needs_family_profile",
      confidence: "medium",
      reasonCode: "family_profile_required",
    };
  }

  // A verified present category necessarily has severity > 0. It can therefore
  // exceed a zero family limit without inventing a numeric severity.
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

  // Without numeric severity we can only prove a positive bound when the family's
  // limit is the maximum value (4). Anything with a 1..3 limit needs attention,
  // not a fake "safe" verdict. Unknown/reference-only categories are treated the
  // same way: they remain unknown, but they no longer erase the practical verdict.
  const attentionCategories = unique([
    ...decisionSupportedPresentCategories.filter(
      (category) => options.family!.maxSeverity[category] < 4,
    ),
    ...referenceOnlyCategories.filter(
      (category) => options.family!.maxSeverity[category] < 4,
    ),
    ...unknownCategories.filter(
      (category) => options.family!.maxSeverity[category] < 4,
    ),
  ]);

  if (attentionCategories.length > 0) {
    return {
      ...base,
      outcome: "needs_attention",
      confidence: "medium",
      attentionCategories,
      reasonCode: "attention_required_for_unbounded_or_unknown_content",
    };
  }

  return {
    ...base,
    outcome: "watch",
    confidence: "medium",
    reasonCode: "within_provable_family_bounds",
  };
}

export const EDITORIAL_PRACTICAL_OUTCOME_LABELS_AR = {
  watch: "ينفع للمشاهدة وفق حدود أسرتك",
  needs_attention: "يحتاج انتباهك قبل المشاهدة",
  not_recommended: "لا أنصح به وفق حدود أسرتك",
  needs_family_profile: "حدد عمر الطفل لإصدار الحكم",
  not_ready: "الحكم العملي غير جاهز بعد",
} as const;

export function buildPracticalEditorialVerdictSummaryAr(
  verdict: EditorialPracticalVerdict,
): string {
  if (verdict.outcome === "not_recommended") {
    return "وجدنا محتوى موثّقًا في محور اخترت له حدًا صفرًا؛ لذلك يتجاوز حدود أسرتك من غير اختراع درجة شدة.";
  }
  if (verdict.outcome === "watch") {
    return "كل ما يمكن أن يؤثر في الحكم الحالي يقع داخل حدود يمكن إثباتها من غير اختراع شدة؛ لذلك ينفع للمشاهدة وفق إعدادات الأسرة الحالية.";
  }
  if (verdict.outcome === "needs_attention") {
    return "الفيلم ناضج وله تحليل متعدد المصادر، لكن بعض الوقائع أو المحاور لا نملك لها شدة رقمية تكفي لإثبات أنها داخل حد أسرتك. الحكم العملي هنا: راجع النقاط الموضحة قبل المشاهدة.";
  }
  if (verdict.outcome === "needs_family_profile") {
    return "الأدلة كافية لإصدار حكم عملي، لكن الملاءمة تعتمد على عمر الطفل وحدود الأسرة. اختر الإعدادات مرة واحدة ليظهر الحكم بدل رسالة «المعلومات غير كافية».";
  }
  if (verdict.reasonCode === "work_not_old_enough") {
    return "لم نثبت بعد مرور 90 يومًا على الإصدار، لذلك لا نصدر حكمًا عمليًا مبكرًا.";
  }
  if (verdict.reasonCode === "editorial_corpus_too_thin") {
    return "العنوان موجود، لكن التحليل الحالي لا يملك بعد مصدرين مستقلين وواقعة واحدة مؤكدة بينهما على الأقل.";
  }
  return "سجل التحليل لم يجتز بوابة الجودة، لذلك لا نستخدمه لإصدار حكم.";
}

export function buildPracticalEditorialReviewDescription(
  review: Pick<EditorialReviewPublication, "titleLabel" | "releaseYear" | "uncertainCategories">,
): string {
  return `${review.titleLabel} (${review.releaseYear}) — تحليل عربي متعدد المصادر يقدّم حكمًا عمليًا وفق عمر الطفل وحدود الأسرة، ويعرض الوقائع و${review.uncertainCategories.length} من 10 محاور غير محسومة بوضوح من غير تحويلها إلى «لا يوجد».`;
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
