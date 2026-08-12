import { assessReviewQuality as assessBaseReviewQuality } from "./quality.ts";
import { assessThirdReviewRequirement } from "./risk-policy.ts";
import type { QualityAssessment, QualityIssue, ReviewBundle } from "./types.ts";

/**
 * Final publication-quality gate.
 *
 * The base quality model keeps the universal two-reviewer rule and all existing
 * conflict/coverage/editorial checks. P2-03 adds a deterministic escalation: if
 * the active submissions contain a high-sensitivity trigger, three unique active
 * reviewers from three independent groups are required.
 */
export function assessReviewQuality(bundle: ReviewBundle): QualityAssessment {
  const base = assessBaseReviewQuality(bundle);
  const activeSubmissions = bundle.submissions.filter((submission) => submission.reviewer.status === "active");
  const requirement = assessThirdReviewRequirement(activeSubmissions);

  if (!requirement.required) return base;

  const reviewerIds = new Set(activeSubmissions.map((submission) => submission.reviewer.id));
  const independenceGroups = new Set(
    activeSubmissions.map((submission) => submission.reviewer.independenceGroupId),
  );
  const triggerSubmissionIds = unique(requirement.triggers.map((trigger) => trigger.submissionId));
  const triggerObservationIds = unique(requirement.triggers.map((trigger) => trigger.observationId));
  const issues: QualityIssue[] = [...base.issues];
  let escalated = false;

  if (reviewerIds.size < 3) {
    issues.push({
      code: "THIRD_REVIEW_REQUIRED",
      level: "blocking",
      messageAr: "توجد واقعة عالية الحساسية؛ يلزم مراجع بشري ثالث نشط قبل الاعتماد أو النشر.",
      submissionIds: triggerSubmissionIds,
      observationIds: triggerObservationIds,
    });
    escalated = true;
  }

  if (independenceGroups.size < 3) {
    issues.push({
      code: "THIRD_INDEPENDENT_REVIEW_REQUIRED",
      level: "blocking",
      messageAr: "المراجعة الثالثة للحالة عالية الحساسية يجب أن تأتي من مجموعة استقلال ثالثة.",
      submissionIds: triggerSubmissionIds,
      observationIds: triggerObservationIds,
    });
    escalated = true;
  }

  if (!escalated) return base;

  return {
    ...base,
    status: base.status === "conflicted" ? "conflicted" : "insufficient",
    confidence: "unavailable",
    publishable: false,
    issues,
    eligibleSubmissionIds: [],
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
