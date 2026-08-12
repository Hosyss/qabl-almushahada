import {
  ReviewWorkflowError,
  hasInternalPermission,
  type InternalActor,
} from "./internal-review-workflow.ts";

export type ReviewReportResolutionKind = "no_issue" | "correction_required";

export interface ReviewReportResolutionPlan {
  reportId: string;
  expectedReportRevision: number;
  expectedBundleRevision: number;
  resolutionKind: ReviewReportResolutionKind;
  note: string;
}

export function prepareReviewReportResolution(
  actor: InternalActor,
  raw: unknown,
): ReviewReportResolutionPlan {
  if (actor.status !== "active") {
    throw new ReviewWorkflowError("ACCOUNT_SUSPENDED", "الحساب الداخلي غير نشط.");
  }
  if (
    actor.role !== "editorial_reviewer" ||
    !actor.reviewer ||
    actor.reviewer.status !== "active" ||
    !hasInternalPermission(actor, "approve_editorially")
  ) {
    throw new ReviewWorkflowError(
      "FORBIDDEN",
      "حسم البلاغات الجوهرية يتطلب معتمدًا تحريريًا نشطًا.",
    );
  }

  const input = requirePlainObject(raw);
  rejectUnknownKeys(input, [
    "reportId",
    "expectedReportRevision",
    "expectedBundleRevision",
    "resolutionKind",
    "note",
  ]);

  const resolutionKind = input.resolutionKind;
  if (resolutionKind !== "no_issue" && resolutionKind !== "correction_required") {
    throw new ReviewWorkflowError("INVALID_DRAFT", "نوع حسم البلاغ غير معروف.");
  }

  return {
    reportId: requireString(input.reportId, "reportId", 1, 160),
    expectedReportRevision: requireRevision(input.expectedReportRevision, "expectedReportRevision"),
    expectedBundleRevision: requireRevision(input.expectedBundleRevision, "expectedBundleRevision"),
    resolutionKind,
    note: requireString(input.note, "note", 10, 4000),
  };
}

function requirePlainObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "بيانات حسم البلاغ غير صالحة.");
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(input).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "طلب حسم البلاغ يحتوي حقولًا غير مسموح بها.",
      unknown.map((key) => `unknown field: ${key}`),
    );
  }
}

function requireRevision(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ReviewWorkflowError("REVISION_CONFLICT", `${field} غير صالح.`);
  }
  return value;
}

function requireString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== "string") {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} يجب أن يكون نصًا.`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} خارج الطول المسموح.`);
  }
  return normalized;
}
