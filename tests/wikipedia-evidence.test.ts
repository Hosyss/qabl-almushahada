import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  WIKIPEDIA_EVIDENCE_LICENSE,
  WIKIPEDIA_EVIDENCE_LICENSE_URL,
  WIKIPEDIA_EVIDENCE_MAX_TEXT_LENGTH,
  WIKIPEDIA_EVIDENCE_USER_AGENT,
  buildWikipediaEvidenceUrl,
  fetchWikipediaEvidencePage,
  parseWikipediaEvidencePayload,
  prepareWikipediaEvidenceForVersion,
} from "../lib/wikipedia-evidence.ts";

const FIXTURE_TEXT = "Evidence text describing a fictional film scene without copying a review.";

function fixturePayload(overrides: Record<string, unknown> = {}) {
  return {
    batchcomplete: true,
    query: {
      pages: [
        {
          pageid: 123,
          ns: 0,
          title: "فيلم تجريبي",
          extract: FIXTURE_TEXT,
          fullurl: "https://ar.wikipedia.org/wiki/%D9%81%D9%8A%D9%84%D9%85_%D8%AA%D8%AC%D8%B1%D9%8A%D8%A8%D9%8A",
          pageprops: {},
          revisions: [
            {
              revid: 987654321,
              parentid: 987654320,
              timestamp: "2026-08-12T12:00:00Z",
            },
          ],
          ...overrides,
        },
      ],
    },
  };
}

test("Wikipedia evidence URL is bounded to Action API with redirects, revision metadata and maxlag", () => {
  const url = buildWikipediaEvidenceUrl({ language: "ar", title: "فيلم تجريبي" });
  assert.equal(url.origin, "https://ar.wikipedia.org");
  assert.equal(url.pathname, "/w/api.php");
  assert.equal(url.searchParams.get("action"), "query");
  assert.equal(url.searchParams.get("formatversion"), "2");
  assert.equal(url.searchParams.get("prop"), "extracts|revisions|info|pageprops");
  assert.equal(url.searchParams.get("redirects"), "1");
  assert.equal(url.searchParams.get("explaintext"), "1");
  assert.equal(url.searchParams.get("inprop"), "url");
  assert.equal(url.searchParams.get("rvprop"), "ids|timestamp");
  assert.equal(url.searchParams.get("maxlag"), "1");
  assert.equal(url.searchParams.get("titles"), "فيلم تجريبي");
  assert.throws(() => buildWikipediaEvidenceUrl({ language: "en", title: "x".repeat(201) }), /title/);
});

test("fetch contract sends a descriptive User-Agent and returns revision-bound attributed evidence", async () => {
  let requestedUrl: URL | null = null;
  let requestedInit: RequestInit | undefined;
  const fetchImpl = (async (input: URL | RequestInfo, init?: RequestInit) => {
    requestedUrl = input instanceof URL ? input : new URL(String(input));
    requestedInit = init;
    return new Response(JSON.stringify(fixturePayload()), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const page = await fetchWikipediaEvidencePage({
    language: "ar",
    title: "فيلم تجريبي",
    fetchImpl,
    now: () => new Date("2026-08-13T05:00:00Z"),
  });

  assert.equal(requestedUrl?.searchParams.get("maxlag"), "1");
  const headers = new Headers(requestedInit?.headers);
  assert.equal(headers.get("user-agent"), WIKIPEDIA_EVIDENCE_USER_AGENT);
  assert.equal(page.revisionId, "987654321");
  assert.equal(page.revisionTimestamp, "2026-08-12T12:00:00.000Z");
  assert.equal(page.retrievedAt, "2026-08-13T05:00:00.000Z");
  assert.equal(page.articleText, FIXTURE_TEXT);
  assert.equal(page.contentSha256, createHash("sha256").update(FIXTURE_TEXT).digest("hex"));
  assert.match(page.attributionText, /مساهمو Wikipedia/);
  assert.match(page.attributionText, /revision 987654321/);
  assert.match(page.attributionText, /CC BY-SA 4\.0/);
  assert.match(page.attributionText, /مصدر دليل لا كمراجعة جاهزة/);
  assert.match(page.attributionText, /استخلاص\/تعديل/);
});

test("Wikipedia API-level maxlag or other errors fail closed even with HTTP 200", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { code: "maxlag", info: "Waiting for replica" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;

  await assert.rejects(
    () => fetchWikipediaEvidencePage({ language: "en", title: "Example", fetchImpl }),
    /maxlag/,
  );
});

test("HTTP throttling exposes Retry-After without silently hammering the API", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response("too many requests", {
      status: 429,
      headers: { "retry-after": "10" },
    });
  }) as typeof fetch;

  await assert.rejects(
    () => fetchWikipediaEvidencePage({ language: "en", title: "Example", fetchImpl }),
    /429; retry-after=10/,
  );
  assert.equal(calls, 1, "single fetch helper must not retry aggressively by itself");
});

test("missing, disambiguation and non-main-namespace pages are rejected", async () => {
  await assert.rejects(
    () => parseWikipediaEvidencePayload(fixturePayload({ missing: true }), "ar", new Date()),
    /does not exist/,
  );
  await assert.rejects(
    () =>
      parseWikipediaEvidencePayload(
        fixturePayload({ pageprops: { disambiguation: "" } }),
        "ar",
        new Date(),
      ),
    /disambiguation/,
  );
  await assert.rejects(
    () => parseWikipediaEvidencePayload(fixturePayload({ ns: 1 }), "ar", new Date()),
    /main-namespace/,
  );
});

test("overlong article text is rejected rather than stored or truncated silently", async () => {
  await assert.rejects(
    () =>
      parseWikipediaEvidencePayload(
        fixturePayload({ extract: "x".repeat(WIKIPEDIA_EVIDENCE_MAX_TEXT_LENGTH + 1) }),
        "ar",
        new Date(),
      ),
    /extract has an invalid length/,
  );
});

test("prepared Wikipedia provenance pins exact revision, license, attribution and hash", async () => {
  const page = await parseWikipediaEvidencePayload(
    fixturePayload(),
    "ar",
    new Date("2026-08-13T05:00:00Z"),
  );
  const prepared = prepareWikipediaEvidenceForVersion({
    versionId: "version-wikipedia-test",
    page,
  });

  assert.equal(
    prepared.provenance.policySnapshotId,
    "source-policy:wikipedia:2026-08-13.1:analysis_evidence",
  );
  assert.equal(prepared.provenance.sourceRevision, "987654321");
  assert.equal(prepared.provenance.sourceLicense, WIKIPEDIA_EVIDENCE_LICENSE);
  assert.equal(prepared.provenance.licenseUrl, WIKIPEDIA_EVIDENCE_LICENSE_URL);
  assert.equal(prepared.provenance.contentSha256, page.contentSha256);
  assert.equal(prepared.provenance.attributionText, page.attributionText);
  assert.equal(prepared.provenance.ingestionMode, "automated");
});
