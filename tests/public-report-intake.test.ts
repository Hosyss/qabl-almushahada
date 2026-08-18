import assert from "node:assert/strict";
import test from "node:test";

import {
  PUBLIC_REPORT_MESSAGE_MAX,
  PUBLIC_REPORT_MESSAGE_MIN,
  PUBLIC_REPORT_TARGET_ID_MAX,
  preparePublicReportIntake,
} from "../lib/public-report-intake.ts";

const validInput = {
  targetKind: "editorial_publication",
  targetId: "et-1982-editorial-batch-v1",
  reason: "missing_content",
  message: "يوجد مشهد مهم غير مذكور في التحليل ويحتاج إلى مراجعة المصدر.",
  website: "",
};

test("accepts a bounded known public report payload", () => {
  assert.deepEqual(preparePublicReportIntake(validInput), {
    accepted: true,
    targetKind: "editorial_publication",
    targetPublicId: "et-1982-editorial-batch-v1",
    reportReason: "missing_content",
    message: validInput.message,
    automatedSubmission: false,
  });
});

test("accepts all three supported public target kinds", () => {
  for (const targetKind of ["human_review", "evidence_publication", "editorial_publication"]) {
    const result = preparePublicReportIntake({ ...validInput, targetKind });
    assert.equal(result.accepted, true, targetKind);
  }
});

test("rejects unknown target kinds and report reasons", () => {
  const badTarget = preparePublicReportIntake({ ...validInput, targetKind: "random_page" });
  const badReason = preparePublicReportIntake({ ...validInput, reason: "take_down_now" });
  assert.equal(badTarget.accepted, false);
  assert.equal(badReason.accepted, false);
});

test("rejects extra fields instead of silently trusting client metadata", () => {
  const result = preparePublicReportIntake({
    ...validInput,
    revision: 99,
    approvalId: "client-controlled",
    actorId: "admin",
  });
  assert.deepEqual(result, {
    accepted: false,
    reason: "invalid_input",
    errorsAr: ["بيانات البلاغ تحتوي حقولًا غير معروفة"],
  });
});

test("rejects invalid or control-character target ids", () => {
  for (const targetId of ["", "x".repeat(PUBLIC_REPORT_TARGET_ID_MAX + 1), "abc\nxyz"]) {
    const result = preparePublicReportIntake({ ...validInput, targetId });
    assert.equal(result.accepted, false, JSON.stringify({ targetId }));
  }
});

test("enforces the public message length contract", () => {
  const tooShort = preparePublicReportIntake({
    ...validInput,
    message: "x".repeat(PUBLIC_REPORT_MESSAGE_MIN - 1),
  });
  const maximum = preparePublicReportIntake({
    ...validInput,
    message: "x".repeat(PUBLIC_REPORT_MESSAGE_MAX),
  });
  const tooLong = preparePublicReportIntake({
    ...validInput,
    message: "x".repeat(PUBLIC_REPORT_MESSAGE_MAX + 1),
  });
  assert.equal(tooShort.accepted, false);
  assert.equal(maximum.accepted, true);
  assert.equal(tooLong.accepted, false);
});

test("marks the hidden website field as automated without invalidating the outward payload", () => {
  const result = preparePublicReportIntake({ ...validInput, website: "https://spam.invalid" });
  assert.equal(result.accepted, true);
  if (result.accepted) assert.equal(result.automatedSubmission, true);
});

test("does not accept arrays or non-string honeypot values", () => {
  assert.equal(preparePublicReportIntake([]).accepted, false);
  assert.equal(preparePublicReportIntake({ ...validInput, website: 1 }).accepted, false);
});
