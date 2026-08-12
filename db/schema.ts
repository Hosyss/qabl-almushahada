import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () => text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const titles = sqliteTable(
  "titles",
  {
    id: text("id").primaryKey(),
    canonicalName: text("canonical_name").notNull(),
    originalName: text("original_name"),
    kind: text("kind", { enum: ["movie", "series", "episode", "special"] }).notNull(),
    releaseYear: integer("release_year").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("titles_name_idx").on(table.canonicalName),
    index("titles_release_year_idx").on(table.releaseYear),
    check("titles_release_year_check", sql`${table.releaseYear} BETWEEN 1880 AND 2200`),
    check("titles_kind_check", sql`${table.kind} IN ('movie', 'series', 'episode', 'special')`),
  ],
);

export const titleVersions = sqliteTable(
  "title_versions",
  {
    id: text("id").primaryKey(),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    editionLabel: text("edition_label").notNull(),
    platform: text("platform").notNull(),
    language: text("language").notNull(),
    runtimeSeconds: integer("runtime_seconds").notNull(),
    contentFingerprint: text("content_fingerprint").notNull(),
    status: text("status", {
      enum: ["draft", "active", "superseded", "withdrawn"],
    })
      .notNull()
      .default("draft"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("title_versions_fingerprint_unique").on(table.contentFingerprint),
    index("title_versions_title_idx").on(table.titleId),
    index("title_versions_lookup_idx").on(table.platform, table.language, table.status),
    check("title_versions_runtime_check", sql`${table.runtimeSeconds} > 0`),
    check("title_versions_fingerprint_length_check", sql`length(${table.contentFingerprint}) >= 12`),
    check("title_versions_status_check", sql`${table.status} IN ('draft', 'active', 'superseded', 'withdrawn')`),
  ],
);

export const reviewers = sqliteTable(
  "reviewers",
  {
    id: text("id").primaryKey(),
    displayLabel: text("display_label").notNull(),
    independenceGroupId: text("independence_group_id").notNull(),
    status: text("status", { enum: ["active", "probation", "suspended"] })
      .notNull()
      .default("probation"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("reviewers_independence_group_idx").on(table.independenceGroupId),
    index("reviewers_status_idx").on(table.status),
    check("reviewers_status_check", sql`${table.status} IN ('active', 'probation', 'suspended')`),
  ],
);

export const reviewBundles = sqliteTable(
  "review_bundles",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    status: text("status", {
      enum: ["draft", "under_review", "conflicted", "verified", "withdrawn"],
    })
      .notNull()
      .default("draft"),
    revision: integer("revision").notNull().default(0),
    publishedTransitionId: text("published_transition_id"),
    workflowTransitionId: text("workflow_transition_id"),
    currentApprovalId: text("current_approval_id"),
    createdAt: createdAt(),
    publishedAt: text("published_at"),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("review_bundles_version_idx").on(table.versionId),
    index("review_bundles_status_idx").on(table.status),
    uniqueIndex("review_bundles_transition_unique").on(table.publishedTransitionId),
    uniqueIndex("review_bundles_workflow_transition_unique").on(table.workflowTransitionId),
    uniqueIndex("review_bundles_current_approval_unique").on(table.currentApprovalId),
    check(
      "review_bundles_status_check",
      sql`${table.status} IN ('draft', 'under_review', 'conflicted', 'verified', 'withdrawn')`,
    ),
    check("review_bundles_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const reviewSubmissions = sqliteTable(
  "review_submissions",
  {
    id: text("id").primaryKey(),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => reviewBundles.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "restrict" }),
    assignmentId: text("assignment_id"),
    revision: integer("revision").notNull().default(1),
    supersedesSubmissionId: text("supersedes_submission_id"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at").notNull(),
    watchedSeconds: integer("watched_seconds").notNull(),
    declaredComplete: integer("declared_complete", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("review_submissions_assignment_revision_unique").on(table.assignmentId, table.revision),
    index("review_submissions_bundle_reviewer_idx").on(table.bundleId, table.reviewerId),
    index("review_submissions_version_idx").on(table.versionId),
    index("review_submissions_reviewer_idx").on(table.reviewerId),
    check("review_submissions_revision_check", sql`${table.revision} >= 1`),
    check("review_submissions_watched_seconds_check", sql`${table.watchedSeconds} >= 0`),
    check("review_submissions_time_order_check", sql`${table.completedAt} > ${table.startedAt}`),
    check("review_submissions_complete_check", sql`${table.declaredComplete} IN (0, 1)`),
  ],
);

export const reviewCategoryChecks = sqliteTable(
  "review_category_checks",
  {
    submissionId: text("submission_id")
      .notNull()
      .references(() => reviewSubmissions.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    result: text("result", { enum: ["none", "present", "uncertain"] }).notNull(),
    checkedAt: text("checked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.submissionId, table.category] }),
    index("review_category_checks_result_idx").on(table.result),
    check(
      "review_category_checks_category_check",
      sql`${table.category} IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')`,
    ),
    check("review_category_checks_result_check", sql`${table.result} IN ('none', 'present', 'uncertain')`),
  ],
);

export const observations = sqliteTable(
  "observations",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => reviewSubmissions.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    severity: integer("severity").notNull(),
    startSecond: integer("start_second").notNull(),
    endSecond: integer("end_second").notNull(),
    frequency: text("frequency", { enum: ["single", "repeated", "sustained"] }).notNull(),
    context: text("context", {
      enum: ["comic", "neutral", "educational", "threatening", "distressing"],
    }).notNull(),
    spoilerLevel: text("spoiler_level", { enum: ["none", "contextual", "major"] }).notNull(),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("observations_submission_idx").on(table.submissionId),
    index("observations_category_severity_idx").on(table.category, table.severity),
    check("observations_severity_check", sql`${table.severity} BETWEEN 1 AND 4`),
    check("observations_start_check", sql`${table.startSecond} >= 0`),
    check("observations_time_order_check", sql`${table.endSecond} >= ${table.startSecond}`),
    check("observations_summary_check", sql`length(trim(${table.summary})) > 0`),
    check(
      "observations_category_check",
      sql`${table.category} IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')`,
    ),
    check("observations_frequency_check", sql`${table.frequency} IN ('single', 'repeated', 'sustained')`),
    check(
      "observations_context_check",
      sql`${table.context} IN ('comic', 'neutral', 'educational', 'threatening', 'distressing')`,
    ),
    check("observations_spoiler_check", sql`${table.spoilerLevel} IN ('none', 'contextual', 'major')`),
  ],
);

export const observationFlags = sqliteTable(
  "observation_flags",
  {
    observationId: text("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "cascade" }),
    flag: text("flag").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.observationId, table.flag] }),
    index("observation_flags_flag_idx").on(table.flag),
    check(
      "observation_flags_value_check",
      sql`${table.flag} IN ('jump_scare', 'blood', 'weapon', 'verbal_bullying', 'physical_bullying', 'bereavement', 'separation', 'flashing_sequence')`,
    ),
  ],
);

export const editorialApprovals = sqliteTable(
  "editorial_approvals",
  {
    id: text("id").primaryKey(),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => reviewBundles.id, { onDelete: "cascade" }),
    approverId: text("approver_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["approved", "changes_requested", "rejected"] }).notNull(),
    revision: integer("revision").notNull().default(1),
    supersedesApprovalId: text("supersedes_approval_id"),
    versionFingerprintConfirmed: integer("version_fingerprint_confirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    notes: text("notes").notNull().default(""),
    approvedAt: text("approved_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("editorial_approvals_bundle_revision_unique").on(table.bundleId, table.revision),
    index("editorial_approvals_approver_idx").on(table.approverId),
    check("editorial_approvals_revision_check", sql`${table.revision} >= 1`),
    check("editorial_approvals_status_check", sql`${table.status} IN ('approved', 'changes_requested', 'rejected')`),
    check(
      "editorial_approvals_fingerprint_check",
      sql`${table.versionFingerprintConfirmed} IN (0, 1)`,
    ),
  ],
);

export const editorialApprovalSubmissions = sqliteTable(
  "editorial_approval_submissions",
  {
    approvalId: text("approval_id")
      .notNull()
      .references(() => editorialApprovals.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => reviewSubmissions.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.approvalId, table.submissionId] })],
);

export const editorialSpotChecks = sqliteTable(
  "editorial_spot_checks",
  {
    approvalId: text("approval_id")
      .notNull()
      .references(() => editorialApprovals.id, { onDelete: "cascade" }),
    observationId: text("observation_id")
      .notNull()
      .references(() => observations.id, { onDelete: "restrict" }),
    result: text("result", { enum: ["confirmed", "unresolved"] }).notNull(),
    notes: text("notes").notNull().default(""),
    checkedAt: text("checked_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.approvalId, table.observationId] }),
    index("editorial_spot_checks_result_idx").on(table.result),
    check("editorial_spot_checks_result_check", sql`${table.result} IN ('confirmed', 'unresolved')`),
  ],
);

export const reviewReports = sqliteTable(
  "review_reports",
  {
    id: text("id").primaryKey(),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => reviewBundles.id, { onDelete: "cascade" }),
    versionId: text("version_id"),
    invalidatedApprovalId: text("invalidated_approval_id"),
    previousBundleStatus: text("previous_bundle_status", {
      enum: ["draft", "under_review", "conflicted", "verified"],
    }),
    previousBundleRevision: integer("previous_bundle_revision"),
    reportType: text("report_type", {
      enum: ["different_version", "missing_event", "wrong_severity", "spoiler", "other"],
    }).notNull(),
    message: text("message").notNull(),
    status: text("status", { enum: ["open", "investigating", "resolved", "dismissed"] })
      .notNull()
      .default("open"),
    resolutionKind: text("resolution_kind", { enum: ["no_issue", "correction_required"] }),
    resolutionNote: text("resolution_note"),
    resolvedByUserId: text("resolved_by_user_id"),
    revision: integer("revision").notNull().default(0),
    lastTransitionId: text("last_transition_id"),
    createdAt: createdAt(),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("review_reports_bundle_status_idx").on(table.bundleId, table.status),
    index("review_reports_version_idx").on(table.versionId),
    check("review_reports_message_check", sql`length(trim(${table.message})) >= 10`),
    check("review_reports_revision_check", sql`${table.revision} >= 0`),
    check(
      "review_reports_type_check",
      sql`${table.reportType} IN ('different_version', 'missing_event', 'wrong_severity', 'spoiler', 'other')`,
    ),
    check(
      "review_reports_status_check",
      sql`${table.status} IN ('open', 'investigating', 'resolved', 'dismissed')`,
    ),
    check(
      "review_reports_resolution_kind_check",
      sql`${table.resolutionKind} IS NULL OR ${table.resolutionKind} IN ('no_issue', 'correction_required')`,
    ),
  ],
);

/** Append-only event log. Application code must never update or delete rows. */
export const reviewAuditEvents = sqliteTable(
  "review_audit_events",
  {
    id: text("id").primaryKey(),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => reviewBundles.id, { onDelete: "restrict" }),
    actorId: text("actor_id").notNull(),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: createdAt(),
  },
  (table) => [
    index("review_audit_events_bundle_time_idx").on(table.bundleId, table.createdAt),
    index("review_audit_events_entity_idx").on(table.entityType, table.entityId),
    check("review_audit_events_json_check", sql`json_valid(${table.payloadJson})`),
  ],
);
