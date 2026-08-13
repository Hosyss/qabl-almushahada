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

export const evidenceReviewPublications = sqliteTable(
  "evidence_review_publications",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    supersedesPublicationId: text("supersedes_publication_id"),
    reviewMethod: text("review_method", { enum: ["evidence_based"] }).notNull().default("evidence_based"),
    humanWatchConfirmed: integer("human_watch_confirmed", { mode: "boolean" }).notNull().default(false),
    publicationGateVersion: text("publication_gate_version").notNull(),
    publishedAt: text("published_at").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("evidence_review_publications_version_revision_unique").on(table.versionId, table.revision),
    uniqueIndex("evidence_review_publications_supersedes_unique").on(table.supersedesPublicationId),
    index("evidence_review_publications_version_idx").on(table.versionId),
    check("evidence_review_publications_revision_check", sql`${table.revision} >= 1`),
    check("evidence_review_publications_method_check", sql`${table.reviewMethod} = 'evidence_based'`),
    check("evidence_review_publications_human_watch_check", sql`${table.humanWatchConfirmed} = 0`),
    check(
      "evidence_review_publications_gate_version_check",
      sql`length(trim(${table.publicationGateVersion})) BETWEEN 1 AND 80`,
    ),
    check("evidence_review_publications_published_at_check", sql`datetime(${table.publishedAt}) IS NOT NULL`),
  ],
);

export const evidencePublicationSources = sqliteTable(
  "evidence_publication_sources",
  {
    publicationId: text("publication_id")
      .notNull()
      .references(() => evidenceReviewPublications.id, { onDelete: "restrict" }),
    evidenceSourceId: text("evidence_source_id")
      .notNull()
      .references(() => versionEvidenceSources.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.publicationId, table.evidenceSourceId] }),
    index("evidence_publication_sources_source_idx").on(table.evidenceSourceId),
  ],
);

export const evidencePublicationAssertions = sqliteTable(
  "evidence_publication_assertions",
  {
    id: text("id").primaryKey(),
    publicationId: text("publication_id")
      .notNull()
      .references(() => evidenceReviewPublications.id, { onDelete: "restrict" }),
    evidenceSourceId: text("evidence_source_id")
      .notNull()
      .references(() => versionEvidenceSources.id, { onDelete: "restrict" }),
    sourceAssertionId: text("source_assertion_id").notNull(),
    category: text("category").notNull(),
    result: text("result", { enum: ["none", "present", "uncertain"] }).notNull(),
    extractionMethod: text("extraction_method", { enum: ["manual", "deterministic", "model_assisted"] }).notNull(),
    extractorVersion: text("extractor_version").notNull(),
    sourceLocator: text("source_locator").notNull(),
    summaryAr: text("summary_ar").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("evidence_publication_assertions_source_category_unique").on(
      table.publicationId,
      table.evidenceSourceId,
      table.category,
    ),
    index("evidence_publication_assertions_publication_category_idx").on(
      table.publicationId,
      table.category,
      table.result,
    ),
    check(
      "evidence_publication_assertions_category_check",
      sql`${table.category} IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')`,
    ),
    check("evidence_publication_assertions_result_check", sql`${table.result} IN ('none', 'present', 'uncertain')`),
    check(
      "evidence_publication_assertions_extraction_check",
      sql`${table.extractionMethod} IN ('manual', 'deterministic', 'model_assisted')`,
    ),
    check(
      "evidence_publication_assertions_model_none_check",
      sql`NOT (${table.extractionMethod} = 'model_assisted' AND ${table.result} = 'none')`,
    ),
    check("evidence_publication_assertions_source_id_check", sql`length(trim(${table.sourceAssertionId})) BETWEEN 1 AND 160`),
    check("evidence_publication_assertions_extractor_check", sql`length(trim(${table.extractorVersion})) BETWEEN 1 AND 120`),
    check("evidence_publication_assertions_locator_check", sql`length(trim(${table.sourceLocator})) BETWEEN 1 AND 500`),
    check("evidence_publication_assertions_summary_check", sql`length(trim(${table.summaryAr})) BETWEEN 1 AND 1000`),
  ],
);

