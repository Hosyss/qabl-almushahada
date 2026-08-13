CREATE TABLE `title_source_records` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`source_key` text NOT NULL,
	`source_entity_id` text NOT NULL,
	`source_url` text NOT NULL,
	`source_license` text NOT NULL,
	`retrieved_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "title_source_records_source_key_check" CHECK(`source_key` = 'wikidata'),
	CONSTRAINT "title_source_records_source_license_check" CHECK(`source_license` = 'CC0 1.0'),
	CONSTRAINT "title_source_records_entity_check" CHECK(length(trim(`source_entity_id`)) > 0),
	CONSTRAINT "title_source_records_url_check" CHECK(`source_url` LIKE 'https://www.wikidata.org/wiki/Q%')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `title_source_records_source_entity_unique` ON `title_source_records` (`source_key`,`source_entity_id`);
--> statement-breakpoint
CREATE INDEX `title_source_records_title_idx` ON `title_source_records` (`title_id`);
