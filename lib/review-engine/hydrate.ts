import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type CategoryCheck,
  type CategoryChecklist,
  type ContentCategory,
  type ContentFlag,
  type ContentObservation,
  type EditorialApproval,
  type ObservedSeverity,
  type ReviewBundle,
  type ReviewSubmission,
} from "./types.ts";

export interface PersistedBundleRows {
  bundle: { id: string; revision: number };
  version: ReviewBundle["version"];
  submissions: Array<{
    id: string;
    versionId: string;
    reviewerId: string;
    reviewerIndependenceGroupId: string;
    reviewerStatus: ReviewSubmission["reviewer"]["status"];
    startedAt: string;
    completedAt: string;
    watchedSeconds: number;
    declaredComplete: boolean;
  }>;
  categoryChecks: Array<{
    submissionId: string;
    category: string;
    result: string;
  }>;
  observations: Array<{
    id: string;
    submissionId: string;
    category: string;
    severity: number;
    startSecond: number;
    endSecond: number;
    frequency: string;
    context: string;
    spoilerLevel: string;
    summary: string;
  }>;
  observationFlags: Array<{ observationId: string; flag: string }>;
  approval?: {
    status: string;
    approverId: string;
    approverIndependenceGroupId: string;
    approverStatus: ReviewSubmission["reviewer"]["status"];
    approvedAt: string;
    versionFingerprintConfirmed: boolean;
    reviewedSubmissionIds: string[];
    spotChecks: Array<{ observationId: string; result: string }>;
  };
  blockingReports: Array<{
    id: string;
    reportType: string;
    status: string;
  }>;
}

export class InvalidStoredReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStoredReviewError";
  }
}

function isCategory(value: string): value is ContentCategory {
  return (CONTENT_CATEGORIES as readonly string[]).includes(value);
}

function isFlag(value: string): value is ContentFlag {
  return (CONTENT_FLAGS as readonly string[]).includes(value);
}

function isCategoryCheck(value: string): value is CategoryCheck {
  return value === "none" || value === "present" || value === "uncertain";
}

function isObservedSeverity(value: number): value is ObservedSeverity {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}

function emptyChecklist(): CategoryChecklist {
  return Object.fromEntries(CONTENT_CATEGORIES.map((category) => [category, "uncertain"])) as CategoryChecklist;
}

function assertOneOf<T extends string>(value: string, values: readonly T[], field: string): T {
  if (!values.includes(value as T)) {
    throw new InvalidStoredReviewError(`Invalid ${field}: ${value}`);
  }
  return value as T;
}

