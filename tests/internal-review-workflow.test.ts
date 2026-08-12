import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCanApproveEditorially,
  assertCanEditOwnDraft,
  assertCanReadAssignment,
  canTransitionAssignment,
  prepareLockedReviewSubmission,
  sanitizeReviewDraftForStorage,
  ReviewWorkflowError,
  type InternalActor,
  type ReviewAssignmentScope,
} from "../lib/internal-review-workflow.ts";
import {
  CONTENT_CATEGORIES,
  type CategoryChecklist,
  type ReviewVersion,
} from "../lib/review-engine/types.ts";

const version: ReviewVersion = {
  id: "version-1",
  titleId: "title-1",
  editionLabel: "streaming-ar",
  platform: "platform",
  language: "ar",
  releaseYear: 2026,
  runtimeSeconds: 6000,
  contentFingerprint: "fingerprint-123456789",
};

const reviewer = {
  id: "reviewer-a",
  independenceGroupId: "group-a",
  status: "active" as const,
};
const reviewerActor: InternalActor = {
  userId: "user-a",
  email: "reviewer@example.com",
  role: "reviewer",
  status: "active",
  reviewer,
};
const assignment: ReviewAssignmentScope = {
  id: "assignment-1",
  bundleId: "bundle-1",
  version,
  reviewer,
  state: "in_progress",
  revision: 3,
};

function validChecklist(): CategoryChecklist {
  return Object.fromEntries(
    CONTENT_CATEGORIES.map((category) => [category, "none"]),
  ) as CategoryChecklist;
}

function validDraft() {
  const categoryChecks = validChecklist();
  categoryChecks.fear = "present";
  return {
    startedAt: "2026-08-12T08:00:00.000Z",
    completedAt: "2026-08-12T09:50:00.000Z",
    watchedSeconds: 5900,
    declaredComplete: true,
    categoryChecks,
    observations: [
      {
        id: "obs-1",
        category: "fear",
        severity: 2,
        startSecond: 120,
        endSecond: 140,
        frequency: "single",
        context: "threatening",
        spoilerLevel: "contextual",
        summary: "مشهد خوف قصير.",
        flags: ["jump_scare"],
      },
    ],
  };
}

function expectCode(fn: () => unknown, code: string) {
  assert.throws(
    fn,
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === code,
  );
}

test("reviewer cannot read or edit another reviewer's assignment", () => {
  const other = structuredClone(assignment);
  other.reviewer.id = "reviewer-b";
  expectCode(() => assertCanReadAssignment(reviewerActor, other), "ASSIGNMENT_OWNERSHIP");
  expectCode(() => assertCanEditOwnDraft(reviewerActor, other, 3), "ASSIGNMENT_OWNERSHIP");
});

test("forged role or reviewerId fields are rejected as mass assignment", () => {
  expectCode(
    () =>
      prepareLockedReviewSubmission({
        actor: reviewerActor,
        assignment,
        expectedRevision: 3,
        submissionId: "submission-1",
        draft: { ...validDraft(), reviewerId: "reviewer-b", role: "admin" },
      }),
    "INVALID_DRAFT",
  );
});

test("draft storage rejects mass-assignment fields before persistence", () => {
  expectCode(
    () => sanitizeReviewDraftForStorage({ reviewerId: "forged", role: "admin" }),
    "INVALID_DRAFT",
  );
  const stored = sanitizeReviewDraftForStorage({ watchedSeconds: 120 });
  assert.deepEqual(stored, { watchedSeconds: 120 });
});

test("submission identity and version come only from the server assignment", () => {
  const submission = prepareLockedReviewSubmission({
    actor: reviewerActor,
    assignment,
    expectedRevision: 3,
    submissionId: "submission-1",
    draft: validDraft(),
  });
  assert.equal(submission.reviewer.id, "reviewer-a");
  assert.equal(submission.versionId, "version-1");
});

test("assigned task cannot jump directly to submitted", () => {
  expectCode(
    () =>
      prepareLockedReviewSubmission({
        actor: reviewerActor,
        assignment: { ...assignment, state: "assigned" },
        expectedRevision: 3,
        submissionId: "submission-direct",
        draft: validDraft(),
      }),
    "ASSIGNMENT_LOCKED",
  );
});

test("reviewer cannot edit after submitted lock", () => {
  expectCode(
    () => assertCanEditOwnDraft(reviewerActor, { ...assignment, state: "submitted" }, 3),
    "ASSIGNMENT_LOCKED",
  );
});

