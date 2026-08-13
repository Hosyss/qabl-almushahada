import assert from "node:assert/strict";
import test from "node:test";

import { assessEvidenceReview, type EvidenceSourceRef } from "../lib/evidence-review.ts";
import { CONTENT_CATEGORIES, type ContentCategory } from "../lib/review-engine/types.ts";
import {
  WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS,
  WORKERS_AI_EVIDENCE_MODEL,
  chunkMarkedParagraphs,
  extractEvidenceWithWorkersAi,
  markEvidenceParagraphs,
  type WorkersAiRunner,
} from "../lib/workers-ai-evidence-extractor.ts";

const SOURCE: EvidenceSourceRef = {
  id: "evidence:wikipedia:ar:123:987654321",
  versionId: "version-ai-test",
  policySnapshotId: "source-policy:wikipedia:2026-08-13.1:analysis_evidence",
  sourceKey: "wikipedia",
  sourceUrl: "https://ar.wikipedia.org/wiki/Test",
  sourceRevision: "987654321",
  contentSha256: "a".repeat(64),
};

function uncertainClaim(category: ContentCategory) {
  return {
    category,
    result: "uncertain",
    summaryAr: `لا يقدم هذا الجزء دليلًا صريحًا كافيًا على ${category}.`,
    sourceLocators: [],
    facts: [],
  };
}

function validClaims(options: {
  presentCategory?: ContentCategory;
  locator?: string;
  severity?: number;
} = {}) {
  const claims = CONTENT_CATEGORIES.map((category) => uncertainClaim(category));
  if (options.presentCategory) {
    const index = claims.findIndex((claim) => claim.category === options.presentCategory);
    claims[index] = {
      category: options.presentCategory,
      result: "present",
      summaryAr: "النص يذكر واقعة صريحة في هذا المحور.",
      sourceLocators: [options.locator ?? "P0001"],
      facts: [
        {
          severity: options.severity ?? 2,
          frequency: "unknown",
          context: "unknown",
          spoilerLevel: "contextual",
          summaryAr: "واقعة مستخرجة باختصار من النص المرفق.",
          sourceLocator: options.locator ?? "P0001",
          flags: [],
        },
      ],
    } as (typeof claims)[number];
  }
  return claims;
}

class FakeAi implements WorkersAiRunner {
  calls: Array<{ model: string; input: Record<string, unknown> }> = [];

  constructor(private readonly responses: unknown[]) {}

  async run(model: string, input: Record<string, unknown>): Promise<unknown> {
    this.calls.push({ model, input });
    const response = this.responses[this.calls.length - 1];
    if (response === undefined) throw new Error("Unexpected extra AI call");
    return response;
  }
}

