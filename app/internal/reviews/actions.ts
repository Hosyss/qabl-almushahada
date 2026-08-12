"use server";

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { saveOwnReviewDraft, submitOwnReviewAssignment } from "@/db/review-assignment-service";
import { ReviewWorkflowError } from "@/lib/internal-review-workflow";

export async function saveReviewDraftAction(input: {
  assignmentId: string;
  expectedRevision: number;
  draft: unknown;
}) {
  const user = await getChatGPTUser();
  if (!user) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");

  return saveOwnReviewDraft({
    sessionEmail: user.email,
    assignmentId: input.assignmentId,
    expectedRevision: input.expectedRevision,
    draft: input.draft,
  });
}

export async function submitReviewAssignmentAction(input: {
  assignmentId: string;
  expectedRevision: number;
}) {
  const user = await getChatGPTUser();
  if (!user) throw new ReviewWorkflowError("UNAUTHENTICATED", "يلزم تسجيل الدخول.");

  return submitOwnReviewAssignment({
    sessionEmail: user.email,
    assignmentId: input.assignmentId,
    expectedRevision: input.expectedRevision,
  });
}
