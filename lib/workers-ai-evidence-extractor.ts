import {
  CONTENT_CATEGORIES,
  CONTENT_FLAGS,
  type ContentCategory,
  type ContentFlag,
} from "./review-engine/types.ts";
import {
  CONTENT_FLAG_EXTRACTION_GUIDANCE_AR,
  isContentFlagAllowedForCategory,
} from "./review-engine/content-taxonomy.ts";
import type {
  EvidenceCategoryAssertion,
  EvidenceFact,
  EvidenceSourceRef,
} from "./evidence-review.ts";

export const WORKERS_AI_EVIDENCE_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
export const WORKERS_AI_EVIDENCE_EXTRACTOR_VERSION =
  "workers-ai-evidence:llama-3.1-8b-instruct-fast:2026-08-13.2";
export const WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS = 36_000;
export const WORKERS_AI_EVIDENCE_MAX_CHUNKS = 4;

export interface WorkersAiRunner {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface ModelEvidenceExtraction {
  assertions: EvidenceCategoryAssertion[];
  facts: EvidenceFact[];
  chunkCount: number;
  model: string;
  extractorVersion: string;
}

type MarkedParagraph = {
  id: string;
  text: string;
};

type ModelFact = {
  severity: number;
  frequency: string;
  context: string;
  spoilerLevel: string;
  summaryAr: string;
  sourceLocator: string;
  flags: unknown[];
};

type ModelClaim = {
  category: string;
  result: string;
  summaryAr: string;
  sourceLocators: unknown[];
  facts: unknown[];
};

const FREQUENCIES = ["single", "repeated", "sustained", "unknown"] as const;
const CONTEXTS = ["comic", "neutral", "educational", "threatening", "distressing", "unknown"] as const;
const SPOILER_LEVELS = ["none", "contextual", "major"] as const;

export const WORKERS_AI_EVIDENCE_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    claims: {
      type: "array",
      minItems: CONTENT_CATEGORIES.length,
      maxItems: CONTENT_CATEGORIES.length,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: [...CONTENT_CATEGORIES] },
          // Automated prose extraction is intentionally not allowed to assert `none`.
          // Silence or lack of mention must stay uncertain. Explicit negative coverage can
          // come later from a source whose contract is actually exhaustive.
          result: { type: "string", enum: ["present", "uncertain"] },
          summaryAr: { type: "string", minLength: 1, maxLength: 500 },
          sourceLocators: {
            type: "array",
            maxItems: 8,
            items: { type: "string", pattern: "^P[0-9]{4}$" },
          },
          facts: {
            type: "array",
            maxItems: 12,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                severity: { type: "integer", minimum: 1, maximum: 4 },
                frequency: { type: "string", enum: [...FREQUENCIES] },
                context: { type: "string", enum: [...CONTEXTS] },
                spoilerLevel: { type: "string", enum: [...SPOILER_LEVELS] },
                summaryAr: { type: "string", minLength: 1, maxLength: 500 },
                sourceLocator: { type: "string", pattern: "^P[0-9]{4}$" },
                flags: {
                  type: "array",
                  uniqueItems: true,
                  maxItems: CONTENT_FLAGS.length,
                  items: { type: "string", enum: [...CONTENT_FLAGS] },
                },
              },
              required: [
                "severity",
                "frequency",
                "context",
                "spoilerLevel",
                "summaryAr",
                "sourceLocator",
                "flags",
              ],
            },
          },
        },
        required: ["category", "result", "summaryAr", "sourceLocators", "facts"],
      },
    },
  },
  required: ["claims"],
} as const;

