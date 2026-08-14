import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type ContentCategory,
  type ContentFlag,
  type FamilyProfile,
  type Severity,
} from "./review-engine/types.ts";

export type AsymmetricDecisionOutcome =
  | "exceeds_family_limits"
  | "within_family_limits"
  | "insufficient_data";

export type AsymmetricDecisionScope = "work_level" | "exact_version";
export type AsymmetricDecisionBasis =
  | "verified_present_evidence"
  | "full_coverage"
  | "incomplete_evidence";
export type AsymmetricCategoryStatus = "present" | "none" | "unknown" | "conflicted";
export type AsymmetricPreferenceMode = "defaults_only" | "defaults_with_overrides" | "fully_custom";

export interface AsymmetricCategoryEvidence {
  category: ContentCategory;
  status: AsymmetricCategoryStatus;
  severity: Severity | null;
  /** True only after the caller has applied source/quality eligibility rules. */
  decisionEligible: boolean;
  sourceIds: string[];
  evidenceIds: string[];
  flags: ContentFlag[];
}

export interface AsymmetricDecisionReason {
  code: "category_exceeds_limit" | "blocked_flag" | "category_at_limit";
  category: ContentCategory;
  observedSeverity: Severity | null;
  allowedSeverity: Severity;
  flag?: ContentFlag;
  sourceIds: string[];
  evidenceIds: string[];
}

export interface AsymmetricFamilyDecision {
  outcome: AsymmetricDecisionOutcome;
  decisionScope: AsymmetricDecisionScope;
  decisionBasis: AsymmetricDecisionBasis;
  usedDefaultPreferences: boolean;
  preferenceMode: AsymmetricPreferenceMode;
  determiningCategories: ContentCategory[];
  attentionCategories: ContentCategory[];
  unknownCategories: ContentCategory[];
  conflictedCategories: ContentCategory[];
  ineligiblePresentCategories: ContentCategory[];
  severityMissingCategories: ContentCategory[];
  reasons: AsymmetricDecisionReason[];
}

export interface AsymmetricFamilyDecisionInput {
  scope: AsymmetricDecisionScope;
  exactVersionIdentityEstablished: boolean;
  usedDefaultPreferences: boolean;
  preferenceMode?: AsymmetricPreferenceMode;
  /** Required for a positive exact-version result; negative exceedance does not require full coverage. */
  fullEvidenceGatePassed: boolean;
  family: FamilyProfile;
  categories: Record<ContentCategory, AsymmetricCategoryEvidence>;
}

export function emptyAsymmetricCategoryEvidence(): Record<ContentCategory, AsymmetricCategoryEvidence> {
  return Object.fromEntries(
    CONTENT_CATEGORIES.map((category) => [
      category,
      {
        category,
        status: "unknown",
        severity: null,
        decisionEligible: false,
        sourceIds: [],
        evidenceIds: [],
        flags: [],
      },
    ]),
  ) as Record<ContentCategory, AsymmetricCategoryEvidence>;
}

