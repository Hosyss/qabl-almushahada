import assert from "node:assert/strict";
import test from "node:test";

import {
  prepareEditorialApproval,
  prepareEditorialTransition,
  prepareInternalUserProvisioning,
  prepareInternalUserStatusChange,
  prepareReviewAssignmentCreation,
} from "../lib/internal-review-management.ts";
import {
  ReviewWorkflowError,
  type InternalActor,
  type ReviewAssignmentScope,
} from "../lib/internal-review-workflow.ts";
import type { ReviewVersion } from "../lib/review-engine/types.ts";

const version: ReviewVersion = {
  id: "version-1",
  titleId: "title-1",
  editionLabel: "streaming-ar",
  platform: "test",
  language: "ar",
  releaseYear: 2026,
  runtimeSeconds: 6000,
  contentFingerprint: "fingerprint-123456789",
};

const admin: InternalActor = {
  userId: "admin-1",
  email: "admin@example.com",
  role: "admin",
  status: "active",
  reviewer: null,
};

const coordinator: InternalActor = {
  userId: "coord-1",
  email: "coord@example.com",
  role: "review_coordinator",
  status: "active",
  reviewer: null,
};

const editor: InternalActor = {
  userId: "editor-1",
  email: "editor@example.com",
  role: "editorial_reviewer",
  status: "active",
  reviewer: {
    id: "reviewer-editor",
    independenceGroupId: "group-editor",
    status: "active",
  },
};

const reviewerActor: InternalActor = {
  userId: "user-r1",
  email: "reviewer@example.com",
  role: "reviewer",
  status: "active",
  reviewer: {
    id: "reviewer-1",
    independenceGroupId: "group-1",
    status: "active",
  },
};

function assignment(id: string, reviewerId: string, group: string, revision = 2): ReviewAssignmentScope {
  return {
    id,
    bundleId: "bundle-1",
    version,
    reviewer: {
      id: reviewerId,
      independenceGroupId: group,
      status: "active",
    },
    state: "submitted",
    revision,
  };
}

function expectCode(fn: () => unknown, code: string) {
  assert.throws(
    fn,
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === code,
  );
}

test("admin provisioning normalizes email and creates reviewer profile only for reviewer roles", () => {
  const coordinatorPlan = prepareInternalUserProvisioning(admin, {
    authEmail: "  COORD@Example.COM ",
    role: "review_coordinator",
  });
  assert.equal(coordinatorPlan.authEmail, "coord@example.com");
  assert.equal(coordinatorPlan.reviewerProfile, null);

  const reviewerPlan = prepareInternalUserProvisioning(admin, {
    authEmail: "reviewer2@example.com",
    role: "reviewer",
    displayLabel: "Reviewer Two",
    independenceGroupId: "household-2",
  });
  assert.equal(reviewerPlan.reviewerProfile?.independenceGroupId, "household-2");
});

test("non-admin cannot provision or change account status", () => {
  expectCode(
    () =>
      prepareInternalUserProvisioning(coordinator, {
        authEmail: "x@example.com",
        role: "reviewer",
        displayLabel: "X",
        independenceGroupId: "group-x",
      }),
    "FORBIDDEN",
  );
  expectCode(
    () =>
      prepareInternalUserStatusChange(coordinator, {
        targetUserId: "user-x",
        expectedRevision: 0,
        status: "suspended",
      }),
    "FORBIDDEN",
  );
});

test("provisioning rejects mass-assignment fields and reviewer roles without independence data", () => {
  expectCode(
    () =>
      prepareInternalUserProvisioning(admin, {
        authEmail: "reviewer3@example.com",
        role: "reviewer",
        reviewerId: "forged-reviewer-id",
      }),
    "INVALID_DRAFT",
  );
  expectCode(
    () =>
      prepareInternalUserProvisioning(admin, {
        authEmail: "reviewer3@example.com",
        role: "reviewer",
        displayLabel: "Reviewer Three",
      }),
    "INVALID_DRAFT",
  );
});

test("admin cannot suspend itself", () => {
  expectCode(
    () =>
      prepareInternalUserStatusChange(admin, {
        targetUserId: "admin-1",
        expectedRevision: 0,
        status: "suspended",
      }),
    "FORBIDDEN",
  );
});

