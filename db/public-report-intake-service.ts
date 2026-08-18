import { env } from "cloudflare:workers";

import { CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY } from "@/db/public-editorial-head-query";
import { buildPublicEvidenceReviewGateQuery } from "@/db/public-evidence-review-query";
import {
  PUBLIC_REPORT_GLOBAL_HOUR,
  PUBLIC_REPORT_PER_CLIENT_HOUR,
  preparePublicReportIntake,
  type PublicReportTargetKind,
} from "@/lib/public-report-intake";

interface TargetSnapshot {
  targetKind: PublicReportTargetKind;
  targetPublicId: string;
  targetRevision: number;
  targetSnapshotRef: string;
  targetVersionId: string | null;
}

interface HumanReviewTargetRow {
  bundleId: string;
  bundleRevision: number;
  approvalId: string;
  versionId: string;
}

interface EvidenceTargetRow {
  publicationId: string;
  headRevision: number;
  publicationRevision: number;
  versionId: string;
}

interface EditorialTargetRow {
  snapshotId: string;
  publicId: string;
  revision: number;
}

export type PublicReportIntakeResult =
  | { accepted: true; intakeId: string }
  | { accepted: false; reason: "invalid_input"; errorsAr: string[] }
  | { accepted: false; reason: "target_unavailable" | "rate_limited" | "request_not_allowed" };

export async function submitPublicReportIntake(input: {
  request: Request;
  body: unknown;
}): Promise<PublicReportIntakeResult> {
  if (!isAllowedRequestContext(input.request)) {
    return { accepted: false, reason: "request_not_allowed" };
  }

  const preparation = preparePublicReportIntake(input.body);
  if (!preparation.accepted) return preparation;

  // Honeypot submissions receive the same outward success shape but never touch D1.
  // Use an unpersisted UUID so automated clients cannot distinguish the trap via response shape.
  if (preparation.automatedSubmission) return { accepted: true, intakeId: crypto.randomUUID() };

  const clientAddress = readCloudflareClientAddress(input.request);
  if (!clientAddress) return { accepted: false, reason: "request_not_allowed" };

  const clientKeyHash = await hashClientKey(clientAddress);
  const snapshot = await loadCurrentTargetSnapshot(
    preparation.targetKind,
    preparation.targetPublicId,
  );
  if (!snapshot) return { accepted: false, reason: "target_unavailable" };

  const db = requireD1();
  const intakeId = crypto.randomUUID();
  const result = await db
    .prepare(
      `INSERT INTO public_report_intakes
         (id, target_kind, target_public_id, target_revision, target_snapshot_ref,
          target_version_id, report_reason, message, client_key_hash, status, revision)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', 0
       WHERE
         (SELECT COUNT(*) FROM public_report_intakes
          WHERE client_key_hash = ?
            AND created_at >= datetime('now', '-1 hour')) < ?
         AND
         (SELECT COUNT(*) FROM public_report_intakes
          WHERE created_at >= datetime('now', '-1 hour')) < ?
         AND NOT EXISTS (
           SELECT 1 FROM public_report_intakes
           WHERE target_kind = ?
             AND target_public_id = ?
             AND client_key_hash = ?
             AND status = 'received'
             AND created_at >= datetime('now', '-24 hours')
         )`,
    )
    .bind(
      intakeId,
      snapshot.targetKind,
      snapshot.targetPublicId,
      snapshot.targetRevision,
      snapshot.targetSnapshotRef,
      snapshot.targetVersionId,
      preparation.reportReason,
      preparation.message,
      clientKeyHash,
      clientKeyHash,
      PUBLIC_REPORT_PER_CLIENT_HOUR,
      PUBLIC_REPORT_GLOBAL_HOUR,
      snapshot.targetKind,
      snapshot.targetPublicId,
      clientKeyHash,
    )
    .run();

  if ((result.meta?.changes ?? 0) === 1) return { accepted: true, intakeId };

  // Duplicate submissions and throttled submissions share one conservative response.
  // The public client does not need enough detail to tune automated retries.
  return { accepted: false, reason: "rate_limited" };
}

