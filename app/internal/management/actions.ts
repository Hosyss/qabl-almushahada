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
import {
  activateCalibratedReviewer,
  activateReferenceCalibrationSet,
  addReferenceCalibrationCase,
  createReferenceCalibrationSet,
  startOwnReferenceCalibrationAttempt,
  submitOwnReferenceCalibrationCase,
} from "@/db/reviewer-reference-calibration-service";
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

export async function createReferenceCalibrationSetAction(request: unknown) {
  return createReferenceCalibrationSet({ sessionEmail: await requireSessionEmail(), request });
}

export async function addReferenceCalibrationCaseAction(request: unknown) {
  return addReferenceCalibrationCase({ sessionEmail: await requireSessionEmail(), request });
}

export async function activateReferenceCalibrationSetAction(request: unknown) {
  return activateReferenceCalibrationSet({ sessionEmail: await requireSessionEmail(), request });
}

export async function startOwnReferenceCalibrationAttemptAction() {
  return startOwnReferenceCalibrationAttempt({ sessionEmail: await requireSessionEmail() });
}

export async function submitOwnReferenceCalibrationCaseAction(request: unknown) {
  return submitOwnReferenceCalibrationCase({ sessionEmail: await requireSessionEmail(), request });
}

export async function activateCalibratedReviewerAction(request: unknown) {
  return activateCalibratedReviewer({ sessionEmail: await requireSessionEmail(), request });
}
