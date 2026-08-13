import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { titles, titleVersions } from "./schema.ts";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const contentSourcePolicySnapshots = sqliteTable(
  "content_source_policy_snapshots",
  {
    id: text("id").primaryKey(),
    sourceKey: text("source_key").notNull(),
    policyVersion: text("policy_version").notNull(),
    useScope: text("use_scope").notNull(),
    decision: text("decision").notNull(),
    licenseLabel: text("license_label").notNull(),
    licenseUrl: text("license_url").notNull(),
    policyUrl: text("policy_url").notNull(),
    attributionRequired: integer("attribution_required", { mode: "boolean" }).notNull(),
    shareAlike: integer("share_alike", { mode: "boolean" }).notNull(),
    automatedIngestionAllowed: integer("automated_ingestion_allowed", { mode: "boolean" }).notNull(),
    commercialUseAllowed: integer("commercial_use_allowed", { mode: "boolean" }).notNull(),
    verifiedOn: text("verified_on").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("content_source_policy_snapshot_unique").on(
      table.sourceKey,
      table.policyVersion,
      table.useScope,
    ),
    index("content_source_policy_scope_idx").on(table.useScope, table.commercialUseAllowed),
    check(
      "content_source_policy_use_scope_check",
      sql`${table.useScope} IN ('catalog_metadata', 'analysis_evidence', 'media')`,
    ),
    check(
      "content_source_policy_decision_check",
      sql`${table.decision} IN ('allow', 'allow_with_attribution', 'per_item_license', 'manual_reference_only', 'blocked_without_commercial_license')`,
    ),
    check(
      "content_source_policy_boolean_check",
      sql`${table.attributionRequired} IN (0, 1) AND ${table.shareAlike} IN (0, 1) AND ${table.automatedIngestionAllowed} IN (0, 1) AND ${table.commercialUseAllowed} IN (0, 1)`,
    ),
    check("content_source_policy_version_check", sql`length(trim(${table.policyVersion})) BETWEEN 1 AND 64`),
    check("content_source_policy_license_url_check", sql`${table.licenseUrl} LIKE 'https://%'`),
    check("content_source_policy_policy_url_check", sql`${table.policyUrl} LIKE 'https://%'`),
    check(
      "content_source_policy_current_allowlist_check",
      sql`(
          ${table.sourceKey} = 'wikidata'
          AND ${table.useScope} = 'catalog_metadata'
          AND ${table.decision} = 'allow'
          AND ${table.licenseLabel} = 'CC0 1.0'
          AND ${table.licenseUrl} = 'https://creativecommons.org/publicdomain/zero/1.0/'
          AND ${table.policyUrl} = 'https://www.wikidata.org/wiki/Wikidata:Licensing'
          AND ${table.attributionRequired} = 0
          AND ${table.shareAlike} = 0
          AND ${table.automatedIngestionAllowed} = 1
          AND ${table.commercialUseAllowed} = 1
        ) OR (
          ${table.sourceKey} = 'wikipedia'
          AND ${table.useScope} = 'analysis_evidence'
          AND ${table.decision} = 'allow_with_attribution'
          AND ${table.licenseLabel} = 'CC BY-SA 4.0'
          AND ${table.licenseUrl} = 'https://creativecommons.org/licenses/by-sa/4.0/'
          AND ${table.policyUrl} = 'https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use'
          AND ${table.attributionRequired} = 1
          AND ${table.shareAlike} = 1
          AND ${table.automatedIngestionAllowed} = 1
          AND ${table.commercialUseAllowed} = 1
        )`,
    ),
  ],
);

export const titleCatalogSources = sqliteTable(
  "title_catalog_sources",
  {
    id: text("id").primaryKey(),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "restrict" }),
    policySnapshotId: text("policy_snapshot_id")
      .notNull()
      .references(() => contentSourcePolicySnapshots.id, { onDelete: "restrict" }),
    sourceEntityId: text("source_entity_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceRevision: text("source_revision"),
    retrievedAt: text("retrieved_at").notNull(),
    contentSha256: text("content_sha256").notNull(),
    ingestionMode: text("ingestion_mode").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("title_catalog_sources_entity_unique").on(
      table.policySnapshotId,
      table.sourceEntityId,
      table.contentSha256,
    ),
    index("title_catalog_sources_title_idx").on(table.titleId),
    index("title_catalog_sources_policy_idx").on(table.policySnapshotId),
    check("title_catalog_sources_entity_check", sql`length(trim(${table.sourceEntityId})) BETWEEN 2 AND 160`),
    check("title_catalog_sources_url_check", sql`${table.sourceUrl} LIKE 'https://%'`),
    check(
      "title_catalog_sources_hash_check",
      sql`length(${table.contentSha256}) = 64 AND ${table.contentSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "title_catalog_sources_mode_check",
      sql`${table.ingestionMode} IN ('manual', 'automated')`,
    ),
    check("title_catalog_sources_retrieved_at_check", sql`datetime(${table.retrievedAt}) IS NOT NULL`),
  ],
);

export const versionEvidenceSources = sqliteTable(
  "version_evidence_sources",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    policySnapshotId: text("policy_snapshot_id")
      .notNull()
      .references(() => contentSourcePolicySnapshots.id, { onDelete: "restrict" }),
    sourceUrl: text("source_url").notNull(),
    sourceRevision: text("source_revision"),
    sourceLicense: text("source_license").notNull(),
    licenseUrl: text("license_url").notNull(),
    attributionText: text("attribution_text"),
    retrievedAt: text("retrieved_at").notNull(),
    contentSha256: text("content_sha256").notNull(),
    ingestionMode: text("ingestion_mode").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("version_evidence_sources_hash_unique").on(
      table.versionId,
      table.policySnapshotId,
      table.contentSha256,
    ),
    index("version_evidence_sources_version_idx").on(table.versionId),
    index("version_evidence_sources_policy_idx").on(table.policySnapshotId),
    check("version_evidence_sources_url_check", sql`${table.sourceUrl} LIKE 'https://%'`),
    check("version_evidence_sources_license_url_check", sql`${table.licenseUrl} LIKE 'https://%'`),
    check("version_evidence_sources_license_check", sql`length(trim(${table.sourceLicense})) BETWEEN 1 AND 160`),
    check(
      "version_evidence_sources_hash_check",
      sql`length(${table.contentSha256}) = 64 AND ${table.contentSha256} NOT GLOB '*[^0-9a-f]*'`,
    ),
    check(
      "version_evidence_sources_mode_check",
      sql`${table.ingestionMode} IN ('manual', 'automated')`,
    ),
    check("version_evidence_sources_retrieved_at_check", sql`datetime(${table.retrievedAt}) IS NOT NULL`),
  ],
);
