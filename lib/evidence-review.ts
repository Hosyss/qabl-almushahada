import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type ContentCategory,
  type ContentFlag,
  type ObservedSeverity,
  type Severity,
} from "./review-engine/types.ts";

export const EVIDENCE_EXTRACTION_METHODS = ["manual", "deterministic", "model_assisted"] as const;
export type EvidenceExtractionMethod = (typeof EVIDENCE_EXTRACTION_METHODS)[number];

export type EvidenceAssertionResult = "none" | "present" | "uncertain";

export interface EvidenceSourceRef {
  id: string;
  versionId: string;
  policySnapshotId: string;
  sourceKey: string;
  sourceUrl: string;
  sourceRevision: string | null;
  contentSha256: string;
}

export interface EvidenceCategoryAssertion {
  id: string;
  evidenceSourceId: string;
  category: ContentCategory;
  result: EvidenceAssertionResult;
  extractionMethod: EvidenceExtractionMethod;
  extractorVersion: string;
  sourceLocator: string;
  summaryAr: string;
}

export interface EvidenceFact {
  id: string;
  assertionId: string;
  category: ContentCategory;
  severity: ObservedSeverity;
  frequency: "single" | "repeated" | "sustained" | "unknown";
  context: "comic" | "neutral" | "educational" | "threatening" | "distressing" | "unknown";
  spoilerLevel: "none" | "contextual" | "major";
  summaryAr: string;
  startSecond: number | null;
  endSecond: number | null;
  flags: ContentFlag[];
}

export interface EvidenceReviewInput {
  versionId: string;
  sources: EvidenceSourceRef[];
  assertions: EvidenceCategoryAssertion[];
  facts: EvidenceFact[];
}

export type EvidenceCategoryCoverageStatus =
  | "covered_none"
  | "covered_present"
  | "unknown"
  | "conflicted";

export interface EvidenceCategoryCoverage {
  category: ContentCategory;
  status: EvidenceCategoryCoverageStatus;
  sourceIds: string[];
  assertionIds: string[];
  factIds: string[];
  maxSeverity: Severity;
}

export type EvidenceReviewStatus = "ready" | "conflicted" | "insufficient_data";

export interface EvidenceReviewIssue {
  code:
    | "VERSION_IDENTITY_MISSING"
    | "NO_EVIDENCE_SOURCES"
    | "DUPLICATE_SOURCE_ID"
    | "SOURCE_VERSION_MISMATCH"
    | "SOURCE_IDENTITY_INVALID"
    | "DUPLICATE_ASSERTION_ID"
    | "ASSERTION_SOURCE_UNKNOWN"
    | "ASSERTION_INVALID"
    | "PRESENT_WITHOUT_FACT"
    | "FACT_ASSERTION_UNKNOWN"
    | "FACT_CATEGORY_MISMATCH"
    | "FACT_ON_NON_PRESENT_ASSERTION"
    | "FACT_INVALID"
    | "DUPLICATE_FACT_ID"
    | "CATEGORY_NOT_COVERED"
    | "PRESENCE_CONFLICT"
    | "SEVERITY_CONFLICT";
  level: "blocking" | "warning";
  category?: ContentCategory;
  sourceIds?: string[];
  assertionIds?: string[];
  factIds?: string[];
  messageAr: string;
}

export interface EvidenceReviewAssessment {
  status: EvidenceReviewStatus;
  engineEligible: boolean;
  issues: EvidenceReviewIssue[];
  categoryCoverage: Record<ContentCategory, EvidenceCategoryCoverage>;
  resolvedFacts: EvidenceFact[];
}

const CONFLICT_CODES = new Set<EvidenceReviewIssue["code"]>([
  "PRESENCE_CONFLICT",
  "SEVERITY_CONFLICT",
]);

function emptyCoverage(): Record<ContentCategory, EvidenceCategoryCoverage> {
  return Object.fromEntries(
    CONTENT_CATEGORIES.map((category) => [
      category,
      {
        category,
        status: "unknown",
        sourceIds: [],
        assertionIds: [],
        factIds: [],
        maxSeverity: 0,
      },
    ]),
  ) as Record<ContentCategory, EvidenceCategoryCoverage>;
}

