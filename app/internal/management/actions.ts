"use server";

import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  approveReviewBundleEditorially,
  bootstrapInitialAdmin,
  createReviewAssignment,
  flagReviewConflict,
  provisionInternalUser,
  requestReviewChanges,
  setInternalUserStatus,
} from "@/db/internal-review-management-service";
import { ReviewWorkflowError } from "@/lib/internal-review-workflow";

async function requireSessionEmail(): Promise<string> {
  const user = await getChatGPTUser();
  if (!user) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");
  return user.email;
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
