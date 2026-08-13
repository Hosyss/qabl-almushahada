import {
  CONTENT_SOURCE_POLICY_VERSION,
  assertAutomatedSourceUseAllowed,
  assertSourceProvenancePersistenceAllowed,
  type ContentSourceDecision,
  type ContentSourceKey,
  type ContentSourceUse,
} from "./content-source-policy.ts";

export type SourceIngestionMode = "manual" | "automated";

export interface SourcePolicySnapshotRecord {
  id: string;
  sourceKey: string;
  policyVersion: string;
  useScope: ContentSourceUse;
  decision: ContentSourceDecision;
  licenseLabel: string;
  licenseUrl: string;
  policyUrl: string;
  attributionRequired: boolean;
  shareAlike: boolean;
  automatedIngestionAllowed: boolean;
  commercialUseAllowed: boolean;
  verifiedOn: string;
}

export interface CatalogSourceProvenanceRecord {
  id: string;
  titleId: string;
  policySnapshotId: string;
  sourceEntityId: string;
  sourceUrl: string;
  sourceRevision: string | null;
  retrievedAt: string;
  contentSha256: string;
  ingestionMode: SourceIngestionMode;
}

export function buildCurrentSourcePolicySnapshot(
  source: ContentSourceKey,
  use: ContentSourceUse,
): SourcePolicySnapshotRecord {
  const policy = assertSourceProvenancePersistenceAllowed(source, use);
  if (!policy.licenseUrl || !isHttpsUrl(policy.licenseUrl) || !isHttpsUrl(policy.policyUrl)) {
    throw new Error(`Persistable source policy must have HTTPS license and policy URLs: ${source}`);
  }

  return {
    id: `source-policy:${policy.key}:${CONTENT_SOURCE_POLICY_VERSION}:${use}`,
    sourceKey: policy.key,
    policyVersion: CONTENT_SOURCE_POLICY_VERSION,
    useScope: use,
    decision: policy.decision,
    licenseLabel: policy.licenseLabel,
    licenseUrl: policy.licenseUrl,
    policyUrl: policy.policyUrl,
    attributionRequired: policy.attributionRequired,
    shareAlike: policy.shareAlike,
    automatedIngestionAllowed: policy.automatedIngestion,
    commercialUseAllowed: policy.commercialUseAllowed,
    verifiedOn: policy.verifiedOn,
  };
}

export function prepareCatalogSourceProvenance(input: {
  id: string;
  titleId: string;
  source: ContentSourceKey;
  sourceEntityId: string;
  sourceUrl: string;
  sourceRevision?: string | null;
  retrievedAt: string;
  contentSha256: string;
  ingestionMode: SourceIngestionMode;
}): CatalogSourceProvenanceRecord {
  const snapshot = buildCurrentSourcePolicySnapshot(input.source, "catalog_metadata");
  if (input.ingestionMode === "automated") {
    assertAutomatedSourceUseAllowed(input.source, "catalog_metadata");
  }

  const id = boundedText(input.id, "id", 1, 160);
  const titleId = boundedText(input.titleId, "titleId", 1, 160);
  const sourceEntityId = boundedText(input.sourceEntityId, "sourceEntityId", 2, 160);
  const sourceUrl = requireHttpsUrl(input.sourceUrl, "sourceUrl");
  const sourceRevision = optionalBoundedText(input.sourceRevision, "sourceRevision", 160);
  const retrievedAt = normalizeInstant(input.retrievedAt);
  const contentSha256 = normalizeSha256(input.contentSha256);

  if (input.source === "wikidata") {
    if (!/^Q\d+$/u.test(sourceEntityId)) {
      throw new TypeError("Wikidata sourceEntityId must be a QID");
    }
    const expectedUrl = `https://www.wikidata.org/wiki/${sourceEntityId}`;
    if (sourceUrl !== expectedUrl) {
      throw new TypeError("Wikidata sourceUrl must match sourceEntityId");
    }
  }

  return {
    id,
    titleId,
    policySnapshotId: snapshot.id,
    sourceEntityId,
    sourceUrl,
    sourceRevision,
    retrievedAt,
    contentSha256,
    ingestionMode: input.ingestionMode,
  };
}

/**
 * Evidence persistence deliberately remains fail-closed until P3S-05 enables a
 * source-specific analysis-evidence policy snapshot. Calling this today for Wikipedia,
 * IMDb, TMDB, or a generic classification authority throws rather than inventing rights.
 */
export function assertAnalysisEvidenceSourceReady(
  source: ContentSourceKey,
  ingestionMode: SourceIngestionMode,
): SourcePolicySnapshotRecord {
  const snapshot = buildCurrentSourcePolicySnapshot(source, "analysis_evidence");
  if (ingestionMode === "automated") {
    assertAutomatedSourceUseAllowed(source, "analysis_evidence");
  }
  return snapshot;
}

function boundedText(value: string, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${label} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max || normalized.includes("\u0000")) {
    throw new TypeError(`${label} has an invalid length or contains NUL`);
  }
  return normalized;
}

function optionalBoundedText(
  value: string | null | undefined,
  label: string,
  max: number,
): string | null {
  if (value === undefined || value === null) return null;
  return boundedText(value, label, 1, max);
}

function requireHttpsUrl(value: string, label: string): string {
  const normalized = boundedText(value, label, 8, 2048);
  if (!isHttpsUrl(normalized)) throw new TypeError(`${label} must be an HTTPS URL`);
  return normalized;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function normalizeInstant(value: string): string {
  const normalized = boundedText(value, "retrievedAt", 20, 40);
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError("retrievedAt must be a valid instant");
  return parsed.toISOString();
}

function normalizeSha256(value: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError("contentSha256 must be a lowercase SHA-256 hex digest");
  }
  return value;
}
