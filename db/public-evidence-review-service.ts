import { env } from "cloudflare:workers";

import {
  buildPublicEvidenceReviewView,
  parsePublicEvidenceReviewLocator,
  type PublicEvidenceReviewMetadata,
  type PublicEvidenceReviewSource,
  type PublicEvidenceReviewView,
} from "@/lib/public-evidence-review";
import type {
  EvidenceCategoryAssertion,
  EvidenceFact,
  EvidenceSourceRef,
} from "@/lib/evidence-review";
import {
  buildPublicEvidenceReviewGateQuery,
  type PublicEvidenceReviewGateExpectation,
} from "./public-evidence-review-query";

interface GateRow {
  publicationId: string;
  headRevision: number;
  publicationRevision: number;
  reviewMethod: string;
  humanWatchConfirmed: number;
  publicationGateVersion: string;
  publishedAt: string;
  titleId: string;
  canonicalName: string;
  originalName: string | null;
  kind: string;
  releaseYear: number;
  versionId: string;
  editionLabel: string;
  platform: string;
  language: string;
  runtimeSeconds: number;
}

interface SourceRow {
  id: string;
  versionId: string;
  policySnapshotId: string;
  sourceKey: string;
  sourceUrl: string;
  sourceRevision: string | null;
  sourceLicense: string;
  licenseUrl: string;
  attributionText: string | null;
  retrievedAt: string;
  contentSha256: string;
  ingestionMode: string;
  policyUseScope: string;
  policyLicenseLabel: string;
  policyLicenseUrl: string;
  attributionRequired: number;
  shareAlike: number;
  automatedIngestionAllowed: number;
  commercialUseAllowed: number;
}

interface AssertionRow {
  id: string;
  evidenceSourceId: string;
  category: string;
  result: string;
  extractionMethod: string;
  extractorVersion: string;
  sourceLocator: string;
  summaryAr: string;
}

interface FactRow {
  id: string;
  assertionId: string;
  category: string;
  severity: number;
  frequency: string;
  context: string;
  spoilerLevel: string;
  summaryAr: string;
  startSecond: number | null;
  endSecond: number | null;
}

interface FlagRow {
  factId: string;
  flag: string;
}

interface GateSnapshot {
  expectation: PublicEvidenceReviewGateExpectation;
  metadata: PublicEvidenceReviewMetadata;
}

export async function loadPublicEvidenceReview(input: unknown): Promise<PublicEvidenceReviewView | null> {
  const { publicationId } = parsePublicEvidenceReviewLocator(input);
  const initialGate = await loadGate(publicationId);
  if (!initialGate) return null;

  const hydrated = await loadSnapshot(publicationId, initialGate.metadata.versionId);
  if (!hydrated) return null;

  const finalGate = await loadGate(publicationId, initialGate.expectation);
  if (!finalGate) return null;

  return buildPublicEvidenceReviewView({
    metadata: finalGate.metadata,
    sources: hydrated.publicSources,
    evidenceSources: hydrated.evidenceSources,
    assertions: hydrated.assertions,
    facts: hydrated.facts,
  });
}

async function loadGate(
  publicationId: string,
  expectation?: PublicEvidenceReviewGateExpectation,
): Promise<GateSnapshot | null> {
  const query = buildPublicEvidenceReviewGateQuery(publicationId, expectation);
  const result = await requireD1()
    .prepare(query.sql)
    .bind(...query.bindings)
    .all<GateRow>();
  const row = result.results?.[0];
  return row ? parseGateRow(row) : null;
}