test("model-assisted extraction is schema-bound, positive-only and never fabricates runtime timestamps", async () => {
  const ai = new FakeAi([{ response: { claims: validClaims({ presentCategory: "violence" }) } }]);
  const extraction = await extractEvidenceWithWorkersAi({
    ai,
    source: SOURCE,
    articleText: "يصف النص مشهد مطاردة وعنف واضح.",
  });

  assert.equal(ai.calls.length, 1);
  assert.equal(ai.calls[0].model, WORKERS_AI_EVIDENCE_MODEL);
  const request = ai.calls[0].input;
  assert.deepEqual(
    (request.response_format as { type: string }).type,
    "json_schema",
  );
  assert.equal(request.temperature, 0);
  assert.equal(request.stream, false);
  assert.match(
    JSON.stringify(request.response_format),
    /\"enum\":\[\"present\",\"uncertain\"\]/,
  );
  assert.doesNotMatch(JSON.stringify(request.response_format), /\"present\",\"none\"/);

  const violence = extraction.assertions.find((item) => item.category === "violence");
  assert.equal(violence?.result, "present");
  assert.equal(violence?.extractionMethod, "model_assisted");
  assert.match(violence?.extractorVersion ?? "", /llama-3\.1-8b-instruct-fast/);
  assert.equal(extraction.facts.length, 1);
  assert.equal(extraction.facts[0].startSecond, null);
  assert.equal(extraction.facts[0].endSecond, null);
});

test("Wikipedia prose extraction alone cannot turn silence into complete coverage", async () => {
  const ai = new FakeAi([{ response: { claims: validClaims({ presentCategory: "violence" }) } }]);
  const extraction = await extractEvidenceWithWorkersAi({
    ai,
    source: SOURCE,
    articleText: "يذكر النص عنفًا فقط ولا يقدم وصفًا شاملًا لبقية محاور المحتوى.",
  });

  const assessment = assessEvidenceReview({
    versionId: SOURCE.versionId,
    sources: [SOURCE],
    assertions: extraction.assertions,
    facts: extraction.facts,
  });

  assert.equal(assessment.status, "insufficient_data");
  assert.equal(assessment.engineEligible, false);
  assert.equal(assessment.categoryCoverage.violence.status, "covered_present");
  assert.equal(assessment.categoryCoverage.sexualContent.status, "unknown");
  assert.ok(
    assessment.issues.some(
      (issue) => issue.code === "CATEGORY_NOT_COVERED" && issue.category === "sexualContent",
    ),
  );
});

test("model output attempting to assert none is rejected even if JSON mode is bypassed", async () => {
  const claims = validClaims();
  claims[0] = {
    ...claims[0],
    result: "none",
    sourceLocators: ["P0001"],
  } as (typeof claims)[number];
  const ai = new FakeAi([{ response: { claims } }]);

  await assert.rejects(
    () =>
      extractEvidenceWithWorkersAi({
        ai,
        source: SOURCE,
        articleText: "لا ينبغي أن يسمح parser للـAI بادعاء عدم الوجود.",
      }),
    /result is invalid/,
  );
});

test("model output cannot cite a locator that was not supplied in its chunk", async () => {
  const ai = new FakeAi([
    { response: { claims: validClaims({ presentCategory: "fear", locator: "P9999" }) } },
  ]);

  await assert.rejects(
    () =>
      extractEvidenceWithWorkersAi({
        ai,
        source: SOURCE,
        articleText: "فقرة واحدة فقط.",
      }),
    /unknown source locator/,
  );
});

test("duplicate or missing categories in model output fail closed", async () => {
  const duplicate = validClaims();
  duplicate[1] = { ...duplicate[1], category: duplicate[0].category };
  const duplicateAi = new FakeAi([{ response: { claims: duplicate } }]);
  await assert.rejects(
    () => extractEvidenceWithWorkersAi({ ai: duplicateAi, source: SOURCE, articleText: "فقرة." }),
    /duplicate categories/,
  );

  const missingAi = new FakeAi([{ response: { claims: validClaims().slice(0, 9) } }]);
  await assert.rejects(
    () => extractEvidenceWithWorkersAi({ ai: missingAi, source: SOURCE, articleText: "فقرة." }),
    /exactly one claim per category/,
  );
});

test("paragraph markers are deterministic and long evidence is chunked without silent truncation", () => {
  const paragraphs = markEvidenceParagraphs("الأولى.\n\nالثانية.\n\nالثالثة.");
  assert.deepEqual(
    paragraphs.map((item) => item.id),
    ["P0001", "P0002", "P0003"],
  );

  const longParagraphs = markEvidenceParagraphs(
    ["أ".repeat(Math.floor(WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS * 0.6)), "ب".repeat(Math.floor(WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS * 0.6))].join("\n\n"),
  );
  const chunks = chunkMarkedParagraphs(longParagraphs);
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks.flat().map((item) => item.id), ["P0001", "P0002"]);
});

test("extractor processes multiple chunks sequentially and preserves unique deterministic ids", async () => {
  const articleText = [
    "أ".repeat(Math.floor(WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS * 0.6)),
    "ب".repeat(Math.floor(WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS * 0.6)),
  ].join("\n\n");
  const ai = new FakeAi([
    { response: JSON.stringify({ claims: validClaims({ presentCategory: "fear", locator: "P0001" }) }) },
    { response: { claims: validClaims({ presentCategory: "violence", locator: "P0002" }) } },
  ]);

  const extraction = await extractEvidenceWithWorkersAi({ ai, source: SOURCE, articleText });
  assert.equal(extraction.chunkCount, 2);
  assert.equal(ai.calls.length, 2);
  assert.equal(new Set(extraction.assertions.map((item) => item.id)).size, extraction.assertions.length);
  assert.equal(new Set(extraction.facts.map((item) => item.id)).size, extraction.facts.length);
  assert.ok(extraction.facts.some((item) => item.category === "fear"));
  assert.ok(extraction.facts.some((item) => item.category === "violence"));
});
