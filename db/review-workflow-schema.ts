import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import {
  observations,
  reviewBundles,
  reviewSubmissions,
  reviewers,
  titleVersions,
} from "./schema";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () => text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const internalUsers = sqliteTable(
  "internal_users",
  {
    id: text("id").primaryKey(),
    authEmail: text("auth_email").notNull(),
    role: text("role", {
      enum: ["admin", "review_coordinator", "reviewer", "editorial_reviewer"],
    }).notNull(),
    reviewerId: text("reviewer_id").references(() => reviewers.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["active", "suspended"] }).notNull().default("active"),
    revision: integer("revision").notNull().default(0),
    lastTransitionId: text("last_transition_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("internal_users_auth_email_unique").on(table.authEmail),
    index("internal_users_role_status_idx").on(table.role, table.status),
    check("internal_users_email_normalized_check", sql`${table.authEmail} = lower(trim(${table.authEmail}))`),
    check(
      "internal_users_role_check",
      sql`${table.role} IN ('admin', 'review_coordinator', 'reviewer', 'editorial_reviewer')`,
    ),
    check("internal_users_status_check", sql`${table.status} IN ('active', 'suspended')`),
    check("internal_users_revision_check", sql`${table.revision} >= 0`),
    check(
      "internal_users_reviewer_binding_check",
      sql`${table.role} NOT IN ('reviewer', 'editorial_reviewer') OR ${table.reviewerId} IS NOT NULL`,
    ),
  ],
);

export const reviewAssignments = sqliteTable(
  "review_assignments",
  {
    id: text("id").primaryKey(),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => reviewBundles.id, { onDelete: "restrict" }),
    versionId: text("version_id")
      .notNull()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "restrict" }),
    assignedByUserId: text("assigned_by_user_id")
      .notNull()
      .references(() => internalUsers.id, { onDelete: "restrict" }),
    state: text("state", {
      enum: [
        "draft",
        "assigned",
        "in_progress",
        "submitted",
        "changes_requested",
        "approved",
        "conflicted",
      ],
    })
      .notNull()
      .default("draft"),
    revision: integer("revision").notNull().default(0),
    submissionId: text("submission_id"),
    lastTransitionId: text("last_transition_id"),
    assignedAt: text("assigned_at"),
    startedAt: text("started_at"),
    submittedAt: text("submitted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("review_assignments_bundle_reviewer_unique").on(table.bundleId, table.reviewerId),
    uniqueIndex("review_assignments_submission_unique").on(table.submissionId),
    index("review_assignments_reviewer_state_idx").on(table.reviewerId, table.state),
    index("review_assignments_bundle_state_idx").on(table.bundleId, table.state),
    check(
      "review_assignments_state_check",
      sql`${table.state} IN ('draft', 'assigned', 'in_progress', 'submitted', 'changes_requested', 'approved', 'conflicted')`,
    ),
    check("review_assignments_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const reviewAssignmentDrafts = sqliteTable(
  "review_assignment_drafts",
  {
    assignmentId: text("assignment_id")
      .primaryKey()
      .references(() => reviewAssignments.id, { onDelete: "cascade" }),
    payloadJson: text("payload_json").notNull().default("{}"),
    updatedByUserId: text("updated_by_user_id")
      .notNull()
      .references(() => internalUsers.id, { onDelete: "restrict" }),
    updatedAt: updatedAt(),
  },
  (table) => [check("review_assignment_drafts_json_check", sql`json_valid(${table.payloadJson})`)],
);

export const reviewAuditSelections = sqliteTable(
  "review_audit_selections",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => reviewSubmissions.id, { onDelete: "restrict" }),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => reviewAssignments.id, { onDelete: "restrict" }),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => reviewBundles.id, { onDelete: "restrict" }),
    versionId: text("version_id")
      .notNull()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    reviewerId: text("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "restrict" }),
    riskTier: text("risk_tier", { enum: ["baseline", "high_risk"] }).notNull(),
    sampleRateBps: integer("sample_rate_bps").notNull(),
    drawU32: integer("draw_u32").notNull(),
    selected: integer("selected", { mode: "boolean" }).notNull(),
    riskTriggersJson: text("risk_triggers_json").notNull().default("[]"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("review_audit_selections_submission_unique").on(table.submissionId),
    index("review_audit_selections_selected_time_idx").on(table.selected, table.createdAt),
    index("review_audit_selections_reviewer_time_idx").on(table.reviewerId, table.createdAt),
    check("review_audit_selections_risk_tier_check", sql`${table.riskTier} IN ('baseline', 'high_risk')`),
    check("review_audit_selections_rate_check", sql`${table.sampleRateBps} IN (1000, 5000)`),
    check("review_audit_selections_draw_check", sql`${table.drawU32} BETWEEN 0 AND 4294967295`),
    check("review_audit_selections_selected_check", sql`${table.selected} IN (0, 1)`),
    check(
      "review_audit_selections_json_check",
      sql`json_valid(${table.riskTriggersJson}) AND json_type(${table.riskTriggersJson}) = 'array'`,
    ),
  ],
);

