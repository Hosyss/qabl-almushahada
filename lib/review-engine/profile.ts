import { createArabFamilyProfile } from "../arab-family-policy.ts";
import type { FamilyProfile, Severity } from "./types.ts";

function agePreset(age: number): Severity {
  if (age <= 5) return 0;
  if (age <= 8) return 1;
  if (age <= 11) return 2;
  if (age <= 14) return 3;
  return 4;
}

/**
 * Search-only coarse age severity helper kept for the current P3-05 filter.
 * It is not the family decision policy because the Arab-family decision profile
 * uses category-specific limits instead of one foreign-style age number.
 */
export function getExampleAgeSeverityLimit(age: number): Severity {
  if (!Number.isInteger(age) || age < 3 || age > 18) {
    throw new RangeError("age must be an integer between 3 and 18");
  }
  return agePreset(age);
}

/**
 * Backward-compatible UI helper name.
 *
 * The implementation now uses the explicit Arab-family editorial defaults while
 * preserving the same visible/editable inputs. This is not an official age rating;
 * the family can still change fear and bullying limits locally.
 */
export function createExampleFamilyProfile(options: {
  childAge: number;
  fearLimit: Severity;
  avoidBullying: boolean;
}): FamilyProfile {
  return createArabFamilyProfile(options);
}
