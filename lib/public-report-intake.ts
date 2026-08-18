export const PUBLIC_REPORT_TARGET_KINDS = [
  "human_review",
  "evidence_publication",
  "editorial_publication",
] as const;

export const PUBLIC_REPORT_REASONS = [
  "wrong_version",
  "missing_content",
  "incorrect_content",
  "source_issue",
  "spoiler",
  "other",
] as const;

export type PublicReportTargetKind = (typeof PUBLIC_REPORT_TARGET_KINDS)[number];
export type PublicReportReason = (typeof PUBLIC_REPORT_REASONS)[number];

export const PUBLIC_REPORT_MESSAGE_MIN = 20;
export const PUBLIC_REPORT_MESSAGE_MAX = 1500;
export const PUBLIC_REPORT_TARGET_ID_MAX = 180;
export const PUBLIC_REPORT_PER_CLIENT_HOUR = 5;
export const PUBLIC_REPORT_GLOBAL_HOUR = 120;

export type PublicReportIntakePreparation =
  | { accepted: false; reason: "invalid_input"; errorsAr: string[] }
  | {
      accepted: true;
      targetKind: PublicReportTargetKind;
      targetPublicId: string;
      reportReason: PublicReportReason;
      message: string;
      automatedSubmission: boolean;
    };

export function preparePublicReportIntake(input: unknown): PublicReportIntakePreparation {
  if (!isPlainObject(input)) {
    return { accepted: false, reason: "invalid_input", errorsAr: ["بيانات البلاغ غير صالحة"] };
  }

  const allowedKeys = new Set(["targetKind", "targetId", "reason", "message", "website"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return { accepted: false, reason: "invalid_input", errorsAr: ["بيانات البلاغ تحتوي حقولًا غير معروفة"] };
  }

  const errorsAr: string[] = [];
  const targetKind = typeof input.targetKind === "string" ? input.targetKind : "";
  const targetPublicId = typeof input.targetId === "string" ? input.targetId.trim() : "";
  const reportReason = typeof input.reason === "string" ? input.reason : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";
  const website = typeof input.website === "string" ? input.website.trim() : "";

  if (!PUBLIC_REPORT_TARGET_KINDS.includes(targetKind as PublicReportTargetKind)) {
    errorsAr.push("نوع المحتوى المُبلّغ عنه غير معروف");
  }
  if (
    !targetPublicId ||
    targetPublicId.length > PUBLIC_REPORT_TARGET_ID_MAX ||
    /[\u0000-\u001F\u007F]/u.test(targetPublicId)
  ) {
    errorsAr.push("معرّف المحتوى غير صالح");
  }
  if (!PUBLIC_REPORT_REASONS.includes(reportReason as PublicReportReason)) {
    errorsAr.push("سبب البلاغ غير معروف");
  }
  if (message.length < PUBLIC_REPORT_MESSAGE_MIN || message.length > PUBLIC_REPORT_MESSAGE_MAX) {
    errorsAr.push(`وصف البلاغ يجب أن يكون بين ${PUBLIC_REPORT_MESSAGE_MIN} و${PUBLIC_REPORT_MESSAGE_MAX} حرفًا`);
  }
  if (typeof input.website !== "undefined" && typeof input.website !== "string") {
    errorsAr.push("حقل التحقق غير صالح");
  }

  if (errorsAr.length > 0) return { accepted: false, reason: "invalid_input", errorsAr };

  return {
    accepted: true,
    targetKind: targetKind as PublicReportTargetKind,
    targetPublicId,
    reportReason: reportReason as PublicReportReason,
    message,
    automatedSubmission: website.length > 0,
  };
}

export function isPublicReportReason(value: unknown): value is PublicReportReason {
  return typeof value === "string" && PUBLIC_REPORT_REASONS.includes(value as PublicReportReason);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
