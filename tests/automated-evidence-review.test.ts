import assert from "node:assert/strict";
import test from "node:test";

import { buildWikipediaEvidenceReviewCandidate } from "../lib/automated-evidence-review.ts";
import { CONTENT_CATEGORIES, type ContentCategory } from "../lib/review-engine/types.ts";
import type { WorkersAiRunner } from "../lib/workers-ai-evidence-extractor.ts";

function claimsWithOnePresent(category: ContentCategory) {
  return CONTENT_CATEGORIES.map((item) =>
    item === category
      ? {
          category: item,
          result: "present",
          summaryAr: "يوجد في النص دليل صريح على واقعة في هذا المحور.",
          sourceLocators: ["P0001"],
          facts: [
            {
              severity: 2,
              frequency: "unknown",
              context: "unknown",
              spoilerLevel: "contextual",
              summaryAr: "واقعة منظمة مستخرجة من المصدر من غير نسخ المراجعة.",
              sourceLocator: "P0001",
              flags: [],
            },
          ],
        }
      : {
          category: item,
          result: "uncertain",
          summaryAr: "هذا النص لا يحسم المحور صراحة.",
          sourceLocators: [],
          facts: [],
        },
  );
}

class FakeAi implements WorkersAiRunner {
  calls = 0;

  async run(): Promise<unknown> {
    this.calls += 1;
    return { response: { claims: claimsWithOnePresent("violence") } };
  }
}

const wikipediaPayload = {
  query: {
    pages: [
      {
        pageid: 555,
        ns: 0,
        title: "فيلم تجريبي",
        extract: "تذكر القصة مشهد مطاردة وعنف واضح من غير أن تقدم وصفًا شاملاً لبقية محاور المحتوى.",
        fullurl: "https://ar.wikipedia.org/wiki/Test",
        pageprops: {},
        revisions: [
          {
            revid: 123456789,
            timestamp: "2026-08-12T12:00:00Z",
          },
        ],
      },
    ],
  },
};

test("Wikipedia plus Workers AI produces an evidence candidate but never self-publishes", async () => {
  const ai = new FakeAi();
  const fetchImpl = (async () =>
    new Response(JSON.stringify(wikipediaPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  const candidate = await buildWikipediaEvidenceReviewCandidate({
    versionId: "version-candidate-test",
    language: "ar",
    wikipediaTitle: "فيلم تجريبي",
    ai,
    fetchImpl,
    now: () => new Date("2026-08-13T06:00:00Z"),
  });

  assert.equal(ai.calls, 1);
  assert.equal(candidate.publishable, false);
  assert.equal(candidate.source.sourceKey, "wikipedia");
  assert.equal(candidate.source.sourceRevision, "123456789");
  assert.equal(
    candidate.source.policySnapshotId,
    "source-policy:wikipedia:2026-08-13.1:analysis_evidence",
  );
  assert.equal(candidate.assessment.status, "insufficient_data");
  assert.equal(candidate.assessment.engineEligible, false);
  assert.equal(candidate.assessment.categoryCoverage.violence.status, "covered_present");
  assert.equal(candidate.assessment.categoryCoverage.sexualContent.status, "unknown");
  assert.match(candidate.wikipedia.attributionText, /CC BY-SA 4\.0/);
});
