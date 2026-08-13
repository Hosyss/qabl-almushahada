import { sql } from "drizzle-orm";
import { check, index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { titles } from "./schema.ts";

export const titleSourceRecords = sqliteTable(
  "title_source_records",
  {
    id: text("id").primaryKey(),
    titleId: text("title_id")
      .notNull()
      .references(() => titles.id, { onDelete: "cascade" }),
    sourceKey: text("source_key").notNull(),
    sourceEntityId: text("source_entity_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    sourceLicense: text("source_license").notNull(),
    retrievedAt: text("retrieved_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("title_source_records_source_entity_unique").on(
      table.sourceKey,
      table.sourceEntityId,
    ),
    index("title_source_records_title_idx").on(table.titleId),
    check("title_source_records_source_key_check", sql`${table.sourceKey} = 'wikidata'`),
    check("title_source_records_source_license_check", sql`${table.sourceLicense} = 'CC0 1.0'`),
    check("title_source_records_entity_check", sql`length(trim(${table.sourceEntityId})) > 0`),
    check(
      "title_source_records_url_check",
      sql`${table.sourceUrl} LIKE 'https://www.wikidata.org/wiki/Q%'`,
    ),
  ],
);
