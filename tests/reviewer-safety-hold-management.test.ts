import assert from "node:assert/strict";
import test from "node:test";

import { ReviewWorkflowError } from "../lib/internal-review-workflow.ts";
import {
  parseManualReviewerSafetyHoldRequest,
  parseReviewerSafetyHoldResolutionRequest,
} from "../lib/reviewer-safety-hold-management.ts";

test("manual hold input accepts only target, revision, note and stored evidence ids", () => {
  const parsed = parseManualReviewerSafetyHoldRequest({
    targetUserId: " reviewer-user ",
    expectedRevision: 4,
    note: "هناك نمط تشغيلي يحتاج تحقيقًا بشريًا قبل السماح بمراجعات جديدة.",
    evidenceEventIds: ["audit-1", "audit-2"],
  });
  assert.equal(parsed.targetUserId, "reviewer-user");
  assert.equal(parsed.expectedRevision, 4);
  assert.deepEqual(parsed.evidenceEventIds, ["audit-1", "audit-2"]);
});

test("client cannot forge hold source, policy version, trigger codes or reviewer id", () => {
  assert.throws(
    () =>
      parseManualReviewerSafetyHoldRequest({
        targetUserId: "reviewer-user",
        expectedRevision: 4,
        note: "هذه ملاحظة كافية الطول لاختبار رفض الحقول المملوكة للخادم.",
        evidenceEventIds: ["audit-1"],
        reviewerId: "forged-reviewer",
        source: "automatic_audit_pattern",
        policyVersion: "forged",
        triggerCodes: ["forged"],
      }),
    (error: unknown) =>
      error instanceof ReviewWorkflowError &&
      error.code === "INVALID_DRAFT" &&
      error.details.includes("reviewerId"),
  );
});

test("manual suspicion hold requires at least one unique audit evidence reference", () => {
  assert.throws(() =>
    parseManualReviewerSafetyHoldRequest({
      targetUserId: "reviewer-user",
      expectedRevision: 4,
      note: "لا يجوز تعليق المراجع يدويًا من غير مرجع تدقيق محفوظ يمكن مراجعته لاحقًا.",
      evidenceEventIds: [],
    }),
  );
  assert.throws(() =>
    parseManualReviewerSafetyHoldRequest({
      targetUserId: "reviewer-user",
      expectedRevision: 4,
      note: "لا يجوز احتساب نفس مرجع التدقيق مرتين لإظهار دليل أقوى مما هو موجود فعليًا.",
      evidenceEventIds: ["audit-1", "audit-1"],
    }),
  );
});

test("resolution accepts only cleared or remediation_required and cannot carry server-owned fields", () => {
  const parsed = parseReviewerSafetyHoldResolutionRequest({
    holdEventId: "safety-hold-1",
    expectedRevision: 5,
    resolution: "remediation_required",
    note: "المراجعة البشرية انتهت إلى ضرورة إعادة المعايرة قبل استئناف العمل.",
  });
  assert.equal(parsed.resolution, "remediation_required");

  assert.throws(() =>
    parseReviewerSafetyHoldResolutionRequest({
      holdEventId: "safety-hold-1",
      expectedRevision: 5,
      resolution: "activate",
      note: "نوع غير صالح ويجب رفضه.",
    }),
  );
  assert.throws(() =>
    parseReviewerSafetyHoldResolutionRequest({
      holdEventId: "safety-hold-1",
      expectedRevision: 5,
      resolution: "cleared",
      note: "تمت مراجعة سبب التعليق بشريًا.",
      resolvedByUserId: "forged-admin",
    }),
  );
});