export const reviewAuditOutcomes = sqliteTable(
  "review_audit_outcomes",
  {
    id: text("id").primaryKey(),
    selectionId: text("selection_id")
      .notNull()
      .references(() => reviewAuditSelections.id, { onDelete: "restrict" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => reviewSubmissions.id, { onDelete: "restrict" }),
    assignmentId: text("assignment_id")
      .notNull()
      .references(() => reviewAssignments.id, { onDelete: "restrict" }),
    bundleId: text("bundle_id")
      .notNull()
      .references(() => reviewBundles.id, { onDelete: "restrict" }),
    versionId: text("version_id")
      .notNull()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    subjectReviewerId: text("subject_reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "restrict" }),
    auditorUserId: text("auditor_user_id")
      .notNull()
      .references(() => internalUsers.id, { onDelete: "restrict" }),
    auditorReviewerId: text("auditor_reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "restrict" }),
    status: text("status", { enum: ["pending", "confirmed", "correction_required"] })
      .notNull()
      .default("pending"),
    notes: text("notes").notNull().default(""),
    revision: integer("revision").notNull().default(0),
    finalTransitionId: text("final_transition_id"),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("review_audit_outcomes_selection_unique").on(table.selectionId),
    uniqueIndex("review_audit_outcomes_transition_unique").on(table.finalTransitionId),
    index("review_audit_outcomes_subject_time_idx").on(table.subjectReviewerId, table.completedAt),
    index("review_audit_outcomes_auditor_time_idx").on(table.auditorReviewerId, table.completedAt),
    check(
      "review_audit_outcomes_status_check",
      sql`${table.status} IN ('pending', 'confirmed', 'correction_required')`,
    ),
    check("review_audit_outcomes_revision_check", sql`${table.revision} IN (0, 1)`),
    check("review_audit_outcomes_notes_check", sql`length(${table.notes}) <= 4000`),
  ],
);

export const reviewAuditFindings = sqliteTable(
  "review_audit_findings",
  {
    id: text("id").primaryKey(),
    outcomeId: text("outcome_id")
      .notNull()
      .references(() => reviewAuditOutcomes.id, { onDelete: "restrict" }),
    findingType: text("finding_type", { enum: ["missed_event", "severity_difference"] }).notNull(),
    category: text("category").notNull(),
    targetObservationId: text("target_observation_id").references(() => observations.id, {
      onDelete: "restrict",
    }),
    reviewerSeverity: integer("reviewer_severity"),
    auditorSeverity: integer("auditor_severity").notNull(),
    startSecond: integer("start_second"),
    endSecond: integer("end_second"),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("review_audit_findings_observation_unique").on(table.outcomeId, table.targetObservationId),
    index("review_audit_findings_type_idx").on(table.findingType, table.createdAt),
    check(
      "review_audit_findings_type_check",
      sql`${table.findingType} IN ('missed_event', 'severity_difference')`,
    ),
    check(
      "review_audit_findings_category_check",
      sql`${table.category} IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')`,
    ),
    check(
      "review_audit_findings_auditor_severity_check",
      sql`${table.auditorSeverity} BETWEEN 1 AND 4`,
    ),
    check(
      "review_audit_findings_reviewer_severity_check",
      sql`${table.reviewerSeverity} IS NULL OR ${table.reviewerSeverity} BETWEEN 1 AND 4`,
    ),
    check(
      "review_audit_findings_summary_check",
      sql`length(trim(${table.summary})) BETWEEN 5 AND 1000`,
    ),
  ],
);

/** Global internal-security audit log. Rows are made immutable by SQL triggers in migrations. */
export const internalAuditEvents = sqliteTable(
  "internal_audit_events",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => internalUsers.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payloadJson: text("payload_json").notNull().default("{}"),
    createdAt: createdAt(),
  },
  (table) => [
    index("internal_audit_events_actor_time_idx").on(table.actorUserId, table.createdAt),
    index("internal_audit_events_entity_idx").on(table.entityType, table.entityId),
    check("internal_audit_events_json_check", sql`json_valid(${table.payloadJson})`),
  ],
);