export async function extractEvidenceWithWorkersAi(options: {
  ai: WorkersAiRunner;
  source: EvidenceSourceRef;
  articleText: string;
}): Promise<ModelEvidenceExtraction> {
  validateSource(options.source);
  const paragraphs = markEvidenceParagraphs(options.articleText);
  const chunks = chunkMarkedParagraphs(paragraphs);

  const assertions: EvidenceCategoryAssertion[] = [];
  const facts: EvidenceFact[] = [];

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const chunkTraceLocator = buildChunkTraceLocator(chunk);
    const allowedLocators = new Set(chunk.map((paragraph) => paragraph.id));
    const rawResponse = await options.ai.run(WORKERS_AI_EVIDENCE_MODEL, {
      messages: [
        {
          role: "system",
          content: buildWorkersAiEvidenceSystemPrompt(),
        },
        {
          role: "user",
          content: buildUserPrompt(chunk),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: WORKERS_AI_EVIDENCE_RESPONSE_SCHEMA,
      },
      temperature: 0,
      seed: 13082026 + chunkIndex,
      max_tokens: 4096,
      stream: false,
    });

    const claims = parseModelClaims(rawResponse, allowedLocators);
    const sourceToken = options.source.contentSha256.slice(0, 16);

    for (const claim of claims) {
      const assertionId = `ai:${sourceToken}:${String(chunkIndex + 1).padStart(2, "0")}:${claim.category}`;
      assertions.push({
        id: assertionId,
        evidenceSourceId: options.source.id,
        category: claim.category,
        result: claim.result,
        extractionMethod: "model_assisted",
        extractorVersion: WORKERS_AI_EVIDENCE_EXTRACTOR_VERSION,
        sourceLocator:
          claim.result === "uncertain" ? chunkTraceLocator : claim.sourceLocators.join(","),
        summaryAr: claim.summaryAr,
      });

      claim.facts.forEach((fact, factIndex) => {
        facts.push({
          id: `aif:${sourceToken}:${String(chunkIndex + 1).padStart(2, "0")}:${claim.category}:${String(factIndex + 1).padStart(2, "0")}`,
          assertionId,
          category: claim.category,
          severity: fact.severity as 1 | 2 | 3 | 4,
          frequency: fact.frequency as EvidenceFact["frequency"],
          context: fact.context as EvidenceFact["context"],
          spoilerLevel: fact.spoilerLevel as EvidenceFact["spoilerLevel"],
          summaryAr: fact.summaryAr,
          // Wikipedia prose does not provide runtime timestamps. Never fabricate them.
          startSecond: null,
          endSecond: null,
          flags: fact.flags as ContentFlag[],
        });
      });
    }
  }

  return {
    assertions,
    facts,
    chunkCount: chunks.length,
    model: WORKERS_AI_EVIDENCE_MODEL,
    extractorVersion: WORKERS_AI_EVIDENCE_EXTRACTOR_VERSION,
  };
}

export function markEvidenceParagraphs(articleText: string): MarkedParagraph[] {
  if (typeof articleText !== "string" || articleText.includes("\u0000")) {
    throw new TypeError("articleText must be a valid string without NUL");
  }

  const paragraphs = articleText
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.replace(/\s+/gu, " ").trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    throw new TypeError("articleText contains no usable evidence paragraphs");
  }
  if (paragraphs.length > 9999) {
    throw new RangeError("articleText contains too many evidence paragraphs");
  }

  return paragraphs.map((text, index) => ({
    id: `P${String(index + 1).padStart(4, "0")}`,
    text,
  }));
}