async function loadSnapshot(publicationId: string, versionId: string) {
  const db = requireD1();
  const [sourceResult, assertionResult, factResult, flagResult] = await Promise.all([
    db.prepare(
      `SELECT
         source.id AS id,
         source.version_id AS versionId,
         source.policy_snapshot_id AS policySnapshotId,
         policy.source_key AS sourceKey,
         source.source_url AS sourceUrl,
         source.source_revision AS sourceRevision,
         source.source_license AS sourceLicense,
         source.license_url AS licenseUrl,
         source.attribution_text AS attributionText,
         source.retrieved_at AS retrievedAt,
         source.content_sha256 AS contentSha256,
         source.ingestion_mode AS ingestionMode,
         policy.use_scope AS policyUseScope,
         policy.license_label AS policyLicenseLabel,
         policy.license_url AS policyLicenseUrl,
         policy.attribution_required AS attributionRequired,
         policy.share_alike AS shareAlike,
         policy.automated_ingestion_allowed AS automatedIngestionAllowed,
         policy.commercial_use_allowed AS commercialUseAllowed
       FROM evidence_publication_sources link
       INNER JOIN version_evidence_sources source ON source.id = link.evidence_source_id
       INNER JOIN content_source_policy_snapshots policy ON policy.id = source.policy_snapshot_id
       WHERE link.publication_id = ?
       ORDER BY source.id`,
    ).bind(publicationId).all<SourceRow>(),
    db.prepare(
      `SELECT
         id,
         evidence_source_id AS evidenceSourceId,
         category,
         result,
         extraction_method AS extractionMethod,
         extractor_version AS extractorVersion,
         source_locator AS sourceLocator,
         summary_ar AS summaryAr
       FROM evidence_publication_assertions
       WHERE publication_id = ?
       ORDER BY evidence_source_id, category, id`,
    ).bind(publicationId).all<AssertionRow>(),
    db.prepare(
      `SELECT
         id,
         assertion_id AS assertionId,
         category,
         severity,
         frequency,
         context,
         spoiler_level AS spoilerLevel,
         summary_ar AS summaryAr,
         start_second AS startSecond,
         end_second AS endSecond
       FROM evidence_publication_facts
       WHERE publication_id = ?
       ORDER BY category, severity DESC, id`,
    ).bind(publicationId).all<FactRow>(),
    db.prepare(
      `SELECT flag.fact_id AS factId, flag.flag AS flag
       FROM evidence_publication_fact_flags flag
       INNER JOIN evidence_publication_facts fact ON fact.id = flag.fact_id
       WHERE fact.publication_id = ?
       ORDER BY flag.fact_id, flag.flag`,
    ).bind(publicationId).all<FlagRow>(),
  ]);

  const sourceRows = sourceResult.results ?? [];
  const assertionRows = assertionResult.results ?? [];
  const factRows = factResult.results ?? [];
  const flagRows = flagResult.results ?? [];
  if (sourceRows.length === 0 || assertionRows.length === 0) return null;

  const evidenceSources: EvidenceSourceRef[] = [];
  const publicSources: PublicEvidenceReviewSource[] = [];
  for (const row of sourceRows) {
    const parsed = parseSourceRow(row, versionId);
    if (!parsed) return null;
    evidenceSources.push(parsed.evidence);
    publicSources.push(parsed.publicSource);
  }

  const assertions: EvidenceCategoryAssertion[] = [];
  for (const row of assertionRows) {
    const assertion = parseAssertionRow(row);
    if (!assertion) return null;
    assertions.push(assertion);
  }

  const flagsByFact = new Map<string, string[]>();
  for (const row of flagRows) {
    if (!isNonEmptyString(row.factId) || !isContentFlag(row.flag)) return null;
    const current = flagsByFact.get(row.factId) ?? [];
    if (current.includes(row.flag)) return null;
    current.push(row.flag);
    flagsByFact.set(row.factId, current);
  }

  const facts: EvidenceFact[] = [];
  for (const row of factRows) {
    const fact = parseFactRow(row, flagsByFact.get(row.id) ?? []);
    if (!fact) return null;
    facts.push(fact);
  }

  if ([...flagsByFact.keys()].some((factId) => !facts.some((fact) => fact.id === factId))) return null;
  return { evidenceSources, publicSources, assertions, facts };
}