function addIssue(
  issues: EvidenceReviewIssue[],
  issue: EvidenceReviewIssue,
): void {
  issues.push({
    ...issue,
    sourceIds: unique(issue.sourceIds ?? []),
    assertionIds: unique(issue.assertionIds ?? []),
    factIds: unique(issue.factIds ?? []),
  });
}

export function assessEvidenceReview(input: EvidenceReviewInput): EvidenceReviewAssessment {
  const issues: EvidenceReviewIssue[] = [];
  const coverage = emptyCoverage();

  if (!isBoundedText(input.versionId, 1, 160)) {
    addIssue(issues, {
      code: "VERSION_IDENTITY_MISSING",
      level: "blocking",
      messageAr: "هوية النسخة التي تخصها الأدلة غير مكتملة.",
    });
  }

  if (input.sources.length === 0) {
    addIssue(issues, {
      code: "NO_EVIDENCE_SOURCES",
      level: "blocking",
      messageAr: "لا توجد مصادر أدلة لهذه النسخة؛ لا يمكن إصدار مراجعة من فراغ.",
    });
  }

  const sourcesById = new Map<string, EvidenceSourceRef>();
  for (const source of input.sources) {
    if (sourcesById.has(source.id)) {
      addIssue(issues, {
        code: "DUPLICATE_SOURCE_ID",
        level: "blocking",
        sourceIds: [source.id],
        messageAr: "يوجد معرّف مصدر دليل مكرر، لذلك لا يمكن تتبع provenance بأمان.",
      });
      continue;
    }
    sourcesById.set(source.id, source);

    if (source.versionId !== input.versionId) {
      addIssue(issues, {
        code: "SOURCE_VERSION_MISMATCH",
        level: "blocking",
        sourceIds: [source.id],
        messageAr: "مصدر دليل مرتبط بنسخة أخرى من العمل.",
      });
    }

    if (
      !isBoundedText(source.id, 1, 160) ||
      !isBoundedText(source.policySnapshotId, 1, 220) ||
      !isBoundedText(source.sourceKey, 1, 80) ||
      !isHttpsUrl(source.sourceUrl) ||
      !/^[0-9a-f]{64}$/u.test(source.contentSha256)
    ) {
      addIssue(issues, {
        code: "SOURCE_IDENTITY_INVALID",
        level: "blocking",
        sourceIds: [source.id],
        messageAr: "هوية مصدر الدليل أو رابطه أو بصمته غير صالحة.",
      });
    }
  }

  const assertionsById = new Map<string, EvidenceCategoryAssertion>();
  const assertionsByCategory = new Map<ContentCategory, EvidenceCategoryAssertion[]>();
  for (const assertion of input.assertions) {
    if (assertionsById.has(assertion.id)) {
      addIssue(issues, {
        code: "DUPLICATE_ASSERTION_ID",
        level: "blocking",
        category: assertion.category,
        assertionIds: [assertion.id],
        messageAr: "يوجد معرّف claim مكرر داخل الأدلة.",
      });
      continue;
    }
    assertionsById.set(assertion.id, assertion);

    const source = sourcesById.get(assertion.evidenceSourceId);
    if (!source) {
      addIssue(issues, {
        code: "ASSERTION_SOURCE_UNKNOWN",
        level: "blocking",
        category: assertion.category,
        sourceIds: [assertion.evidenceSourceId],
        assertionIds: [assertion.id],
        messageAr: "يوجد claim لا يشير إلى مصدر دليل معروف.",
      });
    }

    if (
      !(CONTENT_CATEGORIES as readonly string[]).includes(assertion.category) ||
      !["none", "present", "uncertain"].includes(assertion.result) ||
      !(EVIDENCE_EXTRACTION_METHODS as readonly string[]).includes(assertion.extractionMethod) ||
      !isBoundedText(assertion.extractorVersion, 1, 120) ||
      !isBoundedText(assertion.sourceLocator, 1, 500) ||
      !isBoundedText(assertion.summaryAr, 1, 1000)
    ) {
      addIssue(issues, {
        code: "ASSERTION_INVALID",
        level: "blocking",
        category: assertion.category,
        assertionIds: [assertion.id],
        messageAr: "claim مستخرج من الدليل يحتوي قيمة غير صالحة أو غير قابلة للتتبع.",
      });
    }

    const categoryAssertions = assertionsByCategory.get(assertion.category) ?? [];
    categoryAssertions.push(assertion);
    assertionsByCategory.set(assertion.category, categoryAssertions);
  }

  const factsByAssertion = new Map<string, EvidenceFact[]>();
  const factsById = new Map<string, EvidenceFact>();
  for (const fact of input.facts) {
    if (factsById.has(fact.id)) {
      addIssue(issues, {
        code: "DUPLICATE_FACT_ID",
        level: "blocking",
        category: fact.category,
        factIds: [fact.id],
        messageAr: "يوجد معرّف واقعة evidence مكرر.",
      });
      continue;
    }
    factsById.set(fact.id, fact);

    const assertion = assertionsById.get(fact.assertionId);
    if (!assertion) {
      addIssue(issues, {
        code: "FACT_ASSERTION_UNKNOWN",
        level: "blocking",
        category: fact.category,
        assertionIds: [fact.assertionId],
        factIds: [fact.id],
        messageAr: "واقعة evidence لا تشير إلى claim معروف.",
      });
      continue;
    }

    if (assertion.category !== fact.category) {
      addIssue(issues, {
        code: "FACT_CATEGORY_MISMATCH",
        level: "blocking",
        category: fact.category,
        assertionIds: [assertion.id],
        factIds: [fact.id],
        messageAr: "محور الواقعة لا يطابق محور الـclaim الذي تستند إليه.",
      });
    }

    if (assertion.result !== "present") {
      addIssue(issues, {
        code: "FACT_ON_NON_PRESENT_ASSERTION",
        level: "blocking",
        category: fact.category,
        assertionIds: [assertion.id],
        factIds: [fact.id],
        messageAr: "لا يجوز إرفاق واقعة بـclaim يقول إن المحور غير موجود أو غير محسوم.",
      });
    }

    if (!isValidFact(fact)) {
      addIssue(issues, {
        code: "FACT_INVALID",
        level: "blocking",
        category: fact.category,
        assertionIds: [assertion.id],
        factIds: [fact.id],
        messageAr: "واقعة evidence تحتوي شدة أو وصفًا أو flag أو توقيتًا غير صالح.",
      });
    }

    const assertionFacts = factsByAssertion.get(fact.assertionId) ?? [];
    assertionFacts.push(fact);
    factsByAssertion.set(fact.assertionId, assertionFacts);
  }

  for (const assertion of input.assertions) {
    if (assertion.result === "present" && (factsByAssertion.get(assertion.id)?.length ?? 0) === 0) {
      addIssue(issues, {
        code: "PRESENT_WITHOUT_FACT",
        level: "blocking",
        category: assertion.category,
        sourceIds: [assertion.evidenceSourceId],
        assertionIds: [assertion.id],
        messageAr: "الدليل يقول إن المحور موجود من غير واقعة منظمة تفسر هذا الادعاء.",
      });
    }
  }

  for (const category of CONTENT_CATEGORIES) {
    const categoryAssertions = assertionsByCategory.get(category) ?? [];
    const explicit = categoryAssertions.filter((assertion) => assertion.result !== "uncertain");
    const present = explicit.filter((assertion) => assertion.result === "present");
    const none = explicit.filter((assertion) => assertion.result === "none");
    const sourceIds = unique(explicit.map((assertion) => assertion.evidenceSourceId));
    const assertionIds = explicit.map((assertion) => assertion.id);
    const categoryFacts = present.flatMap((assertion) => factsByAssertion.get(assertion.id) ?? []);
    const factIds = categoryFacts.map((fact) => fact.id);
    const maxSeverity = categoryFacts.reduce<Severity>(
      (maximum, fact) => Math.max(maximum, fact.severity) as Severity,
      0,
    );

    coverage[category] = {
      category,
      status: "unknown",
      sourceIds,
      assertionIds,
      factIds,
      maxSeverity,
    };

    if (explicit.length === 0) {
      addIssue(issues, {
        code: "CATEGORY_NOT_COVERED",
        level: "blocking",
        category,
        messageAr: `لا يوجد دليل صريح يحسم محور «${category}»؛ غياب الذكر لا يُحسب كعدم وجود.`,
      });
      continue;
    }

    if (present.length > 0 && none.length > 0) {
      coverage[category].status = "conflicted";
      addIssue(issues, {
        code: "PRESENCE_CONFLICT",
        level: "blocking",
        category,
        sourceIds,
        assertionIds,
        factIds,
        messageAr: `المصادر متعارضة على وجود محور «${category}» من الأساس.`,
      });
      continue;
    }

    if (present.length > 0) {
      const severityBySource = new Map<string, Severity>();
      for (const assertion of present) {
        const sourceMax = (factsByAssertion.get(assertion.id) ?? []).reduce<Severity>(
          (maximum, fact) => Math.max(maximum, fact.severity) as Severity,
          0,
        );
        severityBySource.set(
          assertion.evidenceSourceId,
          Math.max(severityBySource.get(assertion.evidenceSourceId) ?? 0, sourceMax) as Severity,
        );
      }
      const severities = [...severityBySource.values()].filter((severity) => severity > 0);
      const severityConflict =
        severities.length >= 2 && Math.max(...severities) - Math.min(...severities) >= 2;

      if (severityConflict) {
        coverage[category].status = "conflicted";
        addIssue(issues, {
          code: "SEVERITY_CONFLICT",
          level: "blocking",
          category,
          sourceIds: [...severityBySource.keys()],
          assertionIds: present.map((assertion) => assertion.id),
          factIds,
          messageAr: `فرق الشدة بين مصادر مستقلة في محور «${category}» أكبر من الحد المقبول.`,
        });
        continue;
      }

      coverage[category].status = "covered_present";
      continue;
    }

    coverage[category].status = "covered_none";
  }

  const blocking = issues.filter((item) => item.level === "blocking");
  const hasConflict = blocking.some((item) => CONFLICT_CODES.has(item.code));
  const status: EvidenceReviewStatus = hasConflict
    ? "conflicted"
    : blocking.length > 0
      ? "insufficient_data"
      : "ready";

  const validFactIds = new Set(
    Object.values(coverage)
      .filter((item) => item.status === "covered_present")
      .flatMap((item) => item.factIds),
  );
  const invalidFactIds = new Set(
    issues
      .filter((item) => item.level === "blocking")
      .flatMap((item) => item.factIds ?? []),
  );

  return {
    status,
    engineEligible: status === "ready",
    issues,
    categoryCoverage: coverage,
    resolvedFacts: input.facts.filter(
      (fact) => validFactIds.has(fact.id) && !invalidFactIds.has(fact.id),
    ),
  };
}

