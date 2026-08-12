import assert from "node:assert/strict";
import test from "node:test";

import { prepareInternalUserStatusChange } from "../lib/internal-review-management.ts";
import { ReviewWorkflowError, type InternalActor } from "../lib/internal-review-workflow.ts";

const admin: InternalActor = {
  userId: "admin-1",
  email: "admin@example.com",
  role: "admin",
  status: "active",
  reviewer: null,
};

test("reactivating a suspended internal account is blocked until P2Q reactivation policy exists", () => {
  assert.throws(
    () =>
      prepareInternalUserStatusChange(admin, {
        targetUserId: "reviewer-user-1",
        expectedRevision: 4,
        status: "active",
      }),
    (error: unknown) =>
      error instanceof ReviewWorkflowError &&
      error.code === "FORBIDDEN" &&
      error.message.includes("P2Q"),
  );
});

test("admin may still prepare a revision-locked suspension of another account", () => {
  const plan = prepareInternalUserStatusChange(admin, {
    targetUserId: "reviewer-user-1",
    expectedRevision: 4,
    status: "suspended",
  });
  assert.deepEqual(plan, {
    targetUserId: "reviewer-user-1",
    expectedRevision: 4,
    status: "suspended",
  });
});
