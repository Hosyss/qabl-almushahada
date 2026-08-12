"use server";

import { requireInternalSessionUser } from "@/app/internal-session";
import { saveOwnReviewDraft, submitOwnReviewAssignment } from "@/db/review-assignment-service";

export async function saveReviewDraftAction(input: {
  assignmentId: string;
  expectedRevision: number;
  draft: unknown;
}) {
  const user = await requireInternalSessionUser();

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
  const user = await requireInternalSessionUser();

  return submitOwnReviewAssignment({
    sessionEmail: user.email,
    assignmentId: input.assignmentId,
    expectedRevision: input.expectedRevision,
  });
}
