import { env } from "cloudflare:workers";

import { loadReviewBundle } from "@/db/load-review-bundle";
import {
  buildPublicReviewView,
  parsePublicReviewLocator,
  type PublicReviewMetadata,
  type PublicReviewView,
} from "@/lib/public-review";

interface PublicReviewMetadataRow {
  bundleId: string;
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
  publishedAt: string;
  approvedAt: string;
}

export async function loadPublicReview(input: unknown): Promise<PublicReviewView | null> {
  const { bundleId } = parsePublicReviewLocator(input);
  const bundle = await loadReviewBundle(bundleId);
  if (!bundle) return null;

  // This query runs after hydration and the engine quality assessment in buildPublicReviewView.
  // It is deliberately the final database gate before returning public data, so stale URLs or
  // a report/state transition that happened during loading fail closed on the next check.
  const metadata = await loadCurrentPublicReviewMetadata(bundleId);
  if (!metadata) return null;

  return buildPublicReviewView(metadata, bundle);
}

async function loadCurrentPublicReviewMetadata(bundleId: string): Promise<PublicReviewMetadata | null> {
  const result = await requireD1()
    .prepare(
      `SELECT
         b.id AS bundleId,
         t.id AS titleId,
         t.canonical_name AS canonicalName,
         t.original_name AS originalName,
         t.kind AS kind,
         t.release_year AS releaseYear,
         v.id AS versionId,
         v.edition_label AS editionLabel,
         v.platform AS platform,
         v.language AS language,
         v.runtime_seconds AS runtimeSeconds,
         b.published_at AS publishedAt,
         ea.approved_at AS approvedAt
       FROM review_bundles b
       INNER JOIN title_versions v ON v.id = b.version_id
       INNER JOIN titles t ON t.id = v.title_id
       INNER JOIN editorial_approvals ea
         ON ea.id = b.current_approval_id
        AND ea.bundle_id = b.id
       WHERE b.id = ?
         AND b.status = 'verified'
         AND b.current_approval_id IS NOT NULL
         AND b.published_at IS NOT NULL
         AND v.status = 'active'
         AND ea.status = 'approved'
         AND NOT EXISTS (
           SELECT 1
           FROM review_reports rr
           WHERE rr.bundle_id = b.id
             AND rr.status IN ('open', 'investigating')
         )
       LIMIT 1`,
    )
    .bind(bundleId)
    .all<PublicReviewMetadataRow>();

  const row = result.results?.[0];
  return row ? parseMetadataRow(row) : null;
}

function parseMetadataRow(row: PublicReviewMetadataRow): PublicReviewMetadata | null {
  if (!isNonEmptyString(row.bundleId) || !isNonEmptyString(row.titleId)) return null;
  if (!isNonEmptyString(row.canonicalName) || !isNonEmptyString(row.versionId)) return null;
  if (row.originalName !== null && !isNonEmptyString(row.originalName)) return null;
  if (!isTitleKind(row.kind)) return null;
  if (!Number.isInteger(row.releaseYear) || row.releaseYear < 1880 || row.releaseYear > 2200) return null;
  if (!isNonEmptyString(row.editionLabel) || !isNonEmptyString(row.platform) || !isNonEmptyString(row.language)) return null;
  if (!Number.isInteger(row.runtimeSeconds) || row.runtimeSeconds <= 0) return null;
  if (!isValidDate(row.publishedAt) || !isValidDate(row.approvedAt)) return null;

  return {
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
    publishedAt: row.publishedAt,
    approvedAt: row.approvedAt,
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