function isValidFact(fact: EvidenceFact): boolean {
  const validTiming =
    (fact.startSecond === null && fact.endSecond === null) ||
    (Number.isFinite(fact.startSecond) &&
      Number.isFinite(fact.endSecond) &&
      (fact.startSecond as number) >= 0 &&
      (fact.endSecond as number) >= (fact.startSecond as number));

  return (
    isBoundedText(fact.id, 1, 160) &&
    isBoundedText(fact.assertionId, 1, 160) &&
    (CONTENT_CATEGORIES as readonly string[]).includes(fact.category) &&
    Number.isInteger(fact.severity) &&
    fact.severity >= 1 &&
    fact.severity <= 4 &&
    ["single", "repeated", "sustained", "unknown"].includes(fact.frequency) &&
    ["comic", "neutral", "educational", "threatening", "distressing", "unknown"].includes(
      fact.context,
    ) &&
    ["none", "contextual", "major"].includes(fact.spoilerLevel) &&
    isBoundedText(fact.summaryAr, 1, 1000) &&
    validTiming &&
    fact.flags.every((flag) => (CONTENT_FLAGS as readonly string[]).includes(flag)) &&
    unique(fact.flags).length === fact.flags.length
  );
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function isBoundedText(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max &&
    !value.includes("\u0000")
  );
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}
