CREATE TABLE `evidence_review_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`revision` integer NOT NULL,
	`supersedes_publication_id` text,
	`review_method` text NOT NULL DEFAULT 'evidence_based',
	`human_watch_confirmed` integer NOT NULL DEFAULT 0,
	`publication_gate_version` text NOT NULL,
	`published_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supersedes_publication_id`) REFERENCES `evidence_review_publications`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_review_publications_revision_check" CHECK(`revision` >= 1),
	CONSTRAINT "evidence_review_publications_method_check" CHECK(`review_method` = 'evidence_based'),
	CONSTRAINT "evidence_review_publications_human_watch_check" CHECK(`human_watch_confirmed` = 0),
	CONSTRAINT "evidence_review_publications_gate_version_check" CHECK(length(trim(`publication_gate_version`)) BETWEEN 1 AND 80),
	CONSTRAINT "evidence_review_publications_published_at_check" CHECK(datetime(`published_at`) IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_review_publications_version_revision_unique` ON `evidence_review_publications` (`version_id`,`revision`);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_review_publications_supersedes_unique` ON `evidence_review_publications` (`supersedes_publication_id`) WHERE `supersedes_publication_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `evidence_review_publications_version_idx` ON `evidence_review_publications` (`version_id`);
--> statement-breakpoint
CREATE TRIGGER `evidence_review_publications_lineage_guard`
BEFORE INSERT ON `evidence_review_publications`
BEGIN
	SELECT CASE WHEN NEW.`revision` = 1 AND NEW.`supersedes_publication_id` IS NOT NULL
		THEN RAISE(ABORT, 'first evidence publication revision cannot supersede another publication') END;
	SELECT CASE WHEN NEW.`revision` > 1 AND NOT EXISTS (
		SELECT 1 FROM `evidence_review_publications` AS previous
		WHERE previous.`id` = NEW.`supersedes_publication_id`
			AND previous.`version_id` = NEW.`version_id`
			AND previous.`revision` = NEW.`revision` - 1
	) THEN RAISE(ABORT, 'evidence publication revision lineage is invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_review_publications_no_update`
BEFORE UPDATE ON `evidence_review_publications`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication snapshots are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_review_publications_no_delete`
BEFORE DELETE ON `evidence_review_publications`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication snapshots are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `evidence_publication_sources` (
	`publication_id` text NOT NULL,
	`evidence_source_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`publication_id`,`evidence_source_id`),
	FOREIGN KEY (`publication_id`) REFERENCES `evidence_review_publications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evidence_source_id`) REFERENCES `version_evidence_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `evidence_publication_sources_source_idx` ON `evidence_publication_sources` (`evidence_source_id`);
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_sources_guard`
BEFORE INSERT ON `evidence_publication_sources`
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `evidence_review_publications` AS publication
		INNER JOIN `version_evidence_sources` AS source ON source.`id` = NEW.`evidence_source_id`
		INNER JOIN `content_source_policy_snapshots` AS policy ON policy.`id` = source.`policy_snapshot_id`
		WHERE publication.`id` = NEW.`publication_id`
			AND source.`version_id` = publication.`version_id`
			AND policy.`use_scope` = 'analysis_evidence'
			AND policy.`commercial_use_allowed` = 1
			AND source.`source_license` = policy.`license_label`
			AND source.`license_url` = policy.`license_url`
			AND (source.`ingestion_mode` <> 'automated' OR policy.`automated_ingestion_allowed` = 1)
			AND (policy.`attribution_required` = 0 OR length(trim(COALESCE(source.`attribution_text`, ''))) >= 20)
	) THEN RAISE(ABORT, 'publication source must be licensed analysis evidence for the same version') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_sources_no_update`
BEFORE UPDATE ON `evidence_publication_sources`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication source links are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_sources_no_delete`
BEFORE DELETE ON `evidence_publication_sources`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication source links are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `evidence_publication_assertions` (
	`id` text PRIMARY KEY NOT NULL,
	`publication_id` text NOT NULL,
	`evidence_source_id` text NOT NULL,
	`source_assertion_id` text NOT NULL,
	`category` text NOT NULL,
	`result` text NOT NULL,
	`extraction_method` text NOT NULL,
	`extractor_version` text NOT NULL,
	`source_locator` text NOT NULL,
	`summary_ar` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `evidence_review_publications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`evidence_source_id`) REFERENCES `version_evidence_sources`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_publication_assertions_category_check" CHECK(`category` IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')),
	CONSTRAINT "evidence_publication_assertions_result_check" CHECK(`result` IN ('none', 'present', 'uncertain')),
	CONSTRAINT "evidence_publication_assertions_extraction_check" CHECK(`extraction_method` IN ('manual', 'deterministic', 'model_assisted')),
	CONSTRAINT "evidence_publication_assertions_model_none_check" CHECK(NOT (`extraction_method` = 'model_assisted' AND `result` = 'none')),
	CONSTRAINT "evidence_publication_assertions_source_id_check" CHECK(length(trim(`source_assertion_id`)) BETWEEN 1 AND 160),
	CONSTRAINT "evidence_publication_assertions_extractor_check" CHECK(length(trim(`extractor_version`)) BETWEEN 1 AND 120),
	CONSTRAINT "evidence_publication_assertions_locator_check" CHECK(length(trim(`source_locator`)) BETWEEN 1 AND 500),
	CONSTRAINT "evidence_publication_assertions_summary_check" CHECK(length(trim(`summary_ar`)) BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_publication_assertions_source_category_unique` ON `evidence_publication_assertions` (`publication_id`,`evidence_source_id`,`category`);
--> statement-breakpoint
CREATE INDEX `evidence_publication_assertions_publication_category_idx` ON `evidence_publication_assertions` (`publication_id`,`category`,`result`);
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_assertions_source_guard`
BEFORE INSERT ON `evidence_publication_assertions`
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `evidence_publication_sources` AS link
		WHERE link.`publication_id` = NEW.`publication_id`
			AND link.`evidence_source_id` = NEW.`evidence_source_id`
	) THEN RAISE(ABORT, 'every published evidence claim must link to a publication source') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_assertions_no_update`
BEFORE UPDATE ON `evidence_publication_assertions`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication assertions are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_assertions_no_delete`
BEFORE DELETE ON `evidence_publication_assertions`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication assertions are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `evidence_publication_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`publication_id` text NOT NULL,
	`assertion_id` text NOT NULL,
	`source_fact_id` text NOT NULL,
	`category` text NOT NULL,
	`severity` integer NOT NULL,
	`frequency` text NOT NULL,
	`context` text NOT NULL,
	`spoiler_level` text NOT NULL,
	`summary_ar` text NOT NULL,
	`start_second` integer,
	`end_second` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`publication_id`) REFERENCES `evidence_review_publications`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`assertion_id`) REFERENCES `evidence_publication_assertions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_publication_facts_source_id_check" CHECK(length(trim(`source_fact_id`)) BETWEEN 1 AND 160),
	CONSTRAINT "evidence_publication_facts_category_check" CHECK(`category` IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')),
	CONSTRAINT "evidence_publication_facts_severity_check" CHECK(`severity` BETWEEN 1 AND 4),
	CONSTRAINT "evidence_publication_facts_frequency_check" CHECK(`frequency` IN ('single', 'repeated', 'sustained', 'unknown')),
	CONSTRAINT "evidence_publication_facts_context_check" CHECK(`context` IN ('comic', 'neutral', 'educational', 'threatening', 'distressing', 'unknown')),
	CONSTRAINT "evidence_publication_facts_spoiler_check" CHECK(`spoiler_level` IN ('none', 'contextual', 'major')),
	CONSTRAINT "evidence_publication_facts_summary_check" CHECK(length(trim(`summary_ar`)) BETWEEN 1 AND 1000),
	CONSTRAINT "evidence_publication_facts_timing_check" CHECK(
		(`start_second` IS NULL AND `end_second` IS NULL)
		OR (`start_second` IS NOT NULL AND `end_second` IS NOT NULL AND `start_second` >= 0 AND `end_second` >= `start_second`)
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_publication_facts_source_fact_unique` ON `evidence_publication_facts` (`publication_id`,`source_fact_id`);
--> statement-breakpoint
CREATE INDEX `evidence_publication_facts_publication_category_idx` ON `evidence_publication_facts` (`publication_id`,`category`,`severity`);
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_facts_assertion_guard`
BEFORE INSERT ON `evidence_publication_facts`
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `evidence_publication_assertions` AS assertion
		WHERE assertion.`id` = NEW.`assertion_id`
			AND assertion.`publication_id` = NEW.`publication_id`
			AND assertion.`category` = NEW.`category`
			AND assertion.`result` = 'present'
	) THEN RAISE(ABORT, 'published evidence facts require a matching present assertion') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_facts_no_update`
