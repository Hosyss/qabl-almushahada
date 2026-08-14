import type { ContentCategory } from "./review-engine/types.ts";
import type { AsymmetricFamilyDecision } from "./asymmetric-family-decision.ts";

const CATEGORY_LABELS_AR: Record<ContentCategory, string> = {
  fear: "الخوف والتوتر",
  violence: "العنف والإصابة",
  language: "الألفاظ",
  bullying: "التنمر",
  sexualContent: "المحتوى الجنسي والحميمي",
  substances: "التدخين والكحول والمخدرات والقمار",
  discrimination: "التمييز والكراهية",
  selfHarm: "إيذاء النفس",
  grief: "الفقد والموضوعات العاطفية",
  flashingLights: "الوميض البصري",
};

export const ASYMMETRIC_OUTCOME_LABELS_AR = {
  exceeds_family_limits: "يتجاوز حدودك",
  within_family_limits: "ضمن حدودك",
  insufficient_data: "المعلومات غير كافية",
} as const;

export function getAsymmetricCategoryLabelAr(category: ContentCategory): string {
  return CATEGORY_LABELS_AR[category];
}

export const ASYMMETRIC_SCOPE_LABELS_AR = {
  work_level: "على مستوى العمل",
  exact_version: "نسخة محددة موثقة",
} as const;

export const ASYMMETRIC_BASIS_LABELS_AR = {
  verified_present_evidence: "دليل موثّق على محتوى موجود",
  full_coverage: "تغطية مكتملة للمحاور",
  incomplete_evidence: "الأدلة الحالية غير مكتملة",
} as const;

export function buildAsymmetricDecisionPresentation(decision: AsymmetricFamilyDecision) {
  const needsAttention = decision.attentionCategories.length > 0;
  const outcomeLabelAr =
    decision.outcome === "within_family_limits" && needsAttention
      ? "ضمن حدودك — يحتاج انتباهك"
      : decision.outcome === "insufficient_data" && needsAttention
        ? "يحتاج انتباهك — والمعلومات غير مكتملة"
        : ASYMMETRIC_OUTCOME_LABELS_AR[decision.outcome];

  return {
    outcomeLabelAr,
    scopeLabelAr: ASYMMETRIC_SCOPE_LABELS_AR[decision.decisionScope],
    basisLabelAr: ASYMMETRIC_BASIS_LABELS_AR[decision.decisionBasis],
    preferencesLabelAr:
      decision.preferenceMode === "defaults_with_overrides"
        ? "استُخدمت تعديلاتك المحفوظة مع الإعدادات الافتراضية لبقية المحاور"
        : decision.preferenceMode === "defaults_only"
          ? "استُخدمت الإعدادات الافتراضية القابلة للتعديل"
          : "استُخدمت حدود مخصصة بالكامل",
    determiningCategoryLabelsAr: labels(decision.determiningCategories),
    attentionCategoryLabelsAr: labels(decision.attentionCategories),
    unknownCategoryLabelsAr: labels(decision.unknownCategories),
    severityMissingCategoryLabelsAr: labels(decision.severityMissingCategories),
  };
}

function labels(categories: readonly ContentCategory[]): string[] {
  return categories.map((category) => CATEGORY_LABELS_AR[category]);
}
