import { env } from "cloudflare:workers";

import { loadReviewBundle } from "@/db/load-review-bundle";
import {
  buildPublicReviewView,
  parsePublicReviewLocator,
  type PublicReviewMetadata,
  type PublicReviewView,
} from "@/lib/public-review";
import {
  buildPublicReviewGateQuery,
  type PublicReviewGateExpectation,
} from "@/db/public-review-query";

interface PublicReviewMetadataRow {
  bundleId: string;
  bundleRevision: number;
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
  contentFingerprint: string;
  publishedAt: string;
  approvalId: string;
  approvedAt: string;
}

interface PublicReviewGateSnapshot {
  expectation: PublicReviewGateExpectation;
  metadata: PublicReviewMetadata;
}

export async function loadPublicReview(input: unknown): Promise<PublicReviewView | null> {
  const { bundleId } = parsePublicReviewLocator(input);

  // Capture the public state before hydration. The same revision and current approval
  // must still be current after hydration or the request fails closed.
  const initialGate = await loadCurrentPublicReviewGate(bundleId);
  if (!initialGate) return null;

  const bundle = await loadReviewBundle(bundleId);
  if (!bundle) return null;

  const finalGate = await loadCurrentPublicReviewGate(bundleId, initialGate.expectation);
  if (!finalGate) return null;

  return buildPublicReviewView(finalGate.metadata, bundle);
}

async function loadCurrentPublicReviewGate(
  bundleId: string,
  expectation?: PublicReviewGateExpectation,
): Promise<PublicReviewGateSnapshot | null> {
  const query = buildPublicReviewGateQuery(bundleId, expectation);
  const result = await requireD1()
    .prepare(query.sql)
    .bind(...query.bindings)
    .all<PublicReviewMetadataRow>();

  const row = result.results?.[0];
  return row ? parseGateRow(row) : null;
}

function parseGateRow(row: PublicReviewMetadataRow): PublicReviewGateSnapshot | null {
  if (!isNonEmptyString(row.bundleId) || !isNonEmptyString(row.titleId)) return null;
  if (!Number.isInteger(row.bundleRevision) || row.bundleRevision < 0) return null;
  if (!isNonEmptyString(row.approvalId)) return null;
  if (!isNonEmptyString(row.canonicalName) || !isNonEmptyString(row.versionId)) return null;
  if (row.originalName !== null && !isNonEmptyString(row.originalName)) return null;
  if (!isTitleKind(row.kind)) return null;
  if (!Number.isInteger(row.releaseYear) || row.releaseYear < 1880 || row.releaseYear > 2200) {
    return null;
  }
  if (
    !isNonEmptyString(row.editionLabel) ||
    !isNonEmptyString(row.platform) ||
    !isNonEmptyString(row.language)
  ) {
    return null;
  }
  if (!Number.isInteger(row.runtimeSeconds) || row.runtimeSeconds <= 0) return null;
  if (!isNonEmptyString(row.contentFingerprint)) return null;
  if (!isValidDate(row.publishedAt) || !isValidDate(row.approvedAt)) return null;

  return {
    expectation: {
      bundleRevision: row.bundleRevision,
      approvalId: row.approvalId,
    },
    metadata: {
      bundleId: row.bundleId,
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
      contentFingerprint: row.contentFingerprint,
      publishedAt: row.publishedAt,
      approvedAt: row.approvedAt,
    },
  };
}

function isTitleKind(value: string): value is PublicReviewMetadata["kind"] {
  return value === "movie" || value === "series" || value === "episode" || value === "special";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
