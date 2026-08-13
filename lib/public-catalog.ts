export const PUBLIC_SITE_ORIGIN = "https://qabl-almushahada.buildtools.workers.dev";

export type PublicCatalogKind = "movie" | "series";

export interface PublicCatalogTitle {
  titleId: string;
  qid: string;
  canonicalName: string;
  originalName: string | null;
  kind: PublicCatalogKind;
  releaseYear: number;
  sourceUrl: string;
  sourceLicense: "CC0 1.0";
  policyVersion: string;
  retrievedAt: string;
}

export function parsePublicCatalogQid(input: unknown): string {
  if (typeof input !== "string") throw new TypeError("Catalog QID must be a string");
  const normalized = input.trim();
  if (!/^Q[1-9]\d{0,19}$/u.test(normalized)) {
    throw new TypeError("Catalog QID must be a bounded Wikidata QID");
  }
  return normalized;
}

export function publicCatalogTitleIdFromQid(qid: string): string {
  return `wd:${parsePublicCatalogQid(qid)}`;
}

export function publicCatalogQidFromTitleId(titleId: string): string | null {
  if (typeof titleId !== "string") return null;
  const match = titleId.match(/^wd:(Q[1-9]\d{0,19})$/u);
  return match?.[1] ?? null;
}

export function buildPublicCatalogTitleHref(titleId: string): string | null {
  const qid = publicCatalogQidFromTitleId(titleId);
  return qid ? `/title/${qid}` : null;
}

export function buildPublicCatalogCanonicalUrl(qid: string): string {
  return `${PUBLIC_SITE_ORIGIN}/title/${parsePublicCatalogQid(qid)}`;
}

export function buildPublicCatalogDescription(title: Pick<PublicCatalogTitle, "canonicalName" | "kind" | "releaseYear">): string {
  const kind = title.kind === "movie" ? "فيلم" : "مسلسل";
  return `${title.canonicalName} — ${kind} من ${title.releaseYear}. صفحة كتالوج تعريفية من بيانات Wikidata المرخصة CC0؛ لا تعني وجود مراجعة ملاءمة منشورة.`;
}