BEFORE UPDATE ON `evidence_publication_facts`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication facts are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_facts_no_delete`
BEFORE DELETE ON `evidence_publication_facts`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication facts are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `evidence_publication_fact_flags` (
	`fact_id` text NOT NULL,
	`flag` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`fact_id`,`flag`),
	FOREIGN KEY (`fact_id`) REFERENCES `evidence_publication_facts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_publication_fact_flags_value_check" CHECK(`flag` IN ('jump_scare', 'blood', 'weapon', 'verbal_bullying', 'physical_bullying', 'bereavement', 'separation', 'flashing_sequence'))
);
--> statement-breakpoint
CREATE INDEX `evidence_publication_fact_flags_flag_idx` ON `evidence_publication_fact_flags` (`flag`);
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_fact_flags_no_update`
BEFORE UPDATE ON `evidence_publication_fact_flags`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication fact flags are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_fact_flags_no_delete`
BEFORE DELETE ON `evidence_publication_fact_flags`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication fact flags are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `evidence_review_publication_heads` (
	`version_id` text PRIMARY KEY NOT NULL,
	`current_publication_id` text NOT NULL,
	`revision` integer NOT NULL,
	`last_transition_id` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`current_publication_id`) REFERENCES `evidence_review_publications`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_review_publication_heads_revision_check" CHECK(`revision` >= 1),
	CONSTRAINT "evidence_review_publication_heads_transition_check" CHECK(length(trim(`last_transition_id`)) BETWEEN 1 AND 160)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_review_publication_heads_current_unique` ON `evidence_review_publication_heads` (`current_publication_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_review_publication_heads_transition_unique` ON `evidence_review_publication_heads` (`last_transition_id`);
--> statement-breakpoint
CREATE TRIGGER `evidence_review_publication_heads_insert_gate`
BEFORE INSERT ON `evidence_review_publication_heads`
BEGIN
	SELECT CASE WHEN NEW.`revision` <> 1 THEN RAISE(ABORT, 'first evidence publication head revision must be one') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `evidence_review_publications` AS publication
		INNER JOIN `title_versions` AS version ON version.`id` = publication.`version_id`
		WHERE publication.`id` = NEW.`current_publication_id`
			AND publication.`version_id` = NEW.`version_id`
			AND publication.`revision` = NEW.`revision`
			AND publication.`supersedes_publication_id` IS NULL
			AND publication.`review_method` = 'evidence_based'
			AND publication.`human_watch_confirmed` = 0
			AND version.`status` = 'active'
	) THEN RAISE(ABORT, 'evidence publication head requires a current active-version publication snapshot') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `evidence_publication_sources` WHERE `publication_id` = NEW.`current_publication_id`
	) THEN RAISE(ABORT, 'evidence publication requires at least one licensed source') END;
	SELECT CASE WHEN (
		SELECT COUNT(DISTINCT `category`)
		FROM `evidence_publication_assertions`
		WHERE `publication_id` = NEW.`current_publication_id` AND `result` IN ('none', 'present')
	) <> 10 THEN RAISE(ABORT, 'evidence publication does not explicitly cover every content category') END;
	SELECT CASE WHEN EXISTS (
		SELECT `category`
		FROM `evidence_publication_assertions`
		WHERE `publication_id` = NEW.`current_publication_id` AND `result` IN ('none', 'present')
		GROUP BY `category`
		HAVING COUNT(DISTINCT `result`) > 1
	) THEN RAISE(ABORT, 'evidence publication contains a presence conflict') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1
		FROM `evidence_publication_assertions` AS assertion
		WHERE assertion.`publication_id` = NEW.`current_publication_id`
			AND assertion.`result` = 'present'
			AND NOT EXISTS (
				SELECT 1 FROM `evidence_publication_facts` AS fact
				WHERE fact.`publication_id` = assertion.`publication_id` AND fact.`assertion_id` = assertion.`id`
			)
	) THEN RAISE(ABORT, 'present evidence claim requires at least one structured fact') END;
	SELECT CASE WHEN EXISTS (
		SELECT `category`
		FROM (
			SELECT assertion.`category` AS `category`, assertion.`evidence_source_id` AS `evidence_source_id`, MAX(fact.`severity`) AS `source_severity`
			FROM `evidence_publication_assertions` AS assertion
			INNER JOIN `evidence_publication_facts` AS fact ON fact.`assertion_id` = assertion.`id`
			WHERE assertion.`publication_id` = NEW.`current_publication_id` AND assertion.`result` = 'present'
			GROUP BY assertion.`category`, assertion.`evidence_source_id`
		) AS per_source
		GROUP BY `category`
		HAVING COUNT(*) >= 2 AND MAX(`source_severity`) - MIN(`source_severity`) >= 2
	) THEN RAISE(ABORT, 'evidence publication contains a severity conflict') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_review_publication_heads_update_gate`
