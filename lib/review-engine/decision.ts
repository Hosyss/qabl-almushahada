import { assessReviewQuality } from "./quality-gated.ts";
import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type ContentCategory,
  type DecisionReason,
  type FamilyDecision,
  type FamilyProfile,
  type ReviewBundle,
  type Severity,
} from "./types.ts";

export const CATEGORY_LABELS_AR: Record<ContentCategory, string> = {
  fear: "الخوف والتوتر",
  violence: "العنف والإصابة",
  language: "الألفاظ",
  bullying: "التنمر",
  sexualContent: "المحتوى الجنسي",
  substances: "التدخين والمواد",
  discrimination: "التمييز والكراهية",
  selfHarm: "إيذاء النفس",
  grief: "الفقد والموضوعات العاطفية",
  flashingLights: "الوميض البصري",
};

export const VERDICT_LABELS_AR: Record<FamilyDecision["verdict"], string> = {
  suitable: "مناسب وفق حدودك",
  with_guidance: "مناسب بمرافقة",
  not_suitable: "غير مناسب وفق حدودك",
  insufficient_data: "البيانات غير كافية",
};

function emptyCategorySeverity(): Record<ContentCategory, Severity> {
  return Object.fromEntries(CONTENT_CATEGORIES.map((category) => [category, 0])) as Record<
    ContentCategory,
    Severity
  >;
}

function validateFamilyProfile(family: FamilyProfile): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(family.childAge) || family.childAge < 3 || family.childAge > 18) {
    errors.push("عمر الطفل يجب أن يكون رقمًا صحيحًا بين 3 و18 سنة");
  }

  for (const category of CONTENT_CATEGORIES) {
    const limit = family.maxSeverity?.[category];
    if (!Number.isInteger(limit) || limit < 0 || limit > 4) {
      errors.push(`حد محور «${CATEGORY_LABELS_AR[category]}» غير صالح`);
    }
  }

  for (const flag of family.blockedFlags ?? []) {
    if (!(CONTENT_FLAGS as readonly string[]).includes(flag)) {
      errors.push(`عنصر المنع «${flag}» غير معروف`);
    }
  }

  return errors;
}

export function decideForFamily(bundle: ReviewBundle, family: FamilyProfile): FamilyDecision {
  const quality = assessReviewQuality(bundle);
  const categorySeverity = emptyCategorySeverity();

  const profileErrors = validateFamilyProfile(family);
  if (profileErrors.length > 0) {
    return {
      verdict: "insufficient_data",
      summaryAr: "إعدادات الأسرة غير مكتملة، لذلك توقف القرار بدل استخدام حدود افتراضية مخفية.",
      confidence: "unavailable",
      quality,
      categorySeverity,
      reasons: [
        {
          code: "profile_invalid",
          evidenceObservationIds: [],
          messageAr: profileErrors.join("؛ "),
        },
      ],
    };
  }

  if (!quality.publishable) {
    const blockingCodes = quality.issues
      .filter((item) => item.level === "blocking")
      .map((item) => item.code);

    return {
      verdict: "insufficient_data",
      summaryAr: "البيانات لا تكفي لإصدار قرار آمن. نعرض سبب التوقف بدل التخمين.",
      confidence: quality.confidence,
      quality,
      categorySeverity,
      reasons: [
        {
          code: "quality_gate",
          evidenceObservationIds: [],
          messageAr: `بوابة الجودة أوقفت القرار: ${blockingCodes.join("، ") || "مراجعة مطلوبة"}.`,
        },
      ],
    };
  }

  const eligibleIds = new Set(quality.eligibleSubmissionIds);
  const eligibleSubmissions = bundle.submissions.filter((submission) => eligibleIds.has(submission.id));
  const evidenceByCategory = new Map<ContentCategory, string[]>();
  const flagsWithEvidence = new Map<string, string[]>();

  for (const submission of eligibleSubmissions) {
    for (const observation of submission.observations) {
      categorySeverity[observation.category] = Math.max(
        categorySeverity[observation.category],
        observation.severity,
      ) as Severity;

      const categoryEvidence = evidenceByCategory.get(observation.category) ?? [];
      categoryEvidence.push(observation.id);
      evidenceByCategory.set(observation.category, categoryEvidence);

      for (const flag of observation.flags) {
        const flagEvidence = flagsWithEvidence.get(flag) ?? [];
        flagEvidence.push(observation.id);
        flagsWithEvidence.set(flag, flagEvidence);
      }
    }
  }

  const blockingReasons: DecisionReason[] = [];
  const guidanceReasons: DecisionReason[] = [];

  for (const blockedFlag of family.blockedFlags) {
    const evidence = flagsWithEvidence.get(blockedFlag);
    if (!evidence?.length) continue;

    blockingReasons.push({
      code: "blocked_flag",
      flag: blockedFlag,
      evidenceObservationIds: [...new Set(evidence)],
      messageAr: `يوجد عنصر منع صريح في إعدادات الأسرة: ${blockedFlag}.`,
    });
  }

  for (const category of CONTENT_CATEGORIES) {
    const observedSeverity = categorySeverity[category];
    const allowedSeverity = family.maxSeverity[category];
    if (observedSeverity === 0) continue;

    const reasonBase = {
      category,
      observedSeverity,
      allowedSeverity,
      evidenceObservationIds: [...new Set(evidenceByCategory.get(category) ?? [])],
    };

    if (observedSeverity > allowedSeverity) {
      blockingReasons.push({
        code: "category_exceeds_limit",
        ...reasonBase,
        messageAr: `${CATEGORY_LABELS_AR[category]} شدته ${observedSeverity} وتتجاوز حد الأسرة ${allowedSeverity}.`,
      });
    } else if (observedSeverity === allowedSeverity) {
      guidanceReasons.push({
        code: "category_at_limit",
        ...reasonBase,
        messageAr: `${CATEGORY_LABELS_AR[category]} وصل إلى الحد الذي اختارته الأسرة.`,
      });
    }
  }

  if (blockingReasons.length > 0) {
    return {
      verdict: "not_suitable",
      summaryAr: "غير مناسب وفق الحدود الحالية، والأسباب مرتبطة بوقائع قابلة للمراجعة.",
      confidence: quality.confidence,
      quality,
      reasons: blockingReasons,
      categorySeverity,
    };
  }

  if (guidanceReasons.length > 0) {
    return {
      verdict: "with_guidance",
      summaryAr: "مناسب بمرافقة لأن محورًا واحدًا على الأقل وصل إلى حد الأسرة من غير تجاوزه.",
      confidence: quality.confidence,
      quality,
      reasons: guidanceReasons,
      categorySeverity,
    };
  }

  return {
    verdict: "suitable",
    summaryAr: "مناسب وفق الحدود الحالية؛ كل المحاور المسجلة أقل من الحدود المختارة.",
    confidence: quality.confidence,
    quality,
    reasons: [],
    categorySeverity,
  };
}