export function hydrateReviewBundle(rows: PersistedBundleRows): {
  bundle: ReviewBundle;
  revision: number;
} {
  if (!Number.isInteger(rows.bundle.revision) || rows.bundle.revision < 0) {
    throw new InvalidStoredReviewError("Bundle revision must be a non-negative integer.");
  }

  const checksBySubmission = new Map<string, CategoryChecklist>();
  for (const submission of rows.submissions) {
    checksBySubmission.set(submission.id, emptyChecklist());
  }

  for (const checkRow of rows.categoryChecks) {
    if (!isCategory(checkRow.category)) {
      throw new InvalidStoredReviewError(`Unknown category in checklist: ${checkRow.category}`);
    }
    if (!isCategoryCheck(checkRow.result)) {
      throw new InvalidStoredReviewError(`Unknown checklist result: ${checkRow.result}`);
    }
    const checklist = checksBySubmission.get(checkRow.submissionId);
    if (!checklist) {
      throw new InvalidStoredReviewError(`Checklist references missing submission: ${checkRow.submissionId}`);
    }
    checklist[checkRow.category] = checkRow.result;
  }

  const flagsByObservation = new Map<string, ContentFlag[]>();
  for (const flagRow of rows.observationFlags) {
    if (!isFlag(flagRow.flag)) {
      throw new InvalidStoredReviewError(`Unknown observation flag: ${flagRow.flag}`);
    }
    const flags = flagsByObservation.get(flagRow.observationId) ?? [];
    flags.push(flagRow.flag);
    flagsByObservation.set(flagRow.observationId, flags);
  }

  const observationsBySubmission = new Map<string, ContentObservation[]>();
  const observationIds = new Set(rows.observations.map((row) => row.id));
  for (const flaggedObservationId of flagsByObservation.keys()) {
    if (!observationIds.has(flaggedObservationId)) {
      throw new InvalidStoredReviewError(`Flag references missing observation: ${flaggedObservationId}`);
    }
  }

  for (const observationRow of rows.observations) {
    if (!isCategory(observationRow.category)) {
      throw new InvalidStoredReviewError(`Unknown observation category: ${observationRow.category}`);
    }
    if (!isObservedSeverity(observationRow.severity)) {
      throw new InvalidStoredReviewError(`Invalid stored severity: ${observationRow.severity}`);
    }

    const observation: ContentObservation = {
      id: observationRow.id,
      category: observationRow.category,
      severity: observationRow.severity,
      startSecond: observationRow.startSecond,
      endSecond: observationRow.endSecond,
      frequency: assertOneOf(
        observationRow.frequency,
        ["single", "repeated", "sustained"] as const,
        "frequency",
      ),
      context: assertOneOf(
        observationRow.context,
        ["comic", "neutral", "educational", "threatening", "distressing"] as const,
        "context",
      ),
      spoilerLevel: assertOneOf(
        observationRow.spoilerLevel,
        ["none", "contextual", "major"] as const,
        "spoilerLevel",
      ),
      summary: observationRow.summary,
      flags: flagsByObservation.get(observationRow.id) ?? [],
    };

    const observations = observationsBySubmission.get(observationRow.submissionId) ?? [];
    observations.push(observation);
    observationsBySubmission.set(observationRow.submissionId, observations);
  }

  const submissions: ReviewSubmission[] = rows.submissions.map((submissionRow) => ({
    id: submissionRow.id,
    versionId: submissionRow.versionId,
    reviewer: {
      id: submissionRow.reviewerId,
      independenceGroupId: submissionRow.reviewerIndependenceGroupId,
      status: submissionRow.reviewerStatus,
    },
    startedAt: submissionRow.startedAt,
    completedAt: submissionRow.completedAt,
    watchedSeconds: submissionRow.watchedSeconds,
    declaredComplete: submissionRow.declaredComplete,
    categoryChecks: checksBySubmission.get(submissionRow.id) ?? emptyChecklist(),
    observations: observationsBySubmission.get(submissionRow.id) ?? [],
  }));

  for (const submissionId of observationsBySubmission.keys()) {
    if (!submissions.some((submission) => submission.id === submissionId)) {
      throw new InvalidStoredReviewError(`Observation references missing submission: ${submissionId}`);
    }
  }

  let editorialApproval: EditorialApproval | undefined;
  if (rows.approval) {
    editorialApproval = {
      status: assertOneOf(
        rows.approval.status,
        ["approved", "changes_requested", "rejected"] as const,
        "approval status",
      ),
      approverId: rows.approval.approverId,
      approverIndependenceGroupId: rows.approval.approverIndependenceGroupId,
      approverStatus: rows.approval.approverStatus,
      approvedAt: rows.approval.approvedAt,
      versionFingerprintConfirmed: rows.approval.versionFingerprintConfirmed,
      reviewedSubmissionIds: rows.approval.reviewedSubmissionIds,
      spotChecks: rows.approval.spotChecks.map((spotCheck) => ({
        observationId: spotCheck.observationId,
        result: assertOneOf(
          spotCheck.result,
          ["confirmed", "unresolved"] as const,
          "spot-check result",
        ),
      })),
    };
  }

  return {
    revision: rows.bundle.revision,
    bundle: {
      id: rows.bundle.id,
      version: rows.version,
      submissions,
      editorialApproval,
      blockingReports: rows.blockingReports.map((report) => ({
        id: report.id,
        reportType: assertOneOf(
          report.reportType,
          ["different_version", "missing_event", "wrong_severity", "spoiler", "other"] as const,
          "report type",
        ),
        status: assertOneOf(report.status, ["open", "investigating"] as const, "blocking report status"),
      })),
    },
  };
}
