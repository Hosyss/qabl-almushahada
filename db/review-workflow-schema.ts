import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { reviewBundles, reviewers, titleVersions } from "./schema";

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
