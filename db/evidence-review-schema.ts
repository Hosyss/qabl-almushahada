import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { versionEvidenceSources } from "./content-source-schema.ts";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const evidenceCategoryAssertions = sqliteTable(
  "evidence_category_assertions",
  {
    id: text("id").primaryKey(),
    evidenceSourceId: text("evidence_source_id")
      .notNull()
      .references(() => versionEvidenceSources.id, { onDelete: "restrict" }),
    category: text("category").notNull(),
    result: text("result").notNull(),
    extractionMethod: text("extraction_method").notNull(),
    extractorVersion: text("extractor_version").notNull(),
    sourceLocator: text("source_locator").notNull(),
    summaryAr: text("summary_ar").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("evidence_category_assertion_source_locator_unique").on(
      table.evidenceSourceId,
      table.category,
      table.sourceLocator,
      table.id,
    ),
    index("evidence_category_assertion_source_idx").on(table.evidenceSourceId),
    index("evidence_category_assertion_category_idx").on(table.category, table.result),
    check(
      "evidence_category_assertion_category_check",
      sql`${table.category} IN ('fear','violence','language','bullying','sexualContent','substances','discrimination','selfHarm','grief','flashingLights')`,
    ),
    check(
      "evidence_category_assertion_result_check",
      sql`${table.result} IN ('none','present','uncertain')`,
    ),
    check(
      "evidence_category_assertion_method_check",
      sql`${table.extractionMethod} IN ('manual','deterministic','model_assisted')`,
    ),
    check(
      "evidence_category_assertion_extractor_check",
      sql`length(trim(${table.extractorVersion})) BETWEEN 1 AND 120`,
    ),
    check(
      "evidence_category_assertion_locator_check",
      sql`length(trim(${table.sourceLocator})) BETWEEN 1 AND 500`,
    ),
    check(
      "evidence_category_assertion_summary_check",
      sql`length(trim(${table.summaryAr})) BETWEEN 1 AND 1000`,
    ),
  ],
);

export const evidenceFacts = sqliteTable(
  "evidence_facts",
  {
    id: text("id").primaryKey(),
    assertionId: text("assertion_id")
      .notNull()
      .references(() => evidenceCategoryAssertions.id, { onDelete: "restrict" }),
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
    index("evidence_fact_assertion_idx").on(table.assertionId),
    index("evidence_fact_category_severity_idx").on(table.category, table.severity),
    check(
      "evidence_fact_category_check",
      sql`${table.category} IN ('fear','violence','language','bullying','sexualContent','substances','discrimination','selfHarm','grief','flashingLights')`,
    ),
    check("evidence_fact_severity_check", sql`${table.severity} BETWEEN 1 AND 4`),
    check(
      "evidence_fact_frequency_check",
      sql`${table.frequency} IN ('single','repeated','sustained','unknown')`,
    ),
    check(
      "evidence_fact_context_check",
      sql`${table.context} IN ('comic','neutral','educational','threatening','distressing','unknown')`,
    ),
    check(
      "evidence_fact_spoiler_check",
      sql`${table.spoilerLevel} IN ('none','contextual','major')`,
    ),
    check(
      "evidence_fact_summary_check",
      sql`length(trim(${table.summaryAr})) BETWEEN 1 AND 1000`,
    ),
    check(
      "evidence_fact_timing_check",
      sql`(${table.startSecond} IS NULL AND ${table.endSecond} IS NULL) OR (${table.startSecond} >= 0 AND ${table.endSecond} >= ${table.startSecond})`,
    ),
  ],
);

export const evidenceFactFlags = sqliteTable(
  "evidence_fact_flags",
  {
    factId: text("fact_id")
      .notNull()
      .references(() => evidenceFacts.id, { onDelete: "restrict" }),
    flag: text("flag").notNull(),
  },
  (table) => [
    uniqueIndex("evidence_fact_flag_unique").on(table.factId, table.flag),
    index("evidence_fact_flag_idx").on(table.flag),
    check(
      "evidence_fact_flag_check",
      sql`${table.flag} IN ('jump_scare','blood','weapon','verbal_bullying','physical_bullying','bereavement','separation','flashing_sequence')`,
    ),
  ],
);
