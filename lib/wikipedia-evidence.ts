import { prepareAnalysisEvidenceSourceProvenance } from "./source-provenance.ts";

export const WIKIPEDIA_EVIDENCE_USER_AGENT =
  "QablAlmushahadaBot/0.1 (+https://github.com/Hosyss/qabl-almushahada)";
export const WIKIPEDIA_EVIDENCE_MAX_TEXT_LENGTH = 120_000;
export const WIKIPEDIA_EVIDENCE_LICENSE = "CC BY-SA 4.0";
export const WIKIPEDIA_EVIDENCE_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

export type WikipediaEvidenceLanguage = "ar" | "en";

export interface WikipediaEvidencePage {
  language: WikipediaEvidenceLanguage;
  pageId: number;
  title: string;
  sourceUrl: string;
  revisionId: string;
  revisionTimestamp: string;
  retrievedAt: string;
  articleText: string;
  contentSha256: string;
  attributionText: string;
}

export interface WikipediaEvidenceWithProvenance {
  page: WikipediaEvidencePage;
  provenance: ReturnType<typeof prepareAnalysisEvidenceSourceProvenance>;
}

type WikipediaApiPage = {
  pageid?: unknown;
  ns?: unknown;
  title?: unknown;
  missing?: unknown;
  extract?: unknown;
  fullurl?: unknown;
  pageprops?: unknown;
  revisions?: unknown;
};

export function buildWikipediaEvidenceUrl(options: {
  language: WikipediaEvidenceLanguage;
  title: string;
}): URL {
  const title = boundedTitle(options.title);
  const url = new URL(`https://${options.language}.wikipedia.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "extracts|revisions|info|pageprops");
  url.searchParams.set("titles", title);
  url.searchParams.set("redirects", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("rvprop", "ids|timestamp");
  url.searchParams.set("maxlag", "1");
  return url;
}

export async function fetchWikipediaEvidencePage(options: {
  language: WikipediaEvidenceLanguage;
  title: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}): Promise<WikipediaEvidencePage> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const url = buildWikipediaEvidenceUrl(options);

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "User-Agent": WIKIPEDIA_EVIDENCE_USER_AGENT,
    },
  });

  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      `Wikipedia evidence request failed with ${response.status}${retryAfter ? `; retry-after=${retryAfter}` : ""}`,
    );
  }

  const payload: unknown = await response.json();
  if (isPlainObject(payload) && isPlainObject(payload.error)) {
    const code = typeof payload.error.code === "string" ? payload.error.code : "unknown";
    throw new Error(`Wikipedia API returned an error: ${code}`);
  }

  return parseWikipediaEvidencePayload(payload, options.language, now());
}

export async function parseWikipediaEvidencePayload(
  payload: unknown,
  language: WikipediaEvidenceLanguage,
  retrievedAt: Date,
): Promise<WikipediaEvidencePage> {
  if (!isPlainObject(payload) || !isPlainObject(payload.query) || !Array.isArray(payload.query.pages)) {
    throw new TypeError("Invalid Wikipedia Action API response");
  }
  if (payload.query.pages.length !== 1 || !isPlainObject(payload.query.pages[0])) {
    throw new TypeError("Wikipedia evidence request must resolve to exactly one article page");
  }

  const page = payload.query.pages[0] as WikipediaApiPage;
  if (page.missing === true || page.missing === "") {
    throw new Error("Wikipedia evidence page does not exist");
  }
  if (page.ns !== 0) {
    throw new Error("Wikipedia evidence must resolve to a main-namespace article");
  }
  if (isPlainObject(page.pageprops) && Object.hasOwn(page.pageprops, "disambiguation")) {
    throw new Error("Wikipedia disambiguation pages cannot be used as analysis evidence");
  }

  const pageId = positiveInteger(page.pageid, "pageid");
  const title = boundedText(page.title, "title", 1, 300);
  const articleText = boundedText(page.extract, "extract", 1, WIKIPEDIA_EVIDENCE_MAX_TEXT_LENGTH);
  const sourceUrl = requireWikipediaArticleUrl(page.fullurl, language);
  if (!Array.isArray(page.revisions) || page.revisions.length !== 1 || !isPlainObject(page.revisions[0])) {
    throw new TypeError("Wikipedia evidence response must contain exactly one current revision");
  }

  const revision = page.revisions[0];
  const revisionId = String(positiveInteger(revision.revid, "revid"));
  const revisionTimestamp = normalizeInstant(revision.timestamp, "revision timestamp");
  const retrievedAtIso = normalizeDate(retrievedAt, "retrievedAt");
  const contentSha256 = await sha256Hex(articleText);
  const attributionText = buildWikipediaAttribution({
    title,
    sourceUrl,
    revisionId,
  });

  return {
    language,
    pageId,
    title,
    sourceUrl,
    revisionId,
    revisionTimestamp,
    retrievedAt: retrievedAtIso,
    articleText,
    contentSha256,
    attributionText,
  };
}

export function prepareWikipediaEvidenceForVersion(options: {
  versionId: string;
  page: WikipediaEvidencePage;
}): WikipediaEvidenceWithProvenance {
  const provenanceId = `evidence:wikipedia:${options.page.language}:${options.page.pageId}:${options.page.revisionId}`;
  const provenance = prepareAnalysisEvidenceSourceProvenance({
    id: provenanceId,
    versionId: options.versionId,
    source: "wikipedia",
    sourceUrl: options.page.sourceUrl,
    sourceRevision: options.page.revisionId,
    sourceLicense: WIKIPEDIA_EVIDENCE_LICENSE,
    licenseUrl: WIKIPEDIA_EVIDENCE_LICENSE_URL,
    attributionText: options.page.attributionText,
    retrievedAt: options.page.retrievedAt,
    contentSha256: options.page.contentSha256,
    ingestionMode: "automated",
  });
  return { page: options.page, provenance };
}

export function buildWikipediaAttribution(options: {
  title: string;
  sourceUrl: string;
  revisionId: string;
}): string {
  return `مساهمو Wikipedia، «${options.title}»، ${options.sourceUrl}، revision ${options.revisionId}، مرخصة CC BY-SA 4.0 (${WIKIPEDIA_EVIDENCE_LICENSE_URL}). استُخدمت الصفحة كمصدر دليل لا كمراجعة جاهزة، وتم استخلاص/تعديل الوقائع وصياغتها وفق منهج «قبل المشاهدة».`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value as number;
}

function boundedTitle(value: string): string {
  return boundedText(value, "title", 1, 200);
}

function boundedText(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || normalized.includes("\u0000")) {
    throw new TypeError(`${label} has an invalid length or contains NUL`);
  }
  return normalized;
}

function requireWikipediaArticleUrl(value: unknown, language: WikipediaEvidenceLanguage): string {
  const urlText = boundedText(value, "fullurl", 8, 2048);
  const url = new URL(urlText);
  if (
    url.protocol !== "https:" ||
    url.hostname !== `${language}.wikipedia.org` ||
    !url.pathname.startsWith("/wiki/") ||
    url.username ||
    url.password
  ) {
    throw new TypeError("Wikipedia fullurl must be an HTTPS article URL on the requested wiki");
  }
  return url.toString();
}

function normalizeInstant(value: unknown, label: string): string {
  const text = boundedText(value, label, 20, 40);
  const parsed = new Date(text);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${label} must be a valid instant`);
  return parsed.toISOString();
}

function normalizeDate(value: Date, label: string): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new TypeError(`${label} must be a valid Date`);
  }
  return value.toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