function parseGateRow(row: GateRow): GateSnapshot | null {
  if (!isNonEmptyString(row.publicationId) || !isNonEmptyString(row.versionId)) return null;
  if (!Number.isInteger(row.headRevision) || row.headRevision < 1) return null;
  if (!Number.isInteger(row.publicationRevision) || row.publicationRevision < 1) return null;
  if (row.headRevision !== row.publicationRevision) return null;
  if (row.reviewMethod !== "evidence_based" || row.humanWatchConfirmed !== 0) return null;
  if (!isNonEmptyString(row.publicationGateVersion) || !isValidDate(row.publishedAt)) return null;
  if (!isNonEmptyString(row.titleId) || !isNonEmptyString(row.canonicalName)) return null;
  if (row.originalName !== null && !isNonEmptyString(row.originalName)) return null;
  if (!isTitleKind(row.kind)) return null;
  if (!Number.isInteger(row.releaseYear) || row.releaseYear < 1880 || row.releaseYear > 2200) return null;
  if (!isNonEmptyString(row.editionLabel) || !isNonEmptyString(row.platform) || !isNonEmptyString(row.language)) return null;
  if (!Number.isInteger(row.runtimeSeconds) || row.runtimeSeconds <= 0) return null;

  return {
    expectation: {
      headRevision: row.headRevision,
      publicationRevision: row.publicationRevision,
    },
    metadata: {
      publicationId: row.publicationId,
      headRevision: row.headRevision,
      publicationRevision: row.publicationRevision,
      reviewMethod: "evidence_based",
      humanWatchConfirmed: false,
      publicationGateVersion: row.publicationGateVersion.trim(),
      publishedAt: row.publishedAt,
      titleId: row.titleId,
      canonicalName: row.canonicalName.trim(),
      originalName: row.originalName?.trim() ?? null,
      kind: row.kind,
      releaseYear: row.releaseYear,
      versionId: row.versionId,
      editionLabel: row.editionLabel.trim(),
      platform: row.platform.trim(),
      language: row.language.trim(),
      runtimeSeconds: row.runtimeSeconds,
    },
  };
}

function parseSourceRow(
  row: SourceRow,
  versionId: string,
): { evidence: EvidenceSourceRef; publicSource: PublicEvidenceReviewSource } | null {
  if (!isNonEmptyString(row.id) || row.versionId !== versionId || !isNonEmptyString(row.policySnapshotId)) return null;
  if (!isNonEmptyString(row.sourceKey) || !isHttpsUrl(row.sourceUrl)) return null;
  if (row.sourceRevision !== null && !isNonEmptyString(row.sourceRevision)) return null;
  if (!isNonEmptyString(row.sourceLicense) || !isHttpsUrl(row.licenseUrl)) return null;
  if (row.attributionText !== null && !isNonEmptyString(row.attributionText)) return null;
  if (!isValidDate(row.retrievedAt) || !/^[0-9a-f]{64}$/u.test(row.contentSha256)) return null;
  if (row.policyUseScope !== "analysis_evidence" || row.commercialUseAllowed !== 1) return null;
  if (row.sourceLicense !== row.policyLicenseLabel || row.licenseUrl !== row.policyLicenseUrl) return null;
  if (row.ingestionMode !== "manual" && row.ingestionMode !== "automated") return null;
  if (row.ingestionMode === "automated" && row.automatedIngestionAllowed !== 1) return null;
  if (row.attributionRequired !== 0 && row.attributionRequired !== 1) return null;
  if (row.shareAlike !== 0 && row.shareAlike !== 1) return null;
  if (row.attributionRequired === 1 && (!row.attributionText || row.attributionText.trim().length < 20)) return null;

  return {
    evidence: {
      id: row.id,
      versionId: row.versionId,
      policySnapshotId: row.policySnapshotId,
      sourceKey: row.sourceKey,
      sourceUrl: row.sourceUrl,
      sourceRevision: row.sourceRevision,
      contentSha256: row.contentSha256,
    },
    publicSource: {
      id: row.id,
      sourceKey: row.sourceKey,
      sourceUrl: row.sourceUrl,
      sourceRevision: row.sourceRevision,
      sourceLicense: row.sourceLicense,
      licenseUrl: row.licenseUrl,
      attributionText: row.attributionText,
      shareAlike: row.shareAlike === 1,
      retrievedAt: row.retrievedAt,
    },
  };
}

