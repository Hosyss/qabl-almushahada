import {
  CONTENT_CATEGORIES,
  type ContentCategory,
  type FamilyProfile,
  type Severity,
} from "./review-engine/types.ts";

export const ARAB_FAMILY_POLICY_VERSION = "2026-08-13.1";

export const ARAB_FAMILY_POLICY_LABEL_AR = "إعدادات افتراضية قابلة للتعديل";

export const ARAB_FAMILY_POLICY_NOTICE_AR =
  "هذه إعدادات تحريرية افتراضية قابلة للتعديل، وليست تصنيفًا عمريًا رسميًا ولا معيارًا موحدًا للأسر العربية. يمكن للأسرة تعديل حدودها، والنتيجة تشرح إن كانت الأدلة ضمن حدودها أو تتجاوزها بدل ادعاء عمر مناسب عالمي.";

function generalAgeLimit(age: number): Severity {
  if (age <= 5) return 0;
  if (age <= 8) return 1;
  if (age <= 11) return 2;
  if (age <= 14) return 3;
  return 4;
}

function sexualContentLimit(age: number): Severity {
  if (age <= 8) return 0;
  if (age <= 11) return 1;
  if (age <= 14) return 2;
  return 3;
}

function languageLimit(age: number): Severity {
  if (age <= 8) return 0;
  if (age <= 11) return 1;
  if (age <= 14) return 2;
  return 3;
}

function substancesLimit(age: number): Severity {
  if (age <= 8) return 0;
  if (age <= 11) return 0;
  if (age <= 14) return 1;
  return 2;
}

function selfHarmLimit(age: number): Severity {
  if (age <= 8) return 0;
  if (age <= 11) return 1;
  if (age <= 14) return 2;
  return 3;
}

export function getArabFamilyCategoryLimits(age: number): Record<ContentCategory, Severity> {
  if (!Number.isInteger(age) || age < 3 || age > 18) {
    throw new RangeError("age must be an integer between 3 and 18");
  }

  const base = generalAgeLimit(age);
  const limits = Object.fromEntries(
    CONTENT_CATEGORIES.map((category) => [category, base]),
  ) as Record<ContentCategory, Severity>;

  // This editorial preset is intentionally conservative in selected categories.
  // It is a configurable product default, not a scientific or official age-rating standard.
  limits.sexualContent = sexualContentLimit(age);
  limits.language = languageLimit(age);
  limits.substances = substancesLimit(age);
  limits.selfHarm = selfHarmLimit(age);

  return limits;
}

export function createArabFamilyProfile(options: {
  childAge: number;
  fearLimit?: Severity;
  avoidBullying?: boolean;
}): FamilyProfile {
  const maxSeverity = getArabFamilyCategoryLimits(options.childAge);
  const avoidBullying = options.avoidBullying ?? true;

  if (options.fearLimit !== undefined) {
    maxSeverity.fear = options.fearLimit;
  }
  if (avoidBullying) {
    maxSeverity.bullying = 0;
  }

  return {
    id: `arab-family-policy:${ARAB_FAMILY_POLICY_VERSION}`,
    childAge: options.childAge,
    maxSeverity,
    blockedFlags: avoidBullying ? ["verbal_bullying", "physical_bullying"] : [],
  };
}