test("stale concurrent revision is rejected", () => {
  expectCode(() => assertCanEditOwnDraft(reviewerActor, assignment, 2), "REVISION_CONFLICT");
});

test("editor cannot self-approve or approve same independence group", () => {
  const selfEditor: InternalActor = {
    ...reviewerActor,
    role: "editorial_reviewer",
  };
  expectCode(
    () => assertCanApproveEditorially(selfEditor, { ...assignment, state: "submitted" }),
    "SELF_APPROVAL",
  );

  const sameGroupEditor: InternalActor = {
    userId: "editor-2",
    email: "editor@example.com",
    role: "editorial_reviewer",
    status: "active",
    reviewer: {
      id: "editor-reviewer",
      independenceGroupId: "group-a",
      status: "active",
    },
  };
  expectCode(
    () =>
      assertCanApproveEditorially(sameGroupEditor, {
        ...assignment,
        state: "submitted",
      }),
    "EDITOR_NOT_INDEPENDENT",
  );
});

test("coordinator cannot fabricate editorial approval", () => {
  const coordinator: InternalActor = {
    userId: "coord-1",
    email: "coord@example.com",
    role: "review_coordinator",
    status: "active",
    reviewer: null,
  };
  expectCode(
    () => assertCanApproveEditorially(coordinator, { ...assignment, state: "submitted" }),
    "FORBIDDEN",
  );
});

test("missing, uncertain, contradictory, and unknown values fail closed", () => {
  const incomplete = validDraft();
  delete (incomplete.categoryChecks as Partial<CategoryChecklist>).grief;
  expectCode(
    () =>
      prepareLockedReviewSubmission({
        actor: reviewerActor,
        assignment,
        expectedRevision: 3,
        submissionId: "s1",
        draft: incomplete,
      }),
    "INVALID_DRAFT",
  );

  const uncertain = validDraft();
  uncertain.categoryChecks.fear = "uncertain";
  expectCode(
    () =>
      prepareLockedReviewSubmission({
        actor: reviewerActor,
        assignment,
        expectedRevision: 3,
        submissionId: "s2",
        draft: uncertain,
      }),
    "INVALID_DRAFT",
  );

  const contradictory = validDraft();
  contradictory.categoryChecks.fear = "none";
  expectCode(
    () =>
      prepareLockedReviewSubmission({
        actor: reviewerActor,
        assignment,
        expectedRevision: 3,
        submissionId: "s3",
        draft: contradictory,
      }),
    "INVALID_DRAFT",
  );

  const unknown = validDraft();
  unknown.observations[0].category = "invented" as "fear";
  expectCode(
    () =>
      prepareLockedReviewSubmission({
        actor: reviewerActor,
        assignment,
        expectedRevision: 3,
        submissionId: "s4",
        draft: unknown,
      }),
    "INVALID_DRAFT",
  );
});

test("coverage under 95 percent is rejected before submission", () => {
  const draft = validDraft();
  draft.watchedSeconds = 5699;
  expectCode(
    () =>
      prepareLockedReviewSubmission({
        actor: reviewerActor,
        assignment,
        expectedRevision: 3,
        submissionId: "s5",
        draft,
      }),
    "INVALID_DRAFT",
  );
});

test("watch timestamps are ordered by actual instant rather than text", () => {
  const draft = validDraft();
  draft.startedAt = "2026-08-12T10:00:00+02:00";
  draft.completedAt = "2026-08-12T09:50:00+00:00";
  const submission = prepareLockedReviewSubmission({
    actor: reviewerActor,
    assignment,
    expectedRevision: 3,
    submissionId: "timezone-order",
    draft,
  });
  assert.equal(submission.startedAt, draft.startedAt);
  assert.equal(submission.completedAt, draft.completedAt);
});

test("state machine has no path from coordinator work directly to approval", () => {
  assert.equal(canTransitionAssignment("draft", "approved"), false);
  assert.equal(canTransitionAssignment("draft", "assigned"), true);
  assert.equal(canTransitionAssignment("assigned", "approved"), false);
  assert.equal(canTransitionAssignment("in_progress", "approved"), false);
  assert.equal(canTransitionAssignment("submitted", "approved"), true);
  assert.equal(canTransitionAssignment("submitted", "changes_requested"), true);
  assert.equal(canTransitionAssignment("changes_requested", "in_progress"), true);
});
