import { and, eq, inArray } from "drizzle-orm";

import { hydrateReviewBundle } from "@/lib/review-engine";
import { getDb } from "./index";
import {
  editorialApprovalSubmissions,
  editorialApprovals,
  editorialSpotChecks,
  observationFlags,
  observations,
  reviewBundles,
  reviewCategoryChecks,
  reviewReports,
  reviewers,
  reviewSubmissions,
  titles,
  titleVersions,
} from "./schema";

export async function loadReviewBundle(bundleId: string) {
  const db = getDb();

  const bundleRows = await db
    .select({
      bundleId: reviewBundles.id,
      revision: reviewBundles.revision,
      versionId: titleVersions.id,
      titleId: titleVersions.titleId,
      editionLabel: titleVersions.editionLabel,
      platform: titleVersions.platform,
      language: titleVersions.language,
      releaseYear: titles.releaseYear,
      runtimeSeconds: titleVersions.runtimeSeconds,
      contentFingerprint: titleVersions.contentFingerprint,
    })
    .from(reviewBundles)
    .innerJoin(titleVersions, eq(reviewBundles.versionId, titleVersions.id))
    .innerJoin(titles, eq(titleVersions.titleId, titles.id))
    .where(eq(reviewBundles.id, bundleId))
    .limit(1);

  const bundleRow = bundleRows[0];
  if (!bundleRow) return null;

  const submissionRows = await db
    .select({
      id: reviewSubmissions.id,
      versionId: reviewSubmissions.versionId,
      reviewerId: reviewers.id,
      reviewerIndependenceGroupId: reviewers.independenceGroupId,
      reviewerStatus: reviewers.status,
      startedAt: reviewSubmissions.startedAt,
      completedAt: reviewSubmissions.completedAt,
      watchedSeconds: reviewSubmissions.watchedSeconds,
      declaredComplete: reviewSubmissions.declaredComplete,
    })
    .from(reviewSubmissions)
    .innerJoin(reviewers, eq(reviewSubmissions.reviewerId, reviewers.id))
    .where(eq(reviewSubmissions.bundleId, bundleId));

  const submissionIds = submissionRows.map((row) => row.id);
  const categoryRows = submissionIds.length
    ? await db
        .select()
        .from(reviewCategoryChecks)
        .where(inArray(reviewCategoryChecks.submissionId, submissionIds))
    : [];
  const observationRows = submissionIds.length
    ? await db.select().from(observations).where(inArray(observations.submissionId, submissionIds))
    : [];
  const observationIds = observationRows.map((row) => row.id);
  const flagRows = observationIds.length
    ? await db.select().from(observationFlags).where(inArray(observationFlags.observationId, observationIds))
    : [];

  const approvalRows = await db
    .select({
      id: editorialApprovals.id,
      status: editorialApprovals.status,
      approverId: editorialApprovals.approverId,
      approverIndependenceGroupId: reviewers.independenceGroupId,
      approverStatus: reviewers.status,
      approvedAt: editorialApprovals.approvedAt,
      versionFingerprintConfirmed: editorialApprovals.versionFingerprintConfirmed,
    })
    .from(editorialApprovals)
    .innerJoin(reviewers, eq(editorialApprovals.approverId, reviewers.id))
    .where(eq(editorialApprovals.bundleId, bundleId))
    .limit(1);

  const blockingReportRows = await db
    .select({
      id: reviewReports.id,
      reportType: reviewReports.reportType,
      status: reviewReports.status,
    })
    .from(reviewReports)
    .where(
      and(
        eq(reviewReports.bundleId, bundleId),
        inArray(reviewReports.status, ["open", "investigating"]),
      ),
    );

  const approvalRow = approvalRows[0];
  const approvalSubmissionRows = approvalRow
    ? await db
        .select({ submissionId: editorialApprovalSubmissions.submissionId })
        .from(editorialApprovalSubmissions)
        .where(eq(editorialApprovalSubmissions.approvalId, approvalRow.id))
    : [];
  const spotCheckRows = approvalRow
    ? await db
        .select({
          observationId: editorialSpotChecks.observationId,
          result: editorialSpotChecks.result,
        })
        .from(editorialSpotChecks)
        .where(eq(editorialSpotChecks.approvalId, approvalRow.id))
    : [];

  return hydrateReviewBundle({
    bundle: { id: bundleRow.bundleId, revision: bundleRow.revision },
    version: {
      id: bundleRow.versionId,
      titleId: bundleRow.titleId,
      editionLabel: bundleRow.editionLabel,
      platform: bundleRow.platform,
      language: bundleRow.language,
      releaseYear: bundleRow.releaseYear,
      runtimeSeconds: bundleRow.runtimeSeconds,
      contentFingerprint: bundleRow.contentFingerprint,
    },
    submissions: submissionRows,
    categoryChecks: categoryRows,
    observations: observationRows,
    observationFlags: flagRows,
    blockingReports: blockingReportRows,
    approval: approvalRow
      ? {
          status: approvalRow.status,
          approverId: approvalRow.approverId,
          approverIndependenceGroupId: approvalRow.approverIndependenceGroupId,
          approverStatus: approvalRow.approverStatus,
          approvedAt: approvalRow.approvedAt,
          versionFingerprintConfirmed: approvalRow.versionFingerprintConfirmed,
          reviewedSubmissionIds: approvalSubmissionRows.map((row) => row.submissionId),
          spotChecks: spotCheckRows,
        }
      : undefined,
  });
}
