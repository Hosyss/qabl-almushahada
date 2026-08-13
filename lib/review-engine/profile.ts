import {
  CONTENT_CATEGORIES,
  type ContentCategory,
  type FamilyProfile,
  type Severity,
} from "./types.ts";

function agePreset(age: number): Severity {
  if (age <= 5) return 0;
  if (age <= 8) return 1;
  if (age <= 11) return 2;
  if (age <= 14) return 3;
  return 4;
}

export function getExampleAgeSeverityLimit(age: number): Severity {
  if (!Number.isInteger(age) || age < 3 || age > 18) {
    throw new RangeError("age must be an integer between 3 and 18");
  }
  return agePreset(age);
}

/**
 * UI helper only. The returned limits are visible and editable by the family;
 * they are not a medical or universal age recommendation.
 */
export function createExampleFamilyProfile(options: {
  childAge: number;
  fearLimit: Severity;
  avoidBullying: boolean;
}): FamilyProfile {
  const base = agePreset(options.childAge);
  const maxSeverity = Object.fromEntries(
    CONTENT_CATEGORIES.map((category) => [category, base]),
  ) as Record<ContentCategory, Severity>;

  maxSeverity.fear = options.fearLimit;
  maxSeverity.bullying = options.avoidBullying ? 0 : base;

  return {
    id: "local-example-family",
    childAge: options.childAge,
    maxSeverity,
    blockedFlags: options.avoidBullying ? ["verbal_bullying", "physical_bullying"] : [],
  };
}