export function decideAsymmetricallyForFamily(
  input: AsymmetricFamilyDecisionInput,
): AsymmetricFamilyDecision {
  assertFamilyProfile(input.family);
  assertCategoryEvidence(input.categories);

  const reasons: AsymmetricDecisionReason[] = [];
  const preferenceMode: AsymmetricPreferenceMode =
    input.preferenceMode ?? (input.usedDefaultPreferences ? "defaults_only" : "fully_custom");
  const attentionCategories = new Set<ContentCategory>();
  const effectiveScope: AsymmetricDecisionScope =
    input.scope === "exact_version" && input.exactVersionIdentityEstablished
      ? "exact_version"
      : "work_level";

  for (const category of CONTENT_CATEGORIES) {
    const evidence = input.categories[category];
    if (evidence.status !== "present" || !evidence.decisionEligible) continue;

    const allowedSeverity = input.family.maxSeverity[category];
    if (evidence.severity !== null && evidence.severity > allowedSeverity) {
      reasons.push({
        code: "category_exceeds_limit",
        category,
        observedSeverity: evidence.severity,
        allowedSeverity,
        sourceIds: unique(evidence.sourceIds),
        evidenceIds: unique(evidence.evidenceIds),
      });
    } else if (evidence.severity !== null && evidence.severity === allowedSeverity) {
      attentionCategories.add(category);
    }

    for (const flag of evidence.flags) {
      if (!input.family.blockedFlags.includes(flag)) continue;
      reasons.push({
        code: "blocked_flag",
        category,
        observedSeverity: evidence.severity,
        allowedSeverity,
        flag,
        sourceIds: unique(evidence.sourceIds),
        evidenceIds: unique(evidence.evidenceIds),
      });
    }
  }

  const determiningCategories = unique(reasons.map((reason) => reason.category));
  const unknownCategories = CONTENT_CATEGORIES.filter(
    (category) => input.categories[category].status === "unknown",
  );
  const conflictedCategories = CONTENT_CATEGORIES.filter(
    (category) => input.categories[category].status === "conflicted",
  );
  const ineligiblePresentCategories = CONTENT_CATEGORIES.filter((category) => {
    const evidence = input.categories[category];
    return evidence.status === "present" && !evidence.decisionEligible;
  });
  const severityMissingCategories = CONTENT_CATEGORIES.filter((category) => {
    const evidence = input.categories[category];
    return evidence.status === "present" && evidence.decisionEligible && evidence.severity === null;
  });

  // Negative decisions are intentionally asymmetric: one verified, decision-eligible
  // present fact that exceeds the family's settings is sufficient. Unknown unrelated
  // axes cannot cancel an exceedance that has already been proven.
  if (reasons.some((reason) => reason.code === "category_exceeds_limit" || reason.code === "blocked_flag")) {
    return {
      outcome: "exceeds_family_limits",
      decisionScope: effectiveScope,
      decisionBasis: "verified_present_evidence",
      usedDefaultPreferences: input.usedDefaultPreferences,
      preferenceMode,
      determiningCategories,
      attentionCategories: [...attentionCategories],
      unknownCategories,
      conflictedCategories,
      ineligiblePresentCategories,
      severityMissingCategories,
      reasons,
    };
  }

  const hasFullCoverage = CONTENT_CATEGORIES.every((category) => {
    const evidence = input.categories[category];
    if (!evidence.decisionEligible) return false;
    if (evidence.status === "none") return evidence.severity === 0;
    if (evidence.status === "present") return evidence.severity !== null;
    return false;
  });

  // Positive suitability remains fail-closed: it needs complete, eligible evidence
  // for the exact version and no unresolved/conflicted axis.
  if (
    effectiveScope === "exact_version" &&
    input.fullEvidenceGatePassed &&
    hasFullCoverage &&
    unknownCategories.length === 0 &&
    conflictedCategories.length === 0 &&
    ineligiblePresentCategories.length === 0 &&
    severityMissingCategories.length === 0
  ) {
    return {
      outcome: "within_family_limits",
      decisionScope: "exact_version",
      decisionBasis: "full_coverage",
      usedDefaultPreferences: input.usedDefaultPreferences,
      preferenceMode,
      determiningCategories: [],
      attentionCategories: [...attentionCategories],
      unknownCategories: [],
      conflictedCategories: [],
      ineligiblePresentCategories: [],
      severityMissingCategories: [],
      reasons: [...attentionCategories].map((category) => ({
        code: "category_at_limit" as const,
        category,
        observedSeverity: input.categories[category].severity,
        allowedSeverity: input.family.maxSeverity[category],
        sourceIds: unique(input.categories[category].sourceIds),
        evidenceIds: unique(input.categories[category].evidenceIds),
      })),
    };
  }

  return {
    outcome: "insufficient_data",
    decisionScope: effectiveScope,
    decisionBasis: "incomplete_evidence",
    usedDefaultPreferences: input.usedDefaultPreferences,
    preferenceMode,
    determiningCategories: [],
    attentionCategories: [...attentionCategories],
    unknownCategories,
    conflictedCategories,
    ineligiblePresentCategories,
    severityMissingCategories,
    reasons: [],
  };
}

function assertFamilyProfile(family: FamilyProfile): void {
  if (!Number.isInteger(family.childAge) || family.childAge < 3 || family.childAge > 18) {
    throw new RangeError("family.childAge must be an integer between 3 and 18");
  }
  for (const category of CONTENT_CATEGORIES) {
    const limit = family.maxSeverity?.[category];
    if (!Number.isInteger(limit) || limit < 0 || limit > 4) {
      throw new RangeError(`family.maxSeverity.${category} must be between 0 and 4`);
    }
  }
  for (const flag of family.blockedFlags ?? []) {
    if (!(CONTENT_FLAGS as readonly string[]).includes(flag)) {
      throw new TypeError(`Unknown blocked flag: ${flag}`);
    }
  }
}

function assertCategoryEvidence(
  categories: Record<ContentCategory, AsymmetricCategoryEvidence>,
): void {
  for (const category of CONTENT_CATEGORIES) {
    const evidence = categories?.[category];
    if (!evidence || evidence.category !== category) {
      throw new TypeError(`Missing or mismatched category evidence: ${category}`);
    }
    if (!["present", "none", "unknown", "conflicted"].includes(evidence.status)) {
      throw new TypeError(`Invalid category status: ${category}`);
    }
    if (typeof evidence.decisionEligible !== "boolean") {
      throw new TypeError(`decisionEligible must be boolean: ${category}`);
    }
    if (evidence.status === "none" && evidence.severity !== 0) {
      throw new TypeError(`none category must have severity 0: ${category}`);
    }
    if (evidence.status === "present" && evidence.severity === 0) {
      throw new TypeError(`present category cannot have severity 0: ${category}`);
    }
    if (
      evidence.severity !== null &&
      (!Number.isInteger(evidence.severity) || evidence.severity < 0 || evidence.severity > 4)
    ) {
      throw new RangeError(`Invalid severity: ${category}`);
    }
    for (const flag of evidence.flags) {
      if (!(CONTENT_FLAGS as readonly string[]).includes(flag)) {
        throw new TypeError(`Unknown evidence flag: ${flag}`);
      }
    }
  }
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)];
}