test("only coordinator can create assignments and reviewer identity is addressed by server-known email", () => {
  const plan = prepareReviewAssignmentCreation(coordinator, {
    bundleId: "bundle-1",
    reviewerEmail: " Reviewer@Example.COM ",
    expectedBundleRevision: 4,
  });
  assert.equal(plan.reviewerEmail, "reviewer@example.com");
  assert.equal(plan.expectedBundleRevision, 4);

  expectCode(
    () =>
      prepareReviewAssignmentCreation(admin, {
        bundleId: "bundle-1",
        reviewerEmail: "reviewer@example.com",
        expectedBundleRevision: 4,
      }),
    "FORBIDDEN",
  );
  expectCode(
    () =>
      prepareReviewAssignmentCreation(reviewerActor, {
        bundleId: "bundle-1",
        reviewerEmail: "reviewer@example.com",
        expectedBundleRevision: 4,
      }),
    "FORBIDDEN",
  );
});

test("editorial transition rejects self review, same independence group, and stale revisions", () => {
  expectCode(
    () =>
      prepareEditorialTransition(
        { ...editor, reviewer: { ...editor.reviewer!, id: "reviewer-1" } },
        assignment("a1", "reviewer-1", "group-1"),
        {
          assignmentId: "a1",
          expectedAssignmentRevision: 2,
          expectedBundleRevision: 5,
          note: "مطلوب تعديل واقعة الخوف.",
        },
        ["submitted"],
      ),
    "SELF_APPROVAL",
  );

  expectCode(
    () =>
      prepareEditorialTransition(
        { ...editor, reviewer: { ...editor.reviewer!, independenceGroupId: "group-1" } },
        assignment("a1", "reviewer-1", "group-1"),
        {
          assignmentId: "a1",
          expectedAssignmentRevision: 2,
          expectedBundleRevision: 5,
          note: "مطلوب تعديل واقعة الخوف.",
        },
        ["submitted"],
      ),
    "EDITOR_NOT_INDEPENDENT",
  );

  expectCode(
    () =>
      prepareEditorialTransition(
        editor,
        assignment("a1", "reviewer-1", "group-1"),
        {
          assignmentId: "a1",
          expectedAssignmentRevision: 1,
          expectedBundleRevision: 5,
          note: "مطلوب تعديل واقعة الخوف.",
        },
        ["submitted"],
      ),
    "REVISION_CONFLICT",
  );
});

test("editorial approval must cover every submitted assignment with exact revisions", () => {
  const assignments = [assignment("a1", "reviewer-1", "group-1", 2), assignment("a2", "reviewer-2", "group-2", 7)];
  const plan = prepareEditorialApproval(editor, assignments, {
    bundleId: "bundle-1",
    expectedBundleRevision: 9,
    assignments: [
      { assignmentId: "a1", expectedRevision: 2 },
      { assignmentId: "a2", expectedRevision: 7 },
    ],
    versionFingerprintConfirmed: true,
    notes: "تمت مراجعة النسخة والوقائع.",
    spotChecks: [
      { observationId: "obs-1", result: "confirmed" },
      { observationId: "obs-2", result: "confirmed" },
    ],
  });
  assert.equal(plan.assignments.length, 2);
  assert.equal(plan.versionFingerprintConfirmed, true);

  expectCode(
    () =>
      prepareEditorialApproval(editor, assignments, {
        bundleId: "bundle-1",
        expectedBundleRevision: 9,
        assignments: [{ assignmentId: "a1", expectedRevision: 2 }],
        versionFingerprintConfirmed: true,
        notes: "تمت مراجعة النسخة والوقائع.",
        spotChecks: [],
      }),
    "INVALID_DRAFT",
  );
});

test("editorial approval fails closed without fingerprint confirmation or with forged fields", () => {
  const assignments = [assignment("a1", "reviewer-1", "group-1")];
  expectCode(
    () =>
      prepareEditorialApproval(editor, assignments, {
        bundleId: "bundle-1",
        expectedBundleRevision: 9,
        assignments: [{ assignmentId: "a1", expectedRevision: 2 }],
        versionFingerprintConfirmed: false,
        notes: "تمت المراجعة.",
        spotChecks: [],
      }),
    "INVALID_DRAFT",
  );
  expectCode(
    () =>
      prepareEditorialApproval(editor, assignments, {
        bundleId: "bundle-1",
        expectedBundleRevision: 9,
        assignments: [{ assignmentId: "a1", expectedRevision: 2 }],
        versionFingerprintConfirmed: true,
        approverId: "forged",
        notes: "تمت المراجعة.",
        spotChecks: [],
      }),
    "INVALID_DRAFT",
  );
});