export const evidencePublicationFacts = sqliteTable(
  "evidence_publication_facts",
  {
    id: text("id").primaryKey(),
    publicationId: text("publication_id")
      .notNull()
      .references(() => evidenceReviewPublications.id, { onDelete: "restrict" }),
    assertionId: text("assertion_id")
      .notNull()
      .references(() => evidencePublicationAssertions.id, { onDelete: "restrict" }),
    sourceFactId: text("source_fact_id").notNull(),
    category: text("category").notNull(),
    severity: integer("severity").notNull(),
    frequency: text("frequency").notNull(),
    context: text("context").notNull(),
    spoilerLevel: text("spoiler_level").notNull(),
    summaryAr: text("summary_ar").notNull(),
    startSecond: integer("start_second"),
    endSecond: integer("end_second"),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("evidence_publication_facts_source_fact_unique").on(table.publicationId, table.sourceFactId),
    index("evidence_publication_facts_publication_category_idx").on(
      table.publicationId,
      table.category,
      table.severity,
    ),
    check("evidence_publication_facts_source_id_check", sql`length(trim(${table.sourceFactId})) BETWEEN 1 AND 160`),
    check(
      "evidence_publication_facts_category_check",
      sql`${table.category} IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')`,
    ),
    check("evidence_publication_facts_severity_check", sql`${table.severity} BETWEEN 1 AND 4`),
    check(
      "evidence_publication_facts_frequency_check",
      sql`${table.frequency} IN ('single', 'repeated', 'sustained', 'unknown')`,
    ),
    check(
      "evidence_publication_facts_context_check",
      sql`${table.context} IN ('comic', 'neutral', 'educational', 'threatening', 'distressing', 'unknown')`,
    ),
    check("evidence_publication_facts_spoiler_check", sql`${table.spoilerLevel} IN ('none', 'contextual', 'major')`),
    check("evidence_publication_facts_summary_check", sql`length(trim(${table.summaryAr})) BETWEEN 1 AND 1000`),
    check(
      "evidence_publication_facts_timing_check",
      sql`(${table.startSecond} IS NULL AND ${table.endSecond} IS NULL) OR (${table.startSecond} IS NOT NULL AND ${table.endSecond} IS NOT NULL AND ${table.startSecond} >= 0 AND ${table.endSecond} >= ${table.startSecond})`,
    ),
  ],
);

export const evidencePublicationFactFlags = sqliteTable(
  "evidence_publication_fact_flags",
  {
    factId: text("fact_id")
      .notNull()
      .references(() => evidencePublicationFacts.id, { onDelete: "restrict" }),
    flag: text("flag").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.factId, table.flag] }),
    index("evidence_publication_fact_flags_flag_idx").on(table.flag),
    check(
      "evidence_publication_fact_flags_value_check",
      sql`${table.flag} IN ('jump_scare', 'blood', 'weapon', 'verbal_bullying', 'physical_bullying', 'bereavement', 'separation', 'flashing_sequence', 'nudity', 'kissing', 'intimate_touching', 'sexual_dialogue', 'smoking_or_vaping', 'alcohol_use', 'drug_use', 'gambling_activity', 'religious_reference_or_practice')`,
    ),
  ],
);

export const evidenceReviewPublicationHeads = sqliteTable(
  "evidence_review_publication_heads",
  {
    versionId: text("version_id")
      .primaryKey()
      .references(() => titleVersions.id, { onDelete: "restrict" }),
    currentPublicationId: text("current_publication_id")
      .notNull()
      .references(() => evidenceReviewPublications.id, { onDelete: "restrict" }),
    revision: integer("revision").notNull(),
    lastTransitionId: text("last_transition_id").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("evidence_review_publication_heads_current_unique").on(table.currentPublicationId),
    uniqueIndex("evidence_review_publication_heads_transition_unique").on(table.lastTransitionId),
    check("evidence_review_publication_heads_revision_check", sql`${table.revision} >= 1`),
    check(
      "evidence_review_publication_heads_transition_check",
      sql`length(trim(${table.lastTransitionId})) BETWEEN 1 AND 160`,
    ),
  ],
);
