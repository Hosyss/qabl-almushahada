import assert from "node:assert/strict";
import test from "node:test";

import {
  LOCAL_FAMILY_SETTINGS_STORAGE_KEY,
  serializeLocalFamilySettings,
} from "../lib/local-family-settings.ts";
import {
  PUBLIC_CORRECTION_POLICY_FACTS,
  PUBLIC_POLICY_NAV,
  PUBLIC_POLICY_PAGES,
  PUBLIC_PRIVACY_POLICY_FACTS,
  PUBLIC_REVIEW_POLICY_FACTS,
} from "../lib/public-policy-pages.ts";
import {
  BASELINE_AUDIT_RATE_BPS,
  HIGH_RISK_AUDIT_RATE_BPS,
} from "../lib/review-audit-selection.ts";
import {
  HIGH_SENSITIVITY_CATEGORY_THRESHOLDS,
  HIGH_SENSITIVITY_FLAG_THRESHOLDS,
} from "../lib/review-engine/risk-policy.ts";

test("P3-06 exposes exactly the three public policy routes", () => {
  assert.deepEqual(
    PUBLIC_POLICY_NAV.map((item) => item.href),
    ["/review-policy", "/privacy", "/corrections"],
  );

  const sectionIds = Object.values(PUBLIC_POLICY_PAGES).flatMap((page) =>
    page.sections.map((section) => `${page.href}:${section.id}`),
  );
  assert.equal(new Set(sectionIds).size, sectionIds.length);
});

test("public review policy stays synchronized with the live audit and risk constants", () => {
  assert.equal(PUBLIC_REVIEW_POLICY_FACTS.baselineAuditPercent, BASELINE_AUDIT_RATE_BPS / 100);
  assert.equal(PUBLIC_REVIEW_POLICY_FACTS.highRiskAuditPercent, HIGH_RISK_AUDIT_RATE_BPS / 100);
  assert.equal(PUBLIC_REVIEW_POLICY_FACTS.minimumIndependentReviewers, 2);
  assert.equal(PUBLIC_REVIEW_POLICY_FACTS.highRiskIndependentReviewers, 3);
  assert.deepEqual(PUBLIC_REVIEW_POLICY_FACTS.categoryThresholds, HIGH_SENSITIVITY_CATEGORY_THRESHOLDS);
  assert.deepEqual(PUBLIC_REVIEW_POLICY_FACTS.flagThresholds, HIGH_SENSITIVITY_FLAG_THRESHOLDS);

  const reviewText = JSON.stringify(PUBLIC_POLICY_PAGES.review.sections);
  assert.match(reviewText, new RegExp(`إيذاء النفس.*${HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.selfHarm}`));
  assert.match(reviewText, new RegExp(`المحتوى الجنسي.*${HIGH_SENSITIVITY_CATEGORY_THRESHOLDS.sexualContent}`));
  assert.match(reviewText, new RegExp(`تتابع وميض.*${HIGH_SENSITIVITY_FLAG_THRESHOLDS.flashing_sequence}`));
});

test("privacy policy mirrors local family settings and public-report anti-abuse storage", () => {
  assert.equal(PUBLIC_PRIVACY_POLICY_FACTS.familySettingsStorageKey, LOCAL_FAMILY_SETTINGS_STORAGE_KEY);
  assert.equal(PUBLIC_PRIVACY_POLICY_FACTS.familySettingsSentToD1, false);
  assert.equal(PUBLIC_PRIVACY_POLICY_FACTS.publicAccountRequired, false);
  assert.equal(PUBLIC_PRIVACY_POLICY_FACTS.publicReportAccountRequired, false);
  assert.equal(PUBLIC_PRIVACY_POLICY_FACTS.publicReportRawIpStored, false);
  assert.equal(PUBLIC_PRIVACY_POLICY_FACTS.publicReportClientKeyDerivation, "HMAC-SHA256");

  const stored = JSON.parse(
    serializeLocalFamilySettings({ childAge: 9, fearLimit: 2, avoidBullying: true }),
  ) as Record<string, unknown>;
  const expectedStoredKeys = [
    ...PUBLIC_PRIVACY_POLICY_FACTS.familySettingsFields,
    "version",
  ].sort();
  assert.deepEqual(Object.keys(stored).sort(), expectedStoredKeys);
  assert.equal("childName" in stored, false);
  assert.equal("dateOfBirth" in stored, false);

  const privacyText = JSON.stringify(PUBLIC_POLICY_PAGES.privacy.sections);
  assert.match(privacyText, /HMAC-SHA256/u);
  assert.match(privacyText, /لا يُخزن عنوان IP الخام/u);
  assert.match(privacyText, /لا تُرسل إعدادات عمر الطفل أو تفضيلات الأسرة مع البلاغ/u);
});

test("correction policy exposes intake without treating every report as a material stop", () => {
  assert.deepEqual(PUBLIC_CORRECTION_POLICY_FACTS.blockingReportStatuses, ["open", "investigating"]);
  assert.deepEqual(PUBLIC_CORRECTION_POLICY_FACTS.resolutions, [
    "no_issue",
    "correction_required",
    "different_version",
  ]);
  assert.equal(PUBLIC_CORRECTION_POLICY_FACTS.publicReportIntakeAvailable, true);
  assert.equal(PUBLIC_CORRECTION_POLICY_FACTS.publicReportChangesPublishedDecisionAutomatically, false);
  assert.equal(PUBLIC_CORRECTION_POLICY_FACTS.historicalRevisionsMutable, false);

  const correctionText = JSON.stringify(PUBLIC_POLICY_PAGES.corrections);
  assert.match(correctionText, /تبدأ بمرحلة فرز بشرية/u);
  assert.match(correctionText, /لا يغير الحكم المنشور تلقائيًا/u);
  assert.match(correctionText, /التحليل التحريري أو مراجعة الأدلة.*لا تُسقط المحتوى تلقائيًا/u);
  assert.doesNotMatch(correctionText, /لم تُوصل تقنيًا بعد/u);
});
