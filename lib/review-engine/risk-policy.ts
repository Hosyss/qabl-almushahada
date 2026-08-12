import type {
  ContentCategory,
  ContentFlag,
  ObservedSeverity,
  ReviewSubmission,
} from "./types.ts";

export const HIGH_SENSITIVITY_CATEGORY_THRESHOLDS: Partial<
  Record<ContentCategory, ObservedSeverity>
> = {
  selfHarm: 1,
  sexualContent: 2,
  flashingLights: 2,
  violence: 3,
  substances: 3,
  discrimination: 3,
  bullying: 3,
};

export const HIGH_SENSITIVITY_FLAG_THRESHOLDS: Partial<Record<ContentFlag, ObservedSeverity>> = {
  flashing_sequence: 1,
  blood: 3,
  weapon: 3,
  physical_bullying: 3,
};

export type ThirdReviewRiskCode =
  | "severity_4_any_category"
  | "sensitive_category_threshold"
  | "sensitive_flag_threshold";

export interface ThirdReviewRiskTrigger {
  code: ThirdReviewRiskCode;
  submissionId: string;
  observationId: string;
  category: ContentCategory;
  severity: ObservedSeverity;
  flag?: ContentFlag;
}

export interface ThirdReviewRequirement {
  required: boolean;
  minimumReviewerCount: 2 | 3;
  triggers: ThirdReviewRiskTrigger[];
}

/**
 * P2-03 risk policy.
 *
 * The policy is deliberately deterministic and reviewable. It never lowers the
 * normal two-reviewer floor; it only raises the required independent reviewer
 * count to three when an active human submission contains a high-sensitivity
 * observation.
 *
 * Rules:
 * - severity 4 in any category always requires a third independent reviewer;
 * - self-harm at any observed severity requires a third reviewer;
 * - sexual content or flashing-light risk from severity 2;
 * - violence, substances, discrimination, or bullying from severity 3;
 * - flashing-sequence flags at any severity;
 * - blood, weapon, or physical-bullying flags from severity 3.
 */
export function assessThirdReviewRequirement(
  submissions: readonly ReviewSubmission[],
): ThirdReviewRequirement {
  const triggers: ThirdReviewRiskTrigger[] = [];
  const seen = new Set<string>();

  for (const submission of submissions) {
    if (submission.reviewer.status !== "active") continue;

    for (const observation of submission.observations) {
      if (observation.severity === 4) {
        pushTrigger(triggers, seen, {
          code: "severity_4_any_category",
          submissionId: submission.id,
          observationId: observation.id,
          category: observation.category,
          severity: observation.severity,
        });
      }

      const categoryThreshold = HIGH_SENSITIVITY_CATEGORY_THRESHOLDS[observation.category];
      if (categoryThreshold !== undefined && observation.severity >= categoryThreshold) {
        pushTrigger(triggers, seen, {
          code: "sensitive_category_threshold",
          submissionId: submission.id,
          observationId: observation.id,
          category: observation.category,
          severity: observation.severity,
        });
      }

      for (const flag of observation.flags) {
        const flagThreshold = HIGH_SENSITIVITY_FLAG_THRESHOLDS[flag];
        if (flagThreshold === undefined || observation.severity < flagThreshold) continue;
        pushTrigger(triggers, seen, {
          code: "sensitive_flag_threshold",
          submissionId: submission.id,
          observationId: observation.id,
          category: observation.category,
          severity: observation.severity,
          flag,
        });
      }
    }
  }

  return {
    required: triggers.length > 0,
    minimumReviewerCount: triggers.length > 0 ? 3 : 2,
    triggers,
  };
}

function pushTrigger(
  target: ThirdReviewRiskTrigger[],
  seen: Set<string>,
  trigger: ThirdReviewRiskTrigger,
): void {
  const key = `${trigger.code}:${trigger.submissionId}:${trigger.observationId}:${trigger.flag ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  target.push(trigger);
}
