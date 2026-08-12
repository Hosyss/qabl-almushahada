"use server";

import { requireInternalSessionUser } from "@/app/internal-session";
import {
  approveReviewBundleEditorially,
  bootstrapInitialAdmin,
  createReviewAssignment,
  flagReviewConflict,
  provisionInternalUser,
  requestReviewChanges,
  setInternalUserStatus,
} from "@/db/internal-review-management-service";
import {
  getReviewerCalibrationSummary,
  recordReviewAuditOutcome,
} from "@/db/review-audit-outcome-service";
import { resolveReviewReport } from "@/db/resolve-review-report";

async function requireSessionEmail(): Promise<string> {
  return (await requireInternalSessionUser()).email;
}

export async function bootstrapInitialAdminAction() {
  return bootstrapInitialAdmin(await requireSessionEmail());
}

export async function provisionInternalUserAction(request: unknown) {
  return provisionInternalUser({ sessionEmail: await requireSessionEmail(), request });
}

export async function setInternalUserStatusAction(request: unknown) {
  return setInternalUserStatus({ sessionEmail: await requireSessionEmail(), request });
}

export async function createReviewAssignmentAction(request: unknown) {
  return createReviewAssignment({ sessionEmail: await requireSessionEmail(), request });
}

export async function requestReviewChangesAction(request: unknown) {
  return requestReviewChanges({ sessionEmail: await requireSessionEmail(), request });
}

export async function flagReviewConflictAction(request: unknown) {
  return flagReviewConflict({ sessionEmail: await requireSessionEmail(), request });
}

export async function approveReviewBundleEditoriallyAction(request: unknown) {
  return approveReviewBundleEditorially({ sessionEmail: await requireSessionEmail(), request });
}

export async function resolveReviewReportAction(request: unknown) {
  return resolveReviewReport({ sessionEmail: await requireSessionEmail(), request });
}

export async function recordReviewAuditOutcomeAction(request: unknown) {
  return recordReviewAuditOutcome({ sessionEmail: await requireSessionEmail(), request });
}

export async function getReviewerCalibrationSummaryAction(reviewerId: string) {
  return getReviewerCalibrationSummary({
    sessionEmail: await requireSessionEmail(),
    reviewerId,
  });
}
