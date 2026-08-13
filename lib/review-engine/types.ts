export const CONTENT_CATEGORIES = [
  "fear",
  "violence",
  "language",
  "bullying",
  "sexualContent",
  "substances",
  "discrimination",
  "selfHarm",
  "grief",
  "flashingLights",
] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];
export type Severity = 0 | 1 | 2 | 3 | 4;
export type ObservedSeverity = Exclude<Severity, 0>;
export type CategoryCheck = "none" | "present" | "uncertain";
export type CategoryChecklist = Record<ContentCategory, CategoryCheck>;

export const CONTENT_FLAGS = [
  "jump_scare",
  "blood",
  "weapon",
  "verbal_bullying",
  "physical_bullying",
  "bereavement",
  "separation",
  "flashing_sequence",
  "nudity",
  "kissing",
  "intimate_touching",
  "sexual_dialogue",
  "smoking_or_vaping",
  "alcohol_use",
  "drug_use",
  "gambling_activity",
  "religious_reference_or_practice",
] as const;

export type ContentFlag = (typeof CONTENT_FLAGS)[number];

export interface ReviewVersion {
  id: string;
  titleId: string;
  editionLabel: string;
  platform: string;
  language: string;
  releaseYear: number;
  runtimeSeconds: number;
  /** Stable fingerprint supplied by the ingestion layer for this exact cut. */
  contentFingerprint: string;
}

export interface ReviewerIdentity {
  id: string;
  /** Reviewers in the same household, company, or supervision chain share a group. */
  independenceGroupId: string;
  status: "active" | "probation" | "suspended";
}

export interface ContentObservation {
  id: string;
  category: ContentCategory;
  severity: ObservedSeverity;
  startSecond: number;
  endSecond: number;
  frequency: "single" | "repeated" | "sustained";
  context: "comic" | "neutral" | "educational" | "threatening" | "distressing";
  spoilerLevel: "none" | "contextual" | "major";
  summary: string;
  flags: ContentFlag[];
}

export interface ReviewSubmission {
  id: string;
  versionId: string;
  reviewer: ReviewerIdentity;
  startedAt: string;
  completedAt: string;
  watchedSeconds: number;
  declaredComplete: boolean;
  categoryChecks: CategoryChecklist;
  observations: ContentObservation[];
}

export interface EditorialApproval {
  status: "approved" | "changes_requested" | "rejected";
  approverId: string;
  approverIndependenceGroupId: string;
  approverStatus: ReviewerIdentity["status"];
  approvedAt: string;
  versionFingerprintConfirmed: boolean;
  reviewedSubmissionIds: string[];
  spotChecks: Array<{
    observationId: string;
    result: "confirmed" | "unresolved";
  }>;
}

export interface ReviewBundle {
  id: string;
  version: ReviewVersion;
  submissions: ReviewSubmission[];
  editorialApproval?: EditorialApproval;
  blockingReports: Array<{
    id: string;
    reportType: ReviewReportType;
    status: Extract<ReviewReportStatus, "open" | "investigating">;
  }>;
}

export type ReviewReportType =
  | "different_version"
  | "missing_event"
  | "wrong_severity"
  | "spoiler"
  | "other";

export type ReviewReportStatus = "open" | "investigating" | "resolved" | "dismissed";

export interface FamilyProfile {
  id: string;
  childAge: number;
  maxSeverity: Record<ContentCategory, Severity>;
  blockedFlags: ContentFlag[];
}

export type QualityStatus = "verified" | "provisional" | "conflicted" | "insufficient";
export type QualityConfidence = "high" | "medium" | "low" | "unavailable";

export interface QualityIssue {
  code: string;
  level: "blocking" | "warning";
  messageAr: string;
  submissionIds?: string[];
  observationIds?: string[];
}

export interface QualityAssessment {
  status: QualityStatus;
  confidence: QualityConfidence;
  publishable: boolean;
  issues: QualityIssue[];
  eligibleSubmissionIds: string[];
}

export type DecisionVerdict = "suitable" | "with_guidance" | "not_suitable" | "insufficient_data";

export interface DecisionReason {
  code:
    | "category_exceeds_limit"
    | "category_at_limit"
    | "blocked_flag"
    | "quality_gate"
    | "profile_invalid";
  category?: ContentCategory;
  flag?: ContentFlag;
  observedSeverity?: Severity;
  allowedSeverity?: Severity;
  evidenceObservationIds: string[];
  messageAr: string;
}

export interface FamilyDecision {
  verdict: DecisionVerdict;
  summaryAr: string;
  confidence: QualityConfidence;
  quality: QualityAssessment;
  reasons: DecisionReason[];
  categorySeverity: Record<ContentCategory, Severity>;
}
