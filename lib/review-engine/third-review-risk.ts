import type {
  ContentCategory,
  ContentFlag,
  ObservedSeverity,
  ReviewSubmission,
} from "./types.ts";

export type ThirdReviewRiskRuleId =
  | "self_harm_present"
  | "flashing_lights_present"
  | "sexual_content_severe"
  | "violence_extreme"
  | "violence_graphic_or_weapon"
  | "discrimination_high"
  | "substances_high"
  | "bullying_extreme";

export interface ThirdReviewRiskRule {
  id: ThirdReviewRiskRuleId;
  category: ContentCategory;
  minSeverity: ObservedSeverity;
  anyFlags?: readonly ContentFlag[];
  reasonAr: string;
}

export interface ThirdReviewRiskTrigger {
  ruleId: ThirdReviewRiskRuleId;
  category: ContentCategory;
  submissionId: string;
  observationId: string;
  severity: ObservedSeverity;
  flags: ContentFlag[];
  reasonAr: string;
}

export interface ThirdReviewRequirement {
  required: boolean;
  requiredActiveReviewerCount: 2 | 3;
  requiredIndependentGroupCount: 2 | 3;
  triggers: ThirdReviewRiskTrigger[];
}

/**
 * P2-03 risk policy.
 *
 * The rules intentionally target categories where a false negative has a
 * disproportionate safety/family impact. They do not resolve disagreements by
 * majority vote: a third source only adds independent evidence, while the
 * existing pairwise conflict gates still block any material disagreement.
 */
export const THIRD_REVIEW_RISK_RULES: readonly ThirdReviewRiskRule[] = [
  {
    id: "self_harm_present",
    category: "selfHarm",
    minSeverity: 1,
    reasonAr: "وجود أي واقعة لإيذاء النفس يحتاج مصدرًا بشريًا ثالثًا مستقلًا.",
  },
  {
    id: "flashing_lights_present",
    category: "flashingLights",
    minSeverity: 1,
    reasonAr: "وجود ومضات ضوئية يحتاج مصدرًا ثالثًا بسبب أثر السلامة الجسدية المحتمل.",
  },
  {
    id: "sexual_content_severe",
    category: "sexualContent",
    minSeverity: 3,
    reasonAr: "المحتوى الجنسي بدرجة 3 أو 4 يحتاج مراجعة ثالثة مستقلة.",
  },
  {
    id: "violence_extreme",
    category: "violence",
    minSeverity: 4,
    reasonAr: "العنف بدرجة 4 يحتاج مراجعة ثالثة مستقلة حتى من دون علامة إضافية.",
  },
  {
    id: "violence_graphic_or_weapon",
    category: "violence",
    minSeverity: 3,
    anyFlags: ["blood", "weapon"],
    reasonAr: "العنف بدرجة 3 أو أعلى مع دماء أو سلاح يحتاج مراجعة ثالثة مستقلة.",
  },
  {
    id: "discrimination_high",
    category: "discrimination",
    minSeverity: 3,
    reasonAr: "التمييز بدرجة 3 أو 4 يحتاج مراجعة ثالثة مستقلة.",
  },
  {
    id: "substances_high",
    category: "substances",
    minSeverity: 3,
    reasonAr: "المواد أو التعاطي بدرجة 3 أو 4 يحتاج مراجعة ثالثة مستقلة.",
  },
  {
    id: "bullying_extreme",
    category: "bullying",
    minSeverity: 4,
    reasonAr: "التنمر بدرجة 4 يحتاج مراجعة ثالثة مستقلة.",
  },
] as const;

export function assessThirdReviewRequirement(
  submissions: readonly ReviewSubmission[],
): ThirdReviewRequirement {
  const activeSubmissions = submissions.filter((submission) => submission.reviewer.status === "active");
  const triggers: ThirdReviewRiskTrigger[] = [];

  for (const submission of activeSubmissions) {
    for (const observation of submission.observations) {
      for (const rule of THIRD_REVIEW_RISK_RULES) {
        if (rule.category !== observation.category || observation.severity < rule.minSeverity) continue;
        if (rule.anyFlags && !rule.anyFlags.some((flag) => observation.flags.includes(flag))) continue;

        triggers.push({
          ruleId: rule.id,
          category: rule.category,
          submissionId: submission.id,
          observationId: observation.id,
          severity: observation.severity,
          flags: [...observation.flags],
          reasonAr: rule.reasonAr,
        });
      }
    }
  }

  const required = triggers.length > 0;
  return {
    required,
    requiredActiveReviewerCount: required ? 3 : 2,
    requiredIndependentGroupCount: required ? 3 : 2,
    triggers,
  };
}
