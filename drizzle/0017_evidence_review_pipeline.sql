CREATE TABLE `evidence_category_assertions` (
	`id` text PRIMARY KEY NOT NULL,
	`evidence_source_id` text NOT NULL,
	`category` text NOT NULL,
	`result` text NOT NULL,
	`extraction_method` text NOT NULL,
	`extractor_version` text NOT NULL,
	`source_locator` text NOT NULL,
	`summary_ar` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`evidence_source_id`) REFERENCES `version_evidence_sources`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_category_assertion_category_check" CHECK(`category` IN ('fear','violence','language','bullying','sexualContent','substances','discrimination','selfHarm','grief','flashingLights')),
	CONSTRAINT "evidence_category_assertion_result_check" CHECK(`result` IN ('none','present','uncertain')),
	CONSTRAINT "evidence_category_assertion_method_check" CHECK(`extraction_method` IN ('manual','deterministic','model_assisted')),
	CONSTRAINT "evidence_category_assertion_extractor_check" CHECK(length(trim(`extractor_version`)) BETWEEN 1 AND 120),
	CONSTRAINT "evidence_category_assertion_locator_check" CHECK(length(trim(`source_locator`)) BETWEEN 1 AND 500),
	CONSTRAINT "evidence_category_assertion_summary_check" CHECK(length(trim(`summary_ar`)) BETWEEN 1 AND 1000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_category_assertion_source_locator_unique` ON `evidence_category_assertions` (`evidence_source_id`,`category`,`source_locator`,`id`);
--> statement-breakpoint
CREATE INDEX `evidence_category_assertion_source_idx` ON `evidence_category_assertions` (`evidence_source_id`);
--> statement-breakpoint
CREATE INDEX `evidence_category_assertion_category_idx` ON `evidence_category_assertions` (`category`,`result`);
--> statement-breakpoint
CREATE TRIGGER `evidence_category_assertions_source_policy_guard`
BEFORE INSERT ON `evidence_category_assertions`
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `version_evidence_sources` AS e
		JOIN `content_source_policy_snapshots` AS p ON p.`id` = e.`policy_snapshot_id`
		WHERE e.`id` = NEW.`evidence_source_id`
			AND p.`use_scope` = 'analysis_evidence'
			AND p.`commercial_use_allowed` = 1
	) THEN RAISE(ABORT, 'evidence assertion requires a commercially allowed analysis-evidence source') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_category_assertions_no_update`
BEFORE UPDATE ON `evidence_category_assertions`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence assertions are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_category_assertions_no_delete`
BEFORE DELETE ON `evidence_category_assertions`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence assertions are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `evidence_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`assertion_id` text NOT NULL,
	`category` text NOT NULL,
	`severity` integer NOT NULL,
	`frequency` text NOT NULL,
	`context` text NOT NULL,
	`spoiler_level` text NOT NULL,
	`summary_ar` text NOT NULL,
	`start_second` integer,
	`end_second` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`assertion_id`) REFERENCES `evidence_category_assertions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_fact_category_check" CHECK(`category` IN ('fear','violence','language','bullying','sexualContent','substances','discrimination','selfHarm','grief','flashingLights')),
	CONSTRAINT "evidence_fact_severity_check" CHECK(`severity` BETWEEN 1 AND 4),
	CONSTRAINT "evidence_fact_frequency_check" CHECK(`frequency` IN ('single','repeated','sustained','unknown')),
	CONSTRAINT "evidence_fact_context_check" CHECK(`context` IN ('comic','neutral','educational','threatening','distressing','unknown')),
	CONSTRAINT "evidence_fact_spoiler_check" CHECK(`spoiler_level` IN ('none','contextual','major')),
	CONSTRAINT "evidence_fact_summary_check" CHECK(length(trim(`summary_ar`)) BETWEEN 1 AND 1000),
	CONSTRAINT "evidence_fact_timing_check" CHECK((`start_second` IS NULL AND `end_second` IS NULL) OR (`start_second` >= 0 AND `end_second` >= `start_second`))
);
--> statement-breakpoint
CREATE INDEX `evidence_fact_assertion_idx` ON `evidence_facts` (`assertion_id`);
--> statement-breakpoint
CREATE INDEX `evidence_fact_category_severity_idx` ON `evidence_facts` (`category`,`severity`);
--> statement-breakpoint
CREATE TRIGGER `evidence_facts_assertion_guard`
BEFORE INSERT ON `evidence_facts`
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1
		FROM `evidence_category_assertions` AS a
		WHERE a.`id` = NEW.`assertion_id`
			AND a.`result` = 'present'
			AND a.`category` = NEW.`category`
	) THEN RAISE(ABORT, 'evidence fact requires a matching present assertion') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_facts_no_update`
BEFORE UPDATE ON `evidence_facts`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence facts are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_facts_no_delete`
BEFORE DELETE ON `evidence_facts`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence facts are append-only') END;
END;
--> statement-breakpoint
CREATE TABLE `evidence_fact_flags` (
	`fact_id` text NOT NULL,
	`flag` text NOT NULL,
	FOREIGN KEY (`fact_id`) REFERENCES `evidence_facts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_fact_flag_check" CHECK(`flag` IN ('jump_scare','blood','weapon','verbal_bullying','physical_bullying','bereavement','separation','flashing_sequence'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evidence_fact_flag_unique` ON `evidence_fact_flags` (`fact_id`,`flag`);
--> statement-breakpoint
CREATE INDEX `evidence_fact_flag_idx` ON `evidence_fact_flags` (`flag`);
--> statement-breakpoint
CREATE TRIGGER `evidence_fact_flags_no_update`
BEFORE UPDATE ON `evidence_fact_flags`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence fact flags are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_fact_flags_no_delete`
BEFORE DELETE ON `evidence_fact_flags`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence fact flags are append-only') END;
END;
