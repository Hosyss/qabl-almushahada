CREATE TABLE `content_source_policy_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`policy_version` text NOT NULL,
	`use_scope` text NOT NULL,
	`decision` text NOT NULL,
	`license_label` text NOT NULL,
	`license_url` text NOT NULL,
	`policy_url` text NOT NULL,
	`attribution_required` integer NOT NULL,
	`share_alike` integer NOT NULL,
	`automated_ingestion_allowed` integer NOT NULL,
	`commercial_use_allowed` integer NOT NULL,
	`verified_on` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "content_source_policy_use_scope_check" CHECK(`use_scope` IN ('catalog_metadata', 'analysis_evidence', 'media')),
	CONSTRAINT "content_source_policy_decision_check" CHECK(`decision` IN ('allow', 'allow_with_attribution', 'per_item_license', 'manual_reference_only', 'blocked_without_commercial_license')),
	CONSTRAINT "content_source_policy_boolean_check" CHECK(`attribution_required` IN (0, 1) AND `share_alike` IN (0, 1) AND `automated_ingestion_allowed` IN (0, 1) AND `commercial_use_allowed` IN (0, 1)),
	CONSTRAINT "content_source_policy_version_check" CHECK(length(trim(`policy_version`)) BETWEEN 1 AND 64),
	CONSTRAINT "content_source_policy_license_url_check" CHECK(`license_url` LIKE 'https://%'),
	CONSTRAINT "content_source_policy_policy_url_check" CHECK(`policy_url` LIKE 'https://%'),
	CONSTRAINT "content_source_policy_current_allowlist_check" CHECK(
		`source_key` = 'wikidata'
		AND `use_scope` = 'catalog_metadata'
		AND `decision` = 'allow'
		AND `license_label` = 'CC0 1.0'
		AND `license_url` = 'https://creativecommons.org/publicdomain/zero/1.0/'
		AND `policy_url` = 'https://www.wikidata.org/wiki/Wikidata:Licensing'
		AND `attribution_required` = 0
		AND `share_alike` = 0
		AND `automated_ingestion_allowed` = 1
		AND `commercial_use_allowed` = 1
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_source_policy_snapshot_unique` ON `content_source_policy_snapshots` (`source_key`,`policy_version`,`use_scope`);
--> statement-breakpoint
CREATE INDEX `content_source_policy_scope_idx` ON `content_source_policy_snapshots` (`use_scope`,`commercial_use_allowed`);
--> statement-breakpoint
INSERT INTO `content_source_policy_snapshots` (
	`id`,
	`source_key`,
	`policy_version`,
	`use_scope`,
	`decision`,
	`license_label`,
	`license_url`,
	`policy_url`,
	`attribution_required`,
	`share_alike`,
	`automated_ingestion_allowed`,
	`commercial_use_allowed`,
	`verified_on`
) VALUES (
	'source-policy:wikidata:2026-08-13.1:catalog_metadata',
	'wikidata',
	'2026-08-13.1',
	'catalog_metadata',
	'allow',
	'CC0 1.0',
	'https://creativecommons.org/publicdomain/zero/1.0/',
	'https://www.wikidata.org/wiki/Wikidata:Licensing',
	0,
	0,
	1,
	1,
	'2026-08-13'
);
--> statement-breakpoint
CREATE TRIGGER `content_source_policy_snapshots_no_update`
BEFORE UPDATE ON `content_source_policy_snapshots`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'content source policy snapshots are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `content_source_policy_snapshots_no_delete`
BEFORE DELETE ON `content_source_policy_snapshots`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'content source policy snapshots are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `title_catalog_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`policy_snapshot_id` text NOT NULL,
	`source_entity_id` text NOT NULL,
	`source_url` text NOT NULL,
	`source_revision` text,
	`retrieved_at` text NOT NULL,
	`content_sha256` text NOT NULL,
	`ingestion_mode` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`policy_snapshot_id`) REFERENCES `content_source_policy_snapshots`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "title_catalog_sources_entity_check" CHECK(length(trim(`source_entity_id`)) BETWEEN 2 AND 160),
	CONSTRAINT "title_catalog_sources_url_check" CHECK(`source_url` LIKE 'https://%'),
	CONSTRAINT "title_catalog_sources_hash_check" CHECK(length(`content_sha256`) = 64 AND `content_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "title_catalog_sources_mode_check" CHECK(`ingestion_mode` IN ('manual', 'automated')),
	CONSTRAINT "title_catalog_sources_retrieved_at_check" CHECK(datetime(`retrieved_at`) IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `title_catalog_sources_entity_unique` ON `title_catalog_sources` (`policy_snapshot_id`,`source_entity_id`,`content_sha256`);
--> statement-breakpoint
CREATE INDEX `title_catalog_sources_title_idx` ON `title_catalog_sources` (`title_id`);
--> statement-breakpoint
CREATE INDEX `title_catalog_sources_policy_idx` ON `title_catalog_sources` (`policy_snapshot_id`);
--> statement-breakpoint
CREATE TRIGGER `title_catalog_sources_policy_guard`
BEFORE INSERT ON `title_catalog_sources`
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `content_source_policy_snapshots` AS p
		WHERE p.`id` = NEW.`policy_snapshot_id`
			AND p.`use_scope` = 'catalog_metadata'
			AND p.`commercial_use_allowed` = 1
			AND (NEW.`ingestion_mode` <> 'automated' OR p.`automated_ingestion_allowed` = 1)
	) THEN RAISE(ABORT, 'catalog provenance requires an allowed commercial catalog policy snapshot') END;
END;
--> statement-breakpoint
CREATE TRIGGER `title_catalog_sources_wikidata_identity_guard`
BEFORE INSERT ON `title_catalog_sources`
WHEN EXISTS (
	SELECT 1 FROM `content_source_policy_snapshots` AS p
	WHERE p.`id` = NEW.`policy_snapshot_id` AND p.`source_key` = 'wikidata'
)
BEGIN
	SELECT CASE WHEN NOT (
		NEW.`source_entity_id` GLOB 'Q[0-9]*'
		AND substr(NEW.`source_entity_id`, 2) NOT GLOB '*[^0-9]*'
		AND NEW.`source_url` = 'https://www.wikidata.org/wiki/' || NEW.`source_entity_id`
	) THEN RAISE(ABORT, 'invalid Wikidata catalog provenance identity') END;
END;
--> statement-breakpoint
CREATE TRIGGER `title_catalog_sources_no_update`
BEFORE UPDATE ON `title_catalog_sources`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'title catalog provenance is append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `title_catalog_sources_no_delete`
BEFORE DELETE ON `title_catalog_sources`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'title catalog provenance is append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `version_evidence_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`policy_snapshot_id` text NOT NULL,
	`source_url` text NOT NULL,
	`source_revision` text,
	`source_license` text NOT NULL,
	`license_url` text NOT NULL,
	`attribution_text` text,
	`retrieved_at` text NOT NULL,
	`content_sha256` text NOT NULL,
	`ingestion_mode` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`policy_snapshot_id`) REFERENCES `content_source_policy_snapshots`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "version_evidence_sources_url_check" CHECK(`source_url` LIKE 'https://%'),
	CONSTRAINT "version_evidence_sources_license_url_check" CHECK(`license_url` LIKE 'https://%'),
	CONSTRAINT "version_evidence_sources_license_check" CHECK(length(trim(`source_license`)) BETWEEN 1 AND 160),
	CONSTRAINT "version_evidence_sources_hash_check" CHECK(length(`content_sha256`) = 64 AND `content_sha256` NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "version_evidence_sources_mode_check" CHECK(`ingestion_mode` IN ('manual', 'automated')),
	CONSTRAINT "version_evidence_sources_retrieved_at_check" CHECK(datetime(`retrieved_at`) IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `version_evidence_sources_hash_unique` ON `version_evidence_sources` (`version_id`,`policy_snapshot_id`,`content_sha256`);
--> statement-breakpoint
CREATE INDEX `version_evidence_sources_version_idx` ON `version_evidence_sources` (`version_id`);
--> statement-breakpoint
CREATE INDEX `version_evidence_sources_policy_idx` ON `version_evidence_sources` (`policy_snapshot_id`);
--> statement-breakpoint
CREATE TRIGGER `version_evidence_sources_policy_guard`
BEFORE INSERT ON `version_evidence_sources`
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `content_source_policy_snapshots` AS p
		WHERE p.`id` = NEW.`policy_snapshot_id`
			AND p.`use_scope` = 'analysis_evidence'
			AND p.`commercial_use_allowed` = 1
			AND NEW.`source_license` = p.`license_label`
			AND NEW.`license_url` = p.`license_url`
			AND (NEW.`ingestion_mode` <> 'automated' OR p.`automated_ingestion_allowed` = 1)
			AND (p.`attribution_required` = 0 OR length(trim(COALESCE(NEW.`attribution_text`, ''))) > 0)
	) THEN RAISE(ABORT, 'evidence provenance requires an allowed commercial analysis-evidence policy snapshot') END;
END;
--> statement-breakpoint
CREATE TRIGGER `version_evidence_sources_no_update`
BEFORE UPDATE ON `version_evidence_sources`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'version evidence provenance is append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `version_evidence_sources_no_delete`
BEFORE DELETE ON `version_evidence_sources`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'version evidence provenance is append-only') END;
END;
