import assert from "node:assert/strict";
import test from "node:test";

import { ReviewWorkflowError } from "../lib/internal-review-workflow.ts";
import { parseAuditOutcomeRequest } from "../lib/review-audit-outcome.ts";

test("empty findings represent a syntactically valid confirmed audit request", () => {
  const parsed = parseAuditOutcomeRequest({
    selectionId: "selection-1",
    notes: "أعيدت مشاهدة العينة ولم يظهر اختلاف عن المراجعة الأصلية.",
    findings: [],
  });
  assert.equal(parsed.selectionId, "selection-1");
  assert.deepEqual(parsed.findings, []);
});

test("missed-event findings accept strict category, severity, timing and summary fields", () => {
  const parsed = parseAuditOutcomeRequest({
    selectionId: "selection-2",
    notes: "وجد المدقق واقعة لم تسجل في المراجعة الأصلية.",
    findings: [
      {
        type: "missed_event",
        category: "violence",
        auditorSeverity: 3,
        startSecond: 100,
        endSecond: 120,
        summary: "واقعة عنف واضحة لم تسجل في submission الأصلية.",
      },
    ],
  });
  assert.equal(parsed.findings[0]?.type, "missed_event");
});

test("severity-difference requests never accept client-supplied reviewer severity", () => {
  assert.throws(
    () =>
      parseAuditOutcomeRequest({
        selectionId: "selection-3",
        notes: "فرق شدة يحتاج تحققًا من الواقعة الأصلية.",
        findings: [
          {
            type: "severity_difference",
            observationId: "observation-1",
            reviewerSeverity: 1,
            auditorSeverity: 3,
            summary: "الشدة المسجلة أقل من المشاهدة المستقلة.",
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ReviewWorkflowError &&
      error.code === "INVALID_DRAFT" &&
      error.details.some((detail) => detail.includes("reviewerSeverity")),
  );
});

test("duplicate severity findings for the same observation are rejected", () => {
  assert.throws(
    () =>
      parseAuditOutcomeRequest({
        selectionId: "selection-4",
        notes: "duplicate fixture",
        findings: [
          {
            type: "severity_difference",
            observationId: "observation-1",
            auditorSeverity: 2,
            summary: "فرق أول في الشدة المسجلة.",
          },
          {
            type: "severity_difference",
            observationId: "observation-1",
            auditorSeverity: 3,
            summary: "فرق ثان لنفس الواقعة يجب رفضه.",
          },
        ],
      }),
    (error: unknown) => error instanceof ReviewWorkflowError && error.code === "INVALID_DRAFT",
  );
});

test("forged server-owned identities and unknown fields are rejected", () => {
  assert.throws(
    () =>
      parseAuditOutcomeRequest({
        selectionId: "selection-5",
        notes: "forged fixture",
        findings: [],
        subjectReviewerId: "forged-reviewer",
        auditorUserId: "forged-user",
      }),
    (error: unknown) =>
      error instanceof ReviewWorkflowError &&
      error.details.some((detail) => detail.includes("subjectReviewerId")),
  );
});

test("invalid categories, severities and time order fail closed", () => {
  assert.throws(() =>
    parseAuditOutcomeRequest({
      selectionId: "selection-6",
      findings: [
        {
          type: "missed_event",
          category: "unknown",
          auditorSeverity: 2,
          startSecond: 0,
          endSecond: 1,
          summary: "invalid category fixture",
        },
      ],
    }),
  );
  assert.throws(() =>
    parseAuditOutcomeRequest({
      selectionId: "selection-7",
      findings: [
        {
          type: "missed_event",
          category: "fear",
          auditorSeverity: 5,
          startSecond: 0,
          endSecond: 1,
          summary: "invalid severity fixture",
        },
      ],
    }),
  );
  assert.throws(() =>
    parseAuditOutcomeRequest({
      selectionId: "selection-8",
      findings: [
        {
          type: "missed_event",
          category: "fear",
          auditorSeverity: 2,
          startSecond: 20,
          endSecond: 10,
          summary: "invalid time order fixture",
        },
      ],
    }),
  );
});