BEFORE UPDATE ON `evidence_review_publication_heads`
BEGIN
	SELECT CASE WHEN NEW.`version_id` <> OLD.`version_id` THEN RAISE(ABORT, 'evidence publication head version is immutable') END;
	SELECT CASE WHEN NEW.`revision` <> OLD.`revision` + 1 THEN RAISE(ABORT, 'evidence publication head revision must advance exactly once') END;
	SELECT CASE WHEN NEW.`last_transition_id` = OLD.`last_transition_id` THEN RAISE(ABORT, 'evidence publication head transition id must change') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `evidence_review_publications` AS publication
		INNER JOIN `title_versions` AS version ON version.`id` = publication.`version_id`
		WHERE publication.`id` = NEW.`current_publication_id`
			AND publication.`version_id` = NEW.`version_id`
			AND publication.`revision` = NEW.`revision`
			AND publication.`supersedes_publication_id` = OLD.`current_publication_id`
			AND publication.`review_method` = 'evidence_based'
			AND publication.`human_watch_confirmed` = 0
			AND version.`status` = 'active'
	) THEN RAISE(ABORT, 'evidence publication head must advance to the direct next active-version snapshot') END;
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `evidence_publication_sources` WHERE `publication_id` = NEW.`current_publication_id`
	) THEN RAISE(ABORT, 'evidence publication requires at least one licensed source') END;
	SELECT CASE WHEN (
		SELECT COUNT(DISTINCT `category`)
		FROM `evidence_publication_assertions`
		WHERE `publication_id` = NEW.`current_publication_id` AND `result` IN ('none', 'present')
	) <> 10 THEN RAISE(ABORT, 'evidence publication does not explicitly cover every content category') END;
	SELECT CASE WHEN EXISTS (
		SELECT `category`
		FROM `evidence_publication_assertions`
		WHERE `publication_id` = NEW.`current_publication_id` AND `result` IN ('none', 'present')
		GROUP BY `category`
		HAVING COUNT(DISTINCT `result`) > 1
	) THEN RAISE(ABORT, 'evidence publication contains a presence conflict') END;
	SELECT CASE WHEN EXISTS (
		SELECT 1
		FROM `evidence_publication_assertions` AS assertion
		WHERE assertion.`publication_id` = NEW.`current_publication_id`
			AND assertion.`result` = 'present'
			AND NOT EXISTS (
				SELECT 1 FROM `evidence_publication_facts` AS fact
				WHERE fact.`publication_id` = assertion.`publication_id` AND fact.`assertion_id` = assertion.`id`
			)
	) THEN RAISE(ABORT, 'present evidence claim requires at least one structured fact') END;
	SELECT CASE WHEN EXISTS (
		SELECT `category`
		FROM (
			SELECT assertion.`category` AS `category`, assertion.`evidence_source_id` AS `evidence_source_id`, MAX(fact.`severity`) AS `source_severity`
			FROM `evidence_publication_assertions` AS assertion
			INNER JOIN `evidence_publication_facts` AS fact ON fact.`assertion_id` = assertion.`id`
			WHERE assertion.`publication_id` = NEW.`current_publication_id` AND assertion.`result` = 'present'
			GROUP BY assertion.`category`, assertion.`evidence_source_id`
		) AS per_source
		GROUP BY `category`
		HAVING COUNT(*) >= 2 AND MAX(`source_severity`) - MIN(`source_severity`) >= 2
	) THEN RAISE(ABORT, 'evidence publication contains a severity conflict') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_review_publication_heads_no_delete`
BEFORE DELETE ON `evidence_review_publication_heads`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication head cannot be deleted without an explicit withdrawal workflow') END;
END;