function parseAssertionRow(row: AssertionRow): EvidenceCategoryAssertion | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.evidenceSourceId)) return null;
  if (!isContentCategory(row.category) || !isAssertionResult(row.result)) return null;
  if (!isExtractionMethod(row.extractionMethod)) return null;
  if (!isNonEmptyString(row.extractorVersion) || !isNonEmptyString(row.sourceLocator) || !isNonEmptyString(row.summaryAr)) return null;
  if (row.extractionMethod === "model_assisted" && row.result === "none") return null;
  return {
    id: row.id,
    evidenceSourceId: row.evidenceSourceId,
    category: row.category,
    result: row.result,
    extractionMethod: row.extractionMethod,
    extractorVersion: row.extractorVersion,
    sourceLocator: row.sourceLocator,
    summaryAr: row.summaryAr,
  };
}

function parseFactRow(row: FactRow, flags: string[]): EvidenceFact | null {
  if (!isNonEmptyString(row.id) || !isNonEmptyString(row.assertionId)) return null;
  if (!isContentCategory(row.category) || !Number.isInteger(row.severity) || row.severity < 1 || row.severity > 4) return null;
  if (!isFrequency(row.frequency) || !isContext(row.context) || !isSpoilerLevel(row.spoilerLevel)) return null;
  if (!isNonEmptyString(row.summaryAr) || !flags.every(isContentFlag)) return null;
  const validTiming =
    (row.startSecond === null && row.endSecond === null) ||
    (Number.isInteger(row.startSecond) && Number.isInteger(row.endSecond) && (row.startSecond as number) >= 0 && (row.endSecond as number) >= (row.startSecond as number));
  if (!validTiming) return null;
  return {
    id: row.id,
    assertionId: row.assertionId,
    category: row.category,
    severity: row.severity as 1 | 2 | 3 | 4,
    frequency: row.frequency,
    context: row.context,
    spoilerLevel: row.spoilerLevel,
    summaryAr: row.summaryAr,
    startSecond: row.startSecond,
    endSecond: row.endSecond,
    flags: flags as EvidenceFact["flags"],
  };
}

function isTitleKind(value: string): value is PublicEvidenceReviewMetadata["kind"] {
  return value === "movie" || value === "series" || value === "episode" || value === "special";
}

function isContentCategory(value: string): value is EvidenceCategoryAssertion["category"] {
  return ["fear", "violence", "language", "bullying", "sexualContent", "substances", "discrimination", "selfHarm", "grief", "flashingLights"].includes(value);
}

function isAssertionResult(value: string): value is EvidenceCategoryAssertion["result"] {
  return value === "none" || value === "present" || value === "uncertain";
}

function isExtractionMethod(value: string): value is EvidenceCategoryAssertion["extractionMethod"] {
  return value === "manual" || value === "deterministic" || value === "model_assisted";
}

function isFrequency(value: string): value is EvidenceFact["frequency"] {
  return value === "single" || value === "repeated" || value === "sustained" || value === "unknown";
}

function isContext(value: string): value is EvidenceFact["context"] {
  return value === "comic" || value === "neutral" || value === "educational" || value === "threatening" || value === "distressing" || value === "unknown";
}

function isSpoilerLevel(value: string): value is EvidenceFact["spoilerLevel"] {
  return value === "none" || value === "contextual" || value === "major";
}

function isContentFlag(value: string): value is EvidenceFact["flags"][number] {
  return ["jump_scare", "blood", "weapon", "verbal_bullying", "physical_bullying", "bereavement", "separation", "flashing_sequence"].includes(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
