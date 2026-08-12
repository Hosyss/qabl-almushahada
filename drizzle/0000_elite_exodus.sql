CREATE TABLE `editorial_approval_submissions` (
	`approval_id` text NOT NULL,
	`submission_id` text NOT NULL,
	PRIMARY KEY(`approval_id`, `submission_id`),
	FOREIGN KEY (`approval_id`) REFERENCES `editorial_approvals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `review_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `editorial_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_id` text NOT NULL,
	`approver_id` text NOT NULL,
	`status` text NOT NULL,
	`version_fingerprint_confirmed` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`approved_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approver_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_approvals_bundle_unique` ON `editorial_approvals` (`bundle_id`);--> statement-breakpoint
CREATE INDEX `editorial_approvals_approver_idx` ON `editorial_approvals` (`approver_id`);--> statement-breakpoint
CREATE TABLE `observation_flags` (
	`observation_id` text NOT NULL,
	`flag` text NOT NULL,
	PRIMARY KEY(`observation_id`, `flag`),
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `observation_flags_flag_idx` ON `observation_flags` (`flag`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`category` text NOT NULL,
	`severity` integer NOT NULL,
	`start_second` integer NOT NULL,
	`end_second` integer NOT NULL,
	`frequency` text NOT NULL,
	`context` text NOT NULL,
	`spoiler_level` text NOT NULL,
	`summary` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `review_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "observations_severity_check" CHECK("observations"."severity" BETWEEN 1 AND 4),
	CONSTRAINT "observations_start_check" CHECK("observations"."start_second" >= 0),
	CONSTRAINT "observations_time_order_check" CHECK("observations"."end_second" >= "observations"."start_second"),
	CONSTRAINT "observations_summary_check" CHECK(length(trim("observations"."summary")) > 0)
);
--> statement-breakpoint
CREATE INDEX `observations_submission_idx` ON `observations` (`submission_id`);--> statement-breakpoint
CREATE INDEX `observations_category_severity_idx` ON `observations` (`category`,`severity`);--> statement-breakpoint
CREATE TABLE `review_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "review_audit_events_json_check" CHECK(json_valid("review_audit_events"."payload_json"))
);
--> statement-breakpoint
CREATE INDEX `review_audit_events_bundle_time_idx` ON `review_audit_events` (`bundle_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `review_audit_events_entity_idx` ON `review_audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `review_bundles` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `review_bundles_version_idx` ON `review_bundles` (`version_id`);--> statement-breakpoint
CREATE INDEX `review_bundles_status_idx` ON `review_bundles` (`status`);--> statement-breakpoint
CREATE TABLE `review_category_checks` (
	`submission_id` text NOT NULL,
	`category` text NOT NULL,
	`result` text NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`submission_id`, `category`),
	FOREIGN KEY (`submission_id`) REFERENCES `review_submissions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `review_category_checks_result_idx` ON `review_category_checks` (`result`);--> statement-breakpoint
CREATE TABLE `review_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_id` text NOT NULL,
	`report_type` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_reports_message_check" CHECK(length(trim("review_reports"."message")) >= 10)
);
--> statement-breakpoint
CREATE INDEX `review_reports_bundle_status_idx` ON `review_reports` (`bundle_id`,`status`);--> statement-breakpoint
CREATE TABLE `review_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_id` text NOT NULL,
	`version_id` text NOT NULL,
	`reviewer_id` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	`watched_seconds` integer NOT NULL,
	`declared_complete` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "review_submissions_watched_seconds_check" CHECK("review_submissions"."watched_seconds" >= 0),
	CONSTRAINT "review_submissions_time_order_check" CHECK("review_submissions"."completed_at" > "review_submissions"."started_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_submissions_bundle_reviewer_unique` ON `review_submissions` (`bundle_id`,`reviewer_id`);--> statement-breakpoint
CREATE INDEX `review_submissions_version_idx` ON `review_submissions` (`version_id`);--> statement-breakpoint
CREATE INDEX `review_submissions_reviewer_idx` ON `review_submissions` (`reviewer_id`);--> statement-breakpoint
CREATE TABLE `reviewers` (
	`id` text PRIMARY KEY NOT NULL,
	`display_label` text NOT NULL,
	`independence_group_id` text NOT NULL,
	`status` text DEFAULT 'probation' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviewers_independence_group_idx` ON `reviewers` (`independence_group_id`);--> statement-breakpoint
CREATE INDEX `reviewers_status_idx` ON `reviewers` (`status`);--> statement-breakpoint
CREATE TABLE `title_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`edition_label` text NOT NULL,
	`platform` text NOT NULL,
	`language` text NOT NULL,
	`runtime_seconds` integer NOT NULL,
	`content_fingerprint` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "title_versions_runtime_check" CHECK("title_versions"."runtime_seconds" > 0),
	CONSTRAINT "title_versions_fingerprint_length_check" CHECK(length("title_versions"."content_fingerprint") >= 12)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `title_versions_fingerprint_unique` ON `title_versions` (`content_fingerprint`);--> statement-breakpoint
CREATE INDEX `title_versions_title_idx` ON `title_versions` (`title_id`);--> statement-breakpoint
CREATE INDEX `title_versions_lookup_idx` ON `title_versions` (`platform`,`language`,`status`);--> statement-breakpoint
CREATE TABLE `titles` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`original_name` text,
	`kind` text NOT NULL,
	`release_year` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "titles_release_year_check" CHECK("titles"."release_year" BETWEEN 1880 AND 2200)
);
--> statement-breakpoint
CREATE INDEX `titles_name_idx` ON `titles` (`canonical_name`);--> statement-breakpoint
CREATE INDEX `titles_release_year_idx` ON `titles` (`release_year`);