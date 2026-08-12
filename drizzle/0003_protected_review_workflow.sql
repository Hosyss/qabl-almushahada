CREATE TABLE `internal_users` (
  `id` text PRIMARY KEY NOT NULL,
  `auth_email` text NOT NULL,
  `role` text NOT NULL,
  `reviewer_id` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `internal_users_email_normalized_check` CHECK(`auth_email` = lower(trim(`auth_email`))),
  CONSTRAINT `internal_users_role_check` CHECK(`role` IN ('admin', 'review_coordinator', 'reviewer', 'editorial_reviewer')),
  CONSTRAINT `internal_users_status_check` CHECK(`status` IN ('active', 'suspended')),
  CONSTRAINT `internal_users_reviewer_binding_check` CHECK(`role` NOT IN ('reviewer', 'editorial_reviewer') OR `reviewer_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_users_auth_email_unique` ON `internal_users` (`auth_email`);
--> statement-breakpoint
CREATE INDEX `internal_users_role_status_idx` ON `internal_users` (`role`,`status`);
--> statement-breakpoint
CREATE TABLE `review_assignments` (
  `id` text PRIMARY KEY NOT NULL,
  `bundle_id` text NOT NULL,
  `version_id` text NOT NULL,
  `reviewer_id` text NOT NULL,
  `assigned_by_user_id` text NOT NULL,
  `state` text DEFAULT 'draft' NOT NULL,
  `revision` integer DEFAULT 0 NOT NULL,
  `submission_id` text,
  `last_transition_id` text,
  `assigned_at` text,
  `started_at` text,
  `submitted_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`assigned_by_user_id`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `review_assignments_state_check` CHECK(`state` IN ('draft', 'assigned', 'in_progress', 'submitted', 'changes_requested', 'approved', 'conflicted')),
  CONSTRAINT `review_assignments_revision_check` CHECK(`revision` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_assignments_bundle_reviewer_unique` ON `review_assignments` (`bundle_id`,`reviewer_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_assignments_submission_unique` ON `review_assignments` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `review_assignments_reviewer_state_idx` ON `review_assignments` (`reviewer_id`,`state`);
--> statement-breakpoint
CREATE INDEX `review_assignments_bundle_state_idx` ON `review_assignments` (`bundle_id`,`state`);
--> statement-breakpoint
CREATE TRIGGER `review_assignments_version_guard_insert`
BEFORE INSERT ON `review_assignments`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `review_bundles`
  WHERE `id` = NEW.`bundle_id` AND `version_id` = NEW.`version_id`
)
BEGIN
  SELECT RAISE(ABORT, 'review assignment version mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `review_assignments_version_guard_update`
BEFORE UPDATE OF `bundle_id`, `version_id` ON `review_assignments`
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM `review_bundles`
  WHERE `id` = NEW.`bundle_id` AND `version_id` = NEW.`version_id`
)
BEGIN
  SELECT RAISE(ABORT, 'review assignment version mismatch');
END;
--> statement-breakpoint
CREATE TRIGGER `review_assignments_identity_lock`
BEFORE UPDATE OF `bundle_id`, `version_id`, `reviewer_id` ON `review_assignments`
FOR EACH ROW
WHEN OLD.`bundle_id` <> NEW.`bundle_id`
  OR OLD.`version_id` <> NEW.`version_id`
  OR OLD.`reviewer_id` <> NEW.`reviewer_id`
BEGIN
  SELECT RAISE(ABORT, 'review assignment identity is immutable');
END;
--> statement-breakpoint
CREATE TABLE `review_assignment_drafts` (
  `assignment_id` text PRIMARY KEY NOT NULL,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `updated_by_user_id` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`assignment_id`) REFERENCES `review_assignments`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `review_assignment_drafts_json_check` CHECK(json_valid(`payload_json`))
);