async function loadCurrentTargetSnapshot(
  targetKind: PublicReportTargetKind,
  targetPublicId: string,
): Promise<TargetSnapshot | null> {
  if (targetKind === "human_review") return loadHumanReviewSnapshot(targetPublicId);
  if (targetKind === "evidence_publication") return loadEvidenceSnapshot(targetPublicId);
  return loadEditorialSnapshot(targetPublicId);
}

async function loadHumanReviewSnapshot(bundleId: string): Promise<TargetSnapshot | null> {
  const row = await requireD1()
    .prepare(
      `SELECT b.id AS bundleId,
              b.revision AS bundleRevision,
              b.current_approval_id AS approvalId,
              b.version_id AS versionId
       FROM review_bundles b
       INNER JOIN editorial_approvals approval
         ON approval.id = b.current_approval_id
        AND approval.bundle_id = b.id
       INNER JOIN title_versions version ON version.id = b.version_id
       WHERE b.id = ?
         AND b.status = 'verified'
         AND b.current_approval_id IS NOT NULL
         AND b.published_at IS NOT NULL
         AND approval.status = 'approved'
         AND version.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM review_reports report
           WHERE report.bundle_id = b.id
             AND report.status IN ('open', 'investigating')
         )
       LIMIT 1`,
    )
    .bind(bundleId)
    .first<HumanReviewTargetRow>();

  if (
    !row ||
    row.bundleId !== bundleId ||
    !Number.isInteger(row.bundleRevision) ||
    row.bundleRevision < 0 ||
    !isNonEmptyString(row.approvalId) ||
    !isNonEmptyString(row.versionId)
  ) {
    return null;
  }

  return {
    targetKind: "human_review",
    targetPublicId: row.bundleId,
    targetRevision: row.bundleRevision,
    targetSnapshotRef: row.approvalId,
    targetVersionId: row.versionId,
  };
}

async function loadEvidenceSnapshot(publicationId: string): Promise<TargetSnapshot | null> {
  const query = buildPublicEvidenceReviewGateQuery(publicationId);
  const row = await requireD1()
    .prepare(query.sql)
    .bind(...query.bindings)
    .first<EvidenceTargetRow>();

  if (
    !row ||
    row.publicationId !== publicationId ||
    !Number.isInteger(row.headRevision) ||
    row.headRevision < 0 ||
    !Number.isInteger(row.publicationRevision) ||
    row.publicationRevision < 0 ||
    !isNonEmptyString(row.versionId)
  ) {
    return null;
  }

  return {
    targetKind: "evidence_publication",
    targetPublicId: row.publicationId,
    targetRevision: row.headRevision,
    targetSnapshotRef: `${row.publicationId}:${row.publicationRevision}`,
    targetVersionId: row.versionId,
  };
}

async function loadEditorialSnapshot(publicId: string): Promise<TargetSnapshot | null> {
  const row = await requireD1()
    .prepare(CURRENT_EDITORIAL_BY_PUBLIC_ID_QUERY)
    .bind(publicId)
    .first<EditorialTargetRow>();

  if (
    !row ||
    row.publicId !== publicId ||
    !isNonEmptyString(row.snapshotId) ||
    !Number.isInteger(row.revision) ||
    row.revision < 1
  ) {
    return null;
  }

  return {
    targetKind: "editorial_publication",
    targetPublicId: row.publicId,
    targetRevision: row.revision,
    targetSnapshotRef: row.snapshotId,
    targetVersionId: null,
  };
}

function isAllowedRequestContext(request: Request): boolean {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  return true;
}

function readCloudflareClientAddress(request: Request): string | null {
  const value = request.headers.get("cf-connecting-ip")?.trim() ?? "";
  if (!value || value.length > 64 || /[\u0000-\u001F\u007F]/u.test(value)) return null;
  return value;
}

async function hashClientKey(clientAddress: string): Promise<string> {
  const secret = readHashSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(clientAddress));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readHashSecret(): string {
  const secret = (env as unknown as { PUBLIC_REPORT_HMAC_SECRET?: string }).PUBLIC_REPORT_HMAC_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("PUBLIC_REPORT_HMAC_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requireD1(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 binding DB is required.");
  return db;
}
