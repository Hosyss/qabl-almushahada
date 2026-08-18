import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("honeypot success uses an unpersisted UUID instead of a distinguishable null reference", async () => {
  const service = await readFile(new URL("../db/public-report-intake-service.ts", import.meta.url), "utf8");
  assert.match(service, /accepted: true; intakeId: string/u);
  assert.match(
    service,
    /automatedSubmission\) return \{ accepted: true, intakeId: crypto\.randomUUID\(\) \}/u,
  );
  assert.doesNotMatch(service, /intakeId: string \| null|intakeId: null/u);
});

test("public intake keeps same-origin, Cloudflare address, HMAC, and server snapshot guards", async () => {
  const service = await readFile(new URL("../db/public-report-intake-service.ts", import.meta.url), "utf8");
  const triage = await readFile(new URL("../db/public-report-triage-service.ts", import.meta.url), "utf8");
  assert.match(service, /origin && origin !== url\.origin/u);
  assert.match(service, /sec-fetch-site/u);
  assert.match(service, /fetchSite !== "same-origin" && fetchSite !== "none"/u);
  assert.match(service, /cf-connecting-ip/u);
  assert.doesNotMatch(service, /x-forwarded-for|x-real-ip/iu);
  assert.match(service, /PUBLIC_REPORT_HMAC_SECRET/u);
  assert.match(service, /secret\.length < 32/u);
  assert.match(service, /CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY/u);
  assert.match(service, /buildPublicEvidenceReviewGateQuery/u);
  assert.match(triage, /b\.current_approval_id = i\.target_snapshot_ref/u);
  assert.match(triage, /b\.revision = i\.target_revision/u);
  assert.match(triage, /b\.version_id = i\.target_version_id/u);
});

test("does not accept arrays or non-string honeypot values", () => {
  assert.equal(preparePublicReportIntake([]).accepted, false);
  assert.equal(preparePublicReportIntake({ ...validInput, website: 1 }).accepted, false);
});