export function chunkMarkedParagraphs(paragraphs: readonly MarkedParagraph[]): MarkedParagraph[][] {
  if (paragraphs.length === 0) throw new TypeError("At least one marked paragraph is required");

  const chunks: MarkedParagraph[][] = [];
  let current: MarkedParagraph[] = [];
  let currentChars = 0;

  for (const paragraph of paragraphs) {
    const renderedChars = paragraph.id.length + paragraph.text.length + 2;
    if (renderedChars > WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS) {
      throw new RangeError(`Evidence paragraph ${paragraph.id} is too large for safe model extraction`);
    }

    if (current.length > 0 && currentChars + renderedChars > WORKERS_AI_EVIDENCE_CHUNK_MAX_CHARS) {
      chunks.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(paragraph);
    currentChars += renderedChars;
  }

  if (current.length > 0) chunks.push(current);
  if (chunks.length > WORKERS_AI_EVIDENCE_MAX_CHUNKS) {
    throw new RangeError(
      `Evidence requires ${chunks.length} model chunks; maximum is ${WORKERS_AI_EVIDENCE_MAX_CHUNKS}. Refusing silent truncation.`,
    );
  }

  return chunks;
}

function buildChunkTraceLocator(chunk: readonly MarkedParagraph[]): string {
  const first = chunk[0]?.id;
  const last = chunk.at(-1)?.id;
  if (!first || !last) {
    throw new TypeError("Evidence chunk must contain at least one marked paragraph");
  }
  return `chunk:${first}-${last}`;
}

export function buildWorkersAiEvidenceSystemPrompt(): string {
  return `أنت طبقة استخراج أدلة غير موثوقة داخل «قبل المشاهدة». مهمتك ليست إصدار قرار مشاهدة ولا تقييم عمري ولا مراجعة أدبية. استخرج فقط ما يقوله النص المرفق بوضوح عن محتوى العمل.

قواعد إلزامية:
1. لا تخترع أي حدث أو شدة أو سياق غير مدعوم بالنص.
2. النتيجة المتاحة لكل محور هي present أو uncertain فقط. لا تقل none إطلاقًا؛ غياب الذكر ليس دليلًا على عدم الوجود.
3. present يتطلب واقعة واحدة على الأقل وsourceLocator يشير إلى فقرة P#### تدعمها فعلًا.
4. uncertain يعني أن هذا الجزء من النص لا يقدم دليلًا صريحًا كافيًا للمحور، ويجب أن تكون facts فارغة.
5. لا تستخدم أي age rating أجنبي كبديل عن وصف الواقعة.
6. لا تقل إن إنسانًا من فريق «قبل المشاهدة» شاهد العمل.
7. اكتب summaryAr عربية أصلية قصيرة ولا تنسخ جملًا طويلة من المصدر.
8. لا تخترع توقيتًا داخل الفيلم؛ التوقيت لا يطلب منك أصلًا.
9. الشدة 1–4 تصف قوة الواقعة المذكورة فقط، لا مدى ملاءمتها أخلاقيًا ولا قرار الأسرة.
10. أخرج كل المحاور العشرة مرة واحدة بالضبط، حتى لو كانت uncertain.
11. flags أوصاف موضوعية فرعية وليست أحكامًا. لا تستخدم flag إلا إذا كانت الواقعة نفسها تثبتها، والتزم بالمحور المسموح لكل flag. marker الديني يصف وجود مرجع/رمز/ممارسة فقط ولا يعني بذاته إساءة أو حساسية.

تعريفات flags:
${CONTENT_FLAG_EXTRACTION_GUIDANCE_AR}`;
}

function buildUserPrompt(chunk: readonly MarkedParagraph[]): string {
  const rendered = chunk.map((paragraph) => `[${paragraph.id}] ${paragraph.text}`).join("\n\n");
  return `حلل فقط الفقرات التالية بوصفها دليلًا مرخصًا. استخدم معرفات P#### كـsourceLocator ولا تقتبس فقرات كاملة في الخرج.\n\n${rendered}`;
}

function parseModelClaims(rawResponse: unknown, allowedLocators: ReadonlySet<string>): ParsedClaim[] {
  const payload = unwrapWorkersAiResponse(rawResponse);
  if (!isPlainObject(payload) || !Array.isArray(payload.claims)) {
    throw new TypeError("Workers AI evidence response must contain a claims array");
  }
  if (payload.claims.length !== CONTENT_CATEGORIES.length) {
    throw new TypeError("Workers AI evidence response must contain exactly one claim per category");
  }

  const parsed = payload.claims.map((rawClaim) => parseClaim(rawClaim, allowedLocators));
  const categories = parsed.map((claim) => claim.category);
  if (new Set(categories).size !== CONTENT_CATEGORIES.length) {
    throw new TypeError("Workers AI evidence response contains duplicate categories");
  }
  for (const category of CONTENT_CATEGORIES) {
    if (!categories.includes(category)) {
      throw new TypeError(`Workers AI evidence response is missing category: ${category}`);
    }
  }
  return parsed;
}

type ParsedFact = ModelFact & { flags: ContentFlag[] };
type ParsedClaim = Omit<ModelClaim, "category" | "sourceLocators" | "facts"> & {
  category: ContentCategory;
  result: "present" | "uncertain";
  sourceLocators: string[];
  facts: ParsedFact[];
};

function parseClaim(raw: unknown, allowedLocators: ReadonlySet<string>): ParsedClaim {
  if (!isPlainObject(raw) || !hasExactKeys(raw, ["category", "result", "summaryAr", "sourceLocators", "facts"])) {
    throw new TypeError("Workers AI claim shape is invalid");
  }

  const category = enumValue(raw.category, CONTENT_CATEGORIES, "category");
  const result = enumValue(raw.result, ["present", "uncertain"] as const, "result");
  const summaryAr = boundedText(raw.summaryAr, "summaryAr", 1, 500);
  const sourceLocators = locatorArray(raw.sourceLocators, allowedLocators, 8);
  if (!Array.isArray(raw.facts) || raw.facts.length > 12) {
    throw new TypeError("Workers AI facts must be a bounded array");
  }
  const facts = raw.facts.map((fact) => parseFact(fact, allowedLocators, category));

  if (result === "present" && (sourceLocators.length === 0 || facts.length === 0)) {
    throw new TypeError("A present model claim requires locators and at least one structured fact");
  }
  if (result === "uncertain" && facts.length > 0) {
    throw new TypeError("An uncertain model claim cannot carry structured facts");
  }

  return { category, result, summaryAr, sourceLocators, facts };
}

function parseFact(
  raw: unknown,
  allowedLocators: ReadonlySet<string>,
  category: ContentCategory,
): ParsedFact {
  if (
    !isPlainObject(raw) ||
    !hasExactKeys(raw, [
      "severity",
      "frequency",
      "context",
      "spoilerLevel",
      "summaryAr",
      "sourceLocator",
      "flags",
    ])
  ) {
    throw new TypeError("Workers AI fact shape is invalid");
  }

  const severity = raw.severity;
  if (!Number.isInteger(severity) || (severity as number) < 1 || (severity as number) > 4) {
    throw new TypeError("Workers AI fact severity must be an integer from 1 to 4");
  }

  const frequency = enumValue(raw.frequency, FREQUENCIES, "frequency");
  const context = enumValue(raw.context, CONTEXTS, "context");
  const spoilerLevel = enumValue(raw.spoilerLevel, SPOILER_LEVELS, "spoilerLevel");
  const summaryAr = boundedText(raw.summaryAr, "fact summaryAr", 1, 500);
  const sourceLocator = boundedText(raw.sourceLocator, "sourceLocator", 5, 5);
  if (!allowedLocators.has(sourceLocator)) {
    throw new TypeError(`Workers AI fact references an unknown source locator: ${sourceLocator}`);
  }

  if (!Array.isArray(raw.flags) || raw.flags.length > CONTENT_FLAGS.length) {
    throw new TypeError("Workers AI flags must be a bounded array");
  }
  const flags = raw.flags.map((flag) => enumValue(flag, CONTENT_FLAGS, "flag"));
  if (new Set(flags).size !== flags.length) {
    throw new TypeError("Workers AI fact contains duplicate flags");
  }
  const incompatibleFlag = flags.find((flag) => !isContentFlagAllowedForCategory(flag, category));
  if (incompatibleFlag) {
    throw new TypeError(`Workers AI flag ${incompatibleFlag} is incompatible with category ${category}`);
  }

  return {
    severity: severity as number,
    frequency,
    context,
    spoilerLevel,
    summaryAr,
    sourceLocator,
    flags,
  };
}

function unwrapWorkersAiResponse(rawResponse: unknown): unknown {
  if (!isPlainObject(rawResponse) || !("response" in rawResponse)) {
    throw new TypeError("Workers AI response envelope is invalid");
  }
  const response = rawResponse.response;
  if (typeof response === "string") {
    try {
      return JSON.parse(response) as unknown;
    } catch {
      throw new TypeError("Workers AI returned non-JSON response text");
    }
  }
  return response;
}

function locatorArray(
  value: unknown,
  allowedLocators: ReadonlySet<string>,
  maximum: number,
): string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new TypeError("sourceLocators must be a bounded array");
  }
  const locators = value.map((item) => boundedText(item, "sourceLocator", 5, 5));
  if (new Set(locators).size !== locators.length) {
    throw new TypeError("sourceLocators contains duplicates");
  }
  for (const locator of locators) {
    if (!allowedLocators.has(locator)) {
      throw new TypeError(`Workers AI claim references an unknown source locator: ${locator}`);
    }
  }
  return locators;
}

function validateSource(source: EvidenceSourceRef): void {
  if (
    !source ||
    !boundedBoolean(source.id, 1, 160) ||
    !boundedBoolean(source.versionId, 1, 160) ||
    !boundedBoolean(source.policySnapshotId, 1, 220) ||
    !boundedBoolean(source.sourceKey, 1, 80) ||
    !isHttpsUrl(source.sourceUrl) ||
    !/^[0-9a-f]{64}$/u.test(source.contentSha256)
  ) {
    throw new TypeError("Evidence source identity is invalid for model extraction");
  }
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new TypeError(`Workers AI ${label} is invalid`);
  }
  return value as T[number];
}

function boundedText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || normalized.includes("\u0000")) {
    throw new TypeError(`${label} has an invalid length or contains NUL`);
  }
  return normalized;
}

function boundedBoolean(value: unknown, min: number, max: number): boolean {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max;
}

function hasExactKeys(value: Record<string, unknown>, requiredKeys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...requiredKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
