import { CONTENT_CATEGORIES, type ContentCategory, type ObservedSeverity } from "./review-engine/types.ts";
import { ReviewWorkflowError } from "./internal-review-workflow.ts";

export type AuditFindingInput =
  | {
      type: "missed_event";
      category: ContentCategory;
      auditorSeverity: ObservedSeverity;
      startSecond: number;
      endSecond: number;
      summary: string;
    }
  | {
      type: "severity_difference";
      observationId: string;
      auditorSeverity: ObservedSeverity;
      summary: string;
    };

export interface AuditOutcomeRequest {
  selectionId: string;
  notes: string;
  findings: AuditFindingInput[];
}

export function parseAuditOutcomeRequest(raw: unknown): AuditOutcomeRequest {
  const input = requirePlainObject(raw, "بيانات نتيجة التدقيق غير صالحة.");
  rejectUnknownKeys(input, ["selectionId", "notes", "findings"]);

  const selectionId = requireTrimmedString(input.selectionId, "selectionId", 1, 160);
  const notes = requireTrimmedString(input.notes ?? "", "notes", 0, 4000);
  if (!Array.isArray(input.findings)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "قائمة findings مطلوبة حتى لو كانت فارغة.");
  }
  if (input.findings.length > 200) {
    throw new ReviewWorkflowError("INVALID_DRAFT", "عدد findings أكبر من الحد المسموح.");
  }

  const seenSeverityObservationIds = new Set<string>();
  const findings = input.findings.map((value, index): AuditFindingInput => {
    const finding = requirePlainObject(value, `finding[${index}] غير صالح.`);
    const type = finding.type;

    if (type === "missed_event") {
      rejectUnknownKeys(finding, [
        "type",
        "category",
        "auditorSeverity",
        "startSecond",
        "endSecond",
        "summary",
      ]);
      const category = requireCategory(finding.category);
      const auditorSeverity = requireSeverity(finding.auditorSeverity, "auditorSeverity");
      const startSecond = requireNonNegativeInteger(finding.startSecond, "startSecond");
      const endSecond = requireNonNegativeInteger(finding.endSecond, "endSecond");
      if (endSecond < startSecond) {
        throw new ReviewWorkflowError("INVALID_DRAFT", "نهاية الحدث الفائت تسبق بدايته.");
      }
      return {
        type,
        category,
        auditorSeverity,
        startSecond,
        endSecond,
        summary: requireTrimmedString(finding.summary, "summary", 5, 1000),
      };
    }

    if (type === "severity_difference") {
      rejectUnknownKeys(finding, ["type", "observationId", "auditorSeverity", "summary"]);
      const observationId = requireTrimmedString(finding.observationId, "observationId", 1, 160);
      if (seenSeverityObservationIds.has(observationId)) {
        throw new ReviewWorkflowError(
          "INVALID_DRAFT",
          "لا يمكن تسجيل فرق شدة مرتين لنفس الواقعة في نفس التدقيق.",
        );
      }
      seenSeverityObservationIds.add(observationId);
      return {
        type,
        observationId,
        auditorSeverity: requireSeverity(finding.auditorSeverity, "auditorSeverity"),
        summary: requireTrimmedString(finding.summary, "summary", 5, 1000),
      };
    }

    throw new ReviewWorkflowError("INVALID_DRAFT", `finding[${index}] له نوع غير معروف.`);
  });

  return { selectionId, notes, findings };
}

function requirePlainObject(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReviewWorkflowError("INVALID_DRAFT", message);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownKeys(input: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw new ReviewWorkflowError(
      "INVALID_DRAFT",
      "الطلب يحتوي حقولًا غير مسموح بها.",
      unknown.map((key) => `unknown field: ${key}`),
    );
  }
}

function requireTrimmedString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
): string {
  if (typeof value !== "string") {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} يجب أن يكون نصًا.`);
  }
  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} خارج الطول المسموح.`);
  }
  return normalized;
}

function requireCategory(value: unknown): ContentCategory {
  if (typeof value === "string" && (CONTENT_CATEGORIES as readonly string[]).includes(value)) {
    return value as ContentCategory;
  }
  throw new ReviewWorkflowError("INVALID_DRAFT", "محور finding غير معروف.");
}

function requireSeverity(value: unknown, field: string): ObservedSeverity {
  if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 4) {
    return value as ObservedSeverity;
  }
  throw new ReviewWorkflowError("INVALID_DRAFT", `${field} يجب أن يكون من 1 إلى 4.`);
}

function requireNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new ReviewWorkflowError("INVALID_DRAFT", `${field} يجب أن يكون عددًا صحيحًا غير سالب.`);
  }
  return value;
}
