import type { ReviewReportType } from "./types.ts";

const REPORT_TYPES: readonly ReviewReportType[] = [
  "different_version",
  "missing_event",
  "wrong_severity",
  "spoiler",
  "other",
];

export type ReportOpeningPreparation =
  | { allowed: false; errorsAr: string[] }
  | {
      allowed: true;
      bundleId: string;
      expectedRevision: number;
      nextRevision: number;
      reportType: ReviewReportType;
      message: string;
    };

export function prepareReportOpening(input: {
  bundleId: string;
  revision: number;
  reportType: string;
  message: string;
}): ReportOpeningPreparation {
  const errorsAr: string[] = [];
  const bundleId = input.bundleId.trim();
  const message = input.message.trim();

  if (!bundleId) errorsAr.push("معرّف حزمة المراجعة مطلوب");
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    errorsAr.push("رقم نسخة البيانات غير صالح");
  }
  if (!REPORT_TYPES.includes(input.reportType as ReviewReportType)) {
    errorsAr.push("نوع البلاغ غير معروف");
  }
  if (message.length < 10 || message.length > 2000) {
    errorsAr.push("وصف البلاغ يجب أن يكون بين 10 و2000 حرف");
  }

  if (errorsAr.length > 0) return { allowed: false, errorsAr };

  return {
    allowed: true,
    bundleId,
    expectedRevision: input.revision,
    nextRevision: input.revision + 1,
    reportType: input.reportType as ReviewReportType,
    message,
  };
}

