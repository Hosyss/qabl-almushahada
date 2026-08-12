import assert from "node:assert/strict";
import test from "node:test";

import {
  ReviewWorkflowError,
  type InternalActor,
} from "../lib/internal-review-workflow.ts";
import { prepareReviewReportResolution } from "../lib/review-report-resolution.ts";

const editor: InternalActor = {
  userId: "editor-user",
  email: "editor@example.com",
  role: "editorial_reviewer",
  status: "active",
  reviewer: {
    id: "editor-reviewer",
    independenceGroupId: "editor-group",
    status: "active",
  },
};

const validRequest = {
  reportId: "report-1",
  expectedReportRevision: 0,
  expectedBundleRevision: 6,
  resolutionKind: "no_issue",
  note: "تمت إعادة فحص البلاغ ولم يظهر اختلاف جوهري في النسخة المعتمدة.",
};

test("active editorial reviewer may prepare a no-issue dismissal", () => {
  const plan = prepareReviewReportResolution(editor, validRequest);
  assert.equal(plan.reportId, "report-1");
  assert.equal(plan.resolutionKind, "no_issue");
  assert.equal(plan.expectedReportRevision, 0);
  assert.equal(plan.expectedBundleRevision, 6);
});

test("active editorial reviewer may require a material correction", () => {
  const plan = prepareReviewReportResolution(editor, {
    ...validRequest,
    resolutionKind: "correction_required",
    note: "أكد التدقيق وجود واقعة ناقصة ويجب إعادة المراجعة والاعتماد بالكامل.",
  });
  assert.equal(plan.resolutionKind, "correction_required");
});

test("non-editor roles cannot resolve a material report", () => {
  const coordinator: InternalActor = {
    ...editor,
    role: "review_coordinator",
    reviewer: null,
  };
  assert.throws(
    () => prepareReviewReportResolution(coordinator, validRequest),
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === "FORBIDDEN",
  );
});

test("suspended editor and suspended reviewer identity both fail closed", () => {
  assert.throws(
    () => prepareReviewReportResolution({ ...editor, status: "suspended" }, validRequest),
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === "ACCOUNT_SUSPENDED",
  );
  assert.throws(
    () =>
      prepareReviewReportResolution(
        {
          ...editor,
          reviewer: { ...editor.reviewer!, status: "suspended" },
        },
        validRequest,
      ),
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === "FORBIDDEN",
  );
});

test("resolution request rejects forged server-owned fields", () => {
  assert.throws(
    () =>
      prepareReviewReportResolution(editor, {
        ...validRequest,
        versionId: "forged-version",
        invalidatedApprovalId: "forged-approval",
      }),
    (error: unknown) =>
      error instanceof ReviewWorkflowError &&
      error.code === "INVALID_DRAFT" &&
      error.details.some((detail) => detail.includes("versionId")),
  );
});

test("stale-shaped revisions and short notes are rejected", () => {
  assert.throws(
    () => prepareReviewReportResolution(editor, { ...validRequest, expectedBundleRevision: -1 }),
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === "REVISION_CONFLICT",
  );
  assert.throws(
    () => prepareReviewReportResolution(editor, { ...validRequest, note: "قصير" }),
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === "INVALID_DRAFT",
  );
});
