import { assessThirdReviewRequirement } from "./review-engine/risk-policy.ts";
import type { ReviewSubmission } from "./review-engine/types.ts";

export const BASELINE_AUDIT_RATE_BPS = 1_000;
export const HIGH_RISK_AUDIT_RATE_BPS = 5_000;
export const UINT32_RANGE = 4_294_967_296;

export type ReviewAuditRiskTier = "baseline" | "high_risk";

export interface ReviewAuditSelectionPlan {
  riskTier: ReviewAuditRiskTier;
  sampleRateBps: number;
  drawU32: number;
  thresholdExclusiveU32: number;
  selected: boolean;
  riskTriggerCodes: string[];
}

/**
 * P2Q-01 random audit policy.
 *
 * The caller must generate drawU32 with a server-side CSPRNG only after the
 * submission payload has been validated/frozen for final submission. The draw
 * is compared directly to a uint32 threshold, avoiding modulo bias.
 *
 * Initial rates are deliberately explicit and code-reviewed:
 * - ordinary submissions: 10%
 * - submissions matching the existing P2-03 high-sensitivity policy: 50%
 *
 * P2Q-02 may later change these rates based on measured calibration data, but
 * no UI/client input may lower or override them.
 */
export function planPostSubmissionAudit(
  submission: ReviewSubmission,
  drawU32: number,
): ReviewAuditSelectionPlan {
  if (!Number.isInteger(drawU32) || drawU32 < 0 || drawU32 >= UINT32_RANGE) {
    throw new RangeError("drawU32 must be an unsigned 32-bit integer");
  }

  const risk = assessThirdReviewRequirement([submission]);
  const riskTier: ReviewAuditRiskTier = risk.required ? "high_risk" : "baseline";
  const sampleRateBps = risk.required ? HIGH_RISK_AUDIT_RATE_BPS : BASELINE_AUDIT_RATE_BPS;
  const thresholdExclusiveU32 = Math.floor((UINT32_RANGE * sampleRateBps) / 10_000);
  const riskTriggerCodes = [...new Set(risk.triggers.map((trigger) => trigger.code))].sort();

  return {
    riskTier,
    sampleRateBps,
    drawU32,
    thresholdExclusiveU32,
    selected: drawU32 < thresholdExclusiveU32,
    riskTriggerCodes,
  };
}
