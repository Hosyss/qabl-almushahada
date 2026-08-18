import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("public report form keeps review target server-derived and inaccessible as user controls", async () => {
  const page = await source("app/review/page.tsx");
  const form = await source("app/review/public-report-form.tsx");

  assert.match(page, /targetKind="human_review" targetId=\{review\.bundleId\}/u);
  assert.match(page, /targetKind="evidence_publication" targetId=\{review\.publicationId\}/u);
  assert.match(page, /targetKind="editorial_publication" targetId=\{persisted\.review\.id\}/u);
  assert.equal((page.match(/<PublicReportForm /gu) ?? []).length, 3);

  assert.match(form, /JSON\.stringify\(\{ targetKind, targetId, reason, message, website \}\)/u);
  assert.doesNotMatch(form, /name="targetKind"|name="targetId"/u);
  assert.match(form, /name="website" type="text" tabIndex=\{-1\}/u);
  assert.match(form, /PUBLIC_REPORT_MESSAGE_MIN/u);
  assert.match(form, /PUBLIC_REPORT_MESSAGE_MAX/u);
});

test("public report form explains fail-closed correction semantics and handles API states", async () => {
  const form = await source("app/review/public-report-form.tsx");

  assert.match(form, /البلاغ لا يغيّر الحكم المنشور تلقائيًا؛ يُراجع أولًا ضمن دورة التصحيح/u);
  assert.match(form, /لا نطلب بريدًا إلكترونيًا أو حسابًا/u);
  assert.match(form, /response\.status === 202/u);
  assert.match(form, /response\.status === 429/u);
  assert.match(form, /response\.status === 503/u);
  assert.match(form, /role=\{status\.tone === "error" \? "alert" : "status"\}/u);

  for (const value of [
    "wrong_version",
    "missing_content",
    "incorrect_content",
    "source_issue",
    "spoiler",
    "other",
  ]) {
    assert.ok(form.includes(`value: "${value}"`), `Missing public report reason: ${value}`);
  }
});

test("public report UI copy uses clear Modern Standard Arabic", async () => {
  const form = await source("app/review/public-report-form.tsx");
  assert.doesNotMatch(form, /إيه|مش|دي|ده|بنـ|عايز|محتاجين|تاني/u);
});
