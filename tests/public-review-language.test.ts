import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("human and evidence public review views keep the retired colloquial copy out", async () => {
  const human = await source("app/review/review-client.tsx");
  const evidence = await source("app/review/evidence-review-client.tsx");
  const publicCopy = `${human}\n${evidence}`;

  for (const retired of [
    "قرار أهدى لكل بيت",
    "النسخة دي",
    "إيه اللي موجود فعلًا؟",
    "إيه اللي تثبته الأدلة؟",
    "إزاي البيانات وصلت للنشر؟",
    "إزاي المراجعة دي وصلت للنشر؟",
    "الاعتماد مش رقم غامض",
    "لو المعلومة ما بقتش حالية",
    "بنحافظ على الفرق",
    "إيه اللي نعرفه؟",
    "ابحث عن عنوان تاني",
    "من غير حرق",
  ]) {
    assert.ok(!publicCopy.includes(retired), `Retired colloquial public copy returned: ${retired}`);
  }
});

test("evidence review does not expose retired implementation jargon in visible copy", async () => {
  const evidence = await source("app/review/evidence-review-client.tsx");
  for (const retired of [
    "claim منشورة",
    "analysis evidence",
    "Coverage وتعارض",
    "Snapshot غير قابلة للمحو",
    "evidence-based",
    "reviewer وهميًا",
    "مصدر evidence",
    "ShareAlike",
  ]) {
    assert.ok(!evidence.includes(retired), `Retired public implementation jargon returned: ${retired}`);
  }
});
