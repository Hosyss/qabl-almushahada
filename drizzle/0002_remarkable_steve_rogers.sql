PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_review_bundles` (
	`id` text PRIMARY KEY NOT NULL,
	`version_id` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`published_transition_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "review_bundles_status_check" CHECK("__new_review_bundles"."status" IN ('draft', 'under_review', 'conflicted', 'verified', 'withdrawn')),
	CONSTRAINT "review_bundles_revision_check" CHECK("__new_review_bundles"."revision" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_review_bundles`("id", "version_id", "status", "revision", "published_transition_id", "created_at", "published_at", "updated_at") SELECT "id", "version_id", "status", 0, NULL, "created_at", "published_at", "updated_at" FROM `review_bundles`;--> statement-breakpoint
DROP TABLE `review_bundles`;--> statement-breakpoint
ALTER TABLE `__new_review_bundles` RENAME TO `review_bundles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `review_bundles_version_idx` ON `review_bundles` (`version_id`);--> statement-breakpoint
CREATE INDEX `review_bundles_status_idx` ON `review_bundles` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `review_bundles_transition_unique` ON `review_bundles` (`published_transition_id`);--> statement-breakpoint
CREATE TABLE `__new_editorial_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_id` text NOT NULL,
	`approver_id` text NOT NULL,
	`status` text NOT NULL,
	`version_fingerprint_confirmed` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`approved_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approver_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "editorial_approvals_status_check" CHECK("__new_editorial_approvals"."status" IN ('approved', 'changes_requested', 'rejected')),
	CONSTRAINT "editorial_approvals_fingerprint_check" CHECK("__new_editorial_approvals"."version_fingerprint_confirmed" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_editorial_approvals`("id", "bundle_id", "approver_id", "status", "version_fingerprint_confirmed", "notes", "approved_at", "created_at") SELECT "id", "bundle_id", "approver_id", "status", "version_fingerprint_confirmed", "notes", "approved_at", "created_at" FROM `editorial_approvals`;--> statement-breakpoint
DROP TABLE `editorial_approvals`;--> statement-breakpoint
ALTER TABLE `__new_editorial_approvals` RENAME TO `editorial_approvals`;--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_approvals_bundle_unique` ON `editorial_approvals` (`bundle_id`);--> statement-breakpoint
CREATE INDEX `editorial_approvals_approver_idx` ON `editorial_approvals` (`approver_id`);--> statement-breakpoint
CREATE TABLE `__new_editorial_spot_checks` (
	`approval_id` text NOT NULL,
	`observation_id` text NOT NULL,
	`result` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`approval_id`, `observation_id`),
	FOREIGN KEY (`approval_id`) REFERENCES `editorial_approvals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "editorial_spot_checks_result_check" CHECK("__new_editorial_spot_checks"."result" IN ('confirmed', 'unresolved'))
);
--> statement-breakpoint
INSERT INTO `__new_editorial_spot_checks`("approval_id", "observation_id", "result", "notes", "checked_at") SELECT "approval_id", "observation_id", "result", "notes", "checked_at" FROM `editorial_spot_checks`;--> statement-breakpoint
DROP TABLE `editorial_spot_checks`;--> statement-breakpoint
ALTER TABLE `__new_editorial_spot_checks` RENAME TO `editorial_spot_checks`;--> statement-breakpoint
CREATE INDEX `editorial_spot_checks_result_idx` ON `editorial_spot_checks` (`result`);--> statement-breakpoint
CREATE TABLE `__new_observation_flags` (
	`observation_id` text NOT NULL,
	`flag` text NOT NULL,
	PRIMARY KEY(`observation_id`, `flag`),
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "observation_flags_value_check" CHECK("__new_observation_flags"."flag" IN ('jump_scare', 'blood', 'weapon', 'verbal_bullying', 'physical_bullying', 'bereavement', 'separation', 'flashing_sequence'))
);
--> statement-breakpoint
INSERT INTO `__new_observation_flags`("observation_id", "flag") SELECT "observation_id", "flag" FROM `observation_flags`;--> statement-breakpoint
DROP TABLE `observation_flags`;--> statement-breakpoint
ALTER TABLE `__new_observation_flags` RENAME TO `observation_flags`;--> statement-breakpoint
CREATE INDEX `observation_flags_flag_idx` ON `observation_flags` (`flag`);--> statement-breakpoint
CREATE TABLE `__new_observations` (
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
	CONSTRAINT "observations_severity_check" CHECK("__new_observations"."severity" BETWEEN 1 AND 4),
	CONSTRAINT "observations_start_check" CHECK("__new_observations"."start_second" >= 0),
	CONSTRAINT "observations_time_order_check" CHECK("__new_observations"."end_second" >= "__new_observations"."start_second"),
	CONSTRAINT "observations_summary_check" CHECK(length(trim("__new_observations"."summary")) > 0),
	CONSTRAINT "observations_category_check" CHECK("__new_observations"."category" IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')),
	CONSTRAINT "observations_frequency_check" CHECK("__new_observations"."frequency" IN ('single', 'repeated', 'sustained')),
	CONSTRAINT "observations_context_check" CHECK("__new_observations"."context" IN ('comic', 'neutral', 'educational', 'threatening', 'distressing')),
	CONSTRAINT "observations_spoiler_check" CHECK("__new_observations"."spoiler_level" IN ('none', 'contextual', 'major'))
);
--> statement-breakpoint
INSERT INTO `__new_observations`("id", "submission_id", "category", "severity", "start_second", "end_second", "frequency", "context", "spoiler_level", "summary", "created_at", "updated_at") SELECT "id", "submission_id", "category", "severity", "start_second", "end_second", "frequency", "context", "spoiler_level", "summary", "created_at", "updated_at" FROM `observations`;--> statement-breakpoint
DROP TABLE `observations`;--> statement-breakpoint
ALTER TABLE `__new_observations` RENAME TO `observations`;--> statement-breakpoint
CREATE INDEX `observations_submission_idx` ON `observations` (`submission_id`);--> statement-breakpoint
CREATE INDEX `observations_category_severity_idx` ON `observations` (`category`,`severity`);--> statement-breakpoint
CREATE TABLE `__new_review_category_checks` (
	`submission_id` text NOT NULL,
	`category` text NOT NULL,
	`result` text NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`submission_id`, `category`),
	FOREIGN KEY (`submission_id`) REFERENCES `review_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_category_checks_category_check" CHECK("__new_review_category_checks"."category" IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')),
	CONSTRAINT "review_category_checks_result_check" CHECK("__new_review_category_checks"."result" IN ('none', 'present', 'uncertain'))
);
--> statement-breakpoint
INSERT INTO `__new_review_category_checks`("submission_id", "category", "result", "checked_at") SELECT "submission_id", "category", "result", "checked_at" FROM `review_category_checks`;--> statement-breakpoint
DROP TABLE `review_category_checks`;--> statement-breakpoint
ALTER TABLE `__new_review_category_checks` RENAME TO `review_category_checks`;--> statement-breakpoint
CREATE INDEX `review_category_checks_result_idx` ON `review_category_checks` (`result`);--> statement-breakpoint
CREATE TABLE `__new_review_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`bundle_id` text NOT NULL,
	`report_type` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolution_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`resolved_at` text,
	FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_reports_message_check" CHECK(length(trim("__new_review_reports"."message")) >= 10),
	CONSTRAINT "review_reports_type_check" CHECK("__new_review_reports"."report_type" IN ('different_version', 'missing_event', 'wrong_severity', 'spoiler', 'other')),
	CONSTRAINT "review_reports_status_check" CHECK("__new_review_reports"."status" IN ('open', 'investigating', 'resolved', 'dismissed'))
);
--> statement-breakpoint
INSERT INTO `__new_review_reports`("id", "bundle_id", "report_type", "message", "status", "resolution_note", "created_at", "resolved_at") SELECT "id", "bundle_id", "report_type", "message", "status", "resolution_note", "created_at", "resolved_at" FROM `review_reports`;--> statement-breakpoint
DROP TABLE `review_reports`;--> statement-breakpoint
ALTER TABLE `__new_review_reports` RENAME TO `review_reports`;--> statement-breakpoint
CREATE INDEX `review_reports_bundle_status_idx` ON `review_reports` (`bundle_id`,`status`);--> statement-breakpoint
CREATE TABLE `__new_review_submissions` (
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
	CONSTRAINT "review_submissions_watched_seconds_check" CHECK("__new_review_submissions"."watched_seconds" >= 0),
	CONSTRAINT "review_submissions_time_order_check" CHECK("__new_review_submissions"."completed_at" > "__new_review_submissions"."started_at"),
	CONSTRAINT "review_submissions_complete_check" CHECK("__new_review_submissions"."declared_complete" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_review_submissions`("id", "bundle_id", "version_id", "reviewer_id", "started_at", "completed_at", "watched_seconds", "declared_complete", "created_at", "updated_at") SELECT "id", "bundle_id", "version_id", "reviewer_id", "started_at", "completed_at", "watched_seconds", "declared_complete", "created_at", "updated_at" FROM `review_submissions`;--> statement-breakpoint
DROP TABLE `review_submissions`;--> statement-breakpoint
ALTER TABLE `__new_review_submissions` RENAME TO `review_submissions`;--> statement-breakpoint
CREATE UNIQUE INDEX `review_submissions_bundle_reviewer_unique` ON `review_submissions` (`bundle_id`,`reviewer_id`);--> statement-breakpoint
CREATE INDEX `review_submissions_version_idx` ON `review_submissions` (`version_id`);--> statement-breakpoint
CREATE INDEX `review_submissions_reviewer_idx` ON `review_submissions` (`reviewer_id`);--> statement-breakpoint
CREATE TABLE `__new_reviewers` (
	`id` text PRIMARY KEY NOT NULL,
	`display_label` text NOT NULL,
	`independence_group_id` text NOT NULL,
	`status` text DEFAULT 'probation' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "reviewers_status_check" CHECK("__new_reviewers"."status" IN ('active', 'probation', 'suspended'))
);
--> statement-breakpoint
INSERT INTO `__new_reviewers`("id", "display_label", "independence_group_id", "status", "created_at", "updated_at") SELECT "id", "display_label", "independence_group_id", "status", "created_at", "updated_at" FROM `reviewers`;--> statement-breakpoint
DROP TABLE `reviewers`;--> statement-breakpoint
ALTER TABLE `__new_reviewers` RENAME TO `reviewers`;--> statement-breakpoint
CREATE INDEX `reviewers_independence_group_idx` ON `reviewers` (`independence_group_id`);--> statement-breakpoint
CREATE INDEX `reviewers_status_idx` ON `reviewers` (`status`);--> statement-breakpoint
CREATE TABLE `__new_title_versions` (
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
	CONSTRAINT "title_versions_runtime_check" CHECK("__new_title_versions"."runtime_seconds" > 0),
	CONSTRAINT "title_versions_fingerprint_length_check" CHECK(length("__new_title_versions"."content_fingerprint") >= 12),
	CONSTRAINT "title_versions_status_check" CHECK("__new_title_versions"."status" IN ('draft', 'active', 'superseded', 'withdrawn'))
);
--> statement-breakpoint
INSERT INTO `__new_title_versions`("id", "title_id", "edition_label", "platform", "language", "runtime_seconds", "content_fingerprint", "status", "created_at", "updated_at") SELECT "id", "title_id", "edition_label", "platform", "language", "runtime_seconds", "content_fingerprint", "status", "created_at", "updated_at" FROM `title_versions`;--> statement-breakpoint
DROP TABLE `title_versions`;--> statement-breakpoint
ALTER TABLE `__new_title_versions` RENAME TO `title_versions`;--> statement-breakpoint
CREATE UNIQUE INDEX `title_versions_fingerprint_unique` ON `title_versions` (`content_fingerprint`);--> statement-breakpoint
CREATE INDEX `title_versions_title_idx` ON `title_versions` (`title_id`);--> statement-breakpoint
CREATE INDEX `title_versions_lookup_idx` ON `title_versions` (`platform`,`language`,`status`);--> statement-breakpoint
CREATE TABLE `__new_titles` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`original_name` text,
	`kind` text NOT NULL,
	`release_year` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "titles_release_year_check" CHECK("__new_titles"."release_year" BETWEEN 1880 AND 2200),
	CONSTRAINT "titles_kind_check" CHECK("__new_titles"."kind" IN ('movie', 'series', 'episode', 'special'))
);
--> statement-breakpoint
INSERT INTO `__new_titles`("id", "canonical_name", "original_name", "kind", "release_year", "created_at", "updated_at") SELECT "id", "canonical_name", "original_name", "kind", "release_year", "created_at", "updated_at" FROM `titles`;--> statement-breakpoint
DROP TABLE `titles`;--> statement-breakpoint
ALTER TABLE `__new_titles` RENAME TO `titles`;--> statement-breakpoint
CREATE INDEX `titles_name_idx` ON `titles` (`canonical_name`);--> statement-breakpoint
CREATE INDEX `titles_release_year_idx` ON `titles` (`release_year`);
