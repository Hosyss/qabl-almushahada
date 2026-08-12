import { ReviewWorkflowError } from "./internal-review-workflow.ts";

export interface ManualReviewerSafetyHoldPlan {
  targetUserId: string;
  expectedRevision: number;
  note: string;
  evidenceEventIds: string[];
}

export interface ReviewerSafetyHoldResolutionPlan {
  holdEventId: string;
  expectedRevision: number;
  resolution: "cleared" | "remediation_required";
  note: string;
}

export function parseManualReviewerSafetyHoldRequest(raw: unknown): ManualReviewerSafetyHoldPlan {
  const input = requirePlainObject(raw, "بيانات تعليق المراجع غير صالحة.");
  rejectUnknownKeys(input, ["targetUserId", "expectedRevision", "note", "evidenceEventIds"]);
  return {
    targetUserId: requireTrimmedString(input.targetUserId, "targetUserId", 1, 160),
    expectedRevision: requireRevision(input.expectedRevision),
    note: requireTrimmedString(input.note, "note", 20, 2000),
    evidenceEventIds: requireEvidenceEventIds(input.evidenceEventIds),
  };
}

export function parseReviewerSafetyHoldResolutionRequest(
  raw: unknown,
): ReviewerSafetyHoldResolutionPlan {
  const input = requirePlainObject(raw, "بيانات حسم تعليق المراجع غير صالحة.");
  rejectUnknownKeys(input, ["holdEventId", "expectedRevision", "resolution", "note"]);
  if (input.resolution !== "cleared" && input.resolution !== "remediation_required") {
    throw new ReviewWorkflowError("INVALID_DRAFT", "نوع حسم تعليق المراجع غير معروف.");
  }
  return {
    holdEventId: requireTrimmedString(input.holdEventId, "holdEventId", 1, 200),
    expectedRevision: requireRevision(input.expectedRevision),
    resolution: input.resolution,
    note: requireTrimmedString(input.note, "note", 10, 4000),
  };
}

function requireEvidenceEventIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "يجب إرفاق من 1 إلى 20 معرّف حدث تدقيق كدليل على الاشتباه قبل التعليق اليدوي.",
    );
  }
  const ids = value.map((item, index) =>
    requireTrimmedString(item, `evidenceEventIds[${index}]`, 1, 200),
  );
  if (new Set(ids).size !== ids.length) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "لا يجوز تكرار نفس دليل التدقيق في الطلب.");
  }
  return ids;
}

function requireRevision(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "expectedRevision غير صالح.");
  }
  return value as number;
}

function requireTrimmedString(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number,
): string {
  if (typeof value !== "string") {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${name} يجب أن يكون نصًا.`);
  }
  const result = value.trim();
  if (result.length < minimum || result.length > maximum) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      `${name} يجب أن يكون بين ${minimum} و${maximum} حرفًا.`,
    );
  }
  return result;
}

function requirePlainObject(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", message);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(input: Record<string, unknown>, allowed: readonly string[]): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(input).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "الطلب يحتوي حقولًا غير مسموحة.",
      unknown,
    );
  }
}
