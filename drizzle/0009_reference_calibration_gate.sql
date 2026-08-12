CREATE TABLE `reviewer_reference_sets` (
  `id` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `minimum_cases` integer DEFAULT 10 NOT NULL,
  `created_by_user_id` text NOT NULL,
  `activated_by_user_id` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `activated_at` text,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`activated_by_user_id`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `reviewer_reference_sets_status_check` CHECK (`status` IN ('draft', 'active', 'retired')),
  CONSTRAINT `reviewer_reference_sets_minimum_cases_check` CHECK (`minimum_cases` >= 10),
  CONSTRAINT `reviewer_reference_sets_activation_check` CHECK (
    (`status` = 'draft' AND `activated_by_user_id` IS NULL AND `activated_at` IS NULL)
    OR (`status` IN ('active', 'retired') AND `activated_by_user_id` IS NOT NULL AND `activated_at` IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviewer_reference_sets_one_active_unique`
ON `reviewer_reference_sets` (`status`) WHERE `status` = 'active';
--> statement-breakpoint
CREATE TABLE `reviewer_reference_cases` (
  `id` text PRIMARY KEY NOT NULL,
  `set_id` text NOT NULL,
  `bundle_id` text NOT NULL,
  `reference_submission_id` text NOT NULL,
  `sequence` integer NOT NULL,
  `created_by_user_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`set_id`) REFERENCES `reviewer_reference_sets`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reference_submission_id`) REFERENCES `review_submissions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`created_by_user_id`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `reviewer_reference_cases_sequence_check` CHECK (`sequence` >= 1),
  CONSTRAINT `reviewer_reference_cases_set_sequence_unique` UNIQUE (`set_id`, `sequence`),
  CONSTRAINT `reviewer_reference_cases_set_bundle_unique` UNIQUE (`set_id`, `bundle_id`)
);
--> statement-breakpoint
CREATE TABLE `reviewer_reference_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `reviewer_id` text NOT NULL,
  `set_id` text NOT NULL,
  `purpose` text NOT NULL,
  `status` text DEFAULT 'in_progress' NOT NULL,
  `category_agreement_bps` integer,
  `observation_recall_bps` integer,
  `observation_precision_bps` integer,
  `missed_high_sensitivity_count` integer,
  `max_severity_delta` integer,
  `blockers_json` text DEFAULT '[]' NOT NULL,
  `started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `completed_at` text,
  FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`set_id`) REFERENCES `reviewer_reference_sets`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `reviewer_reference_attempts_purpose_check` CHECK (`purpose` IN ('initial', 'reactivation', 'drift')),
  CONSTRAINT `reviewer_reference_attempts_status_check` CHECK (`status` IN ('in_progress', 'passed', 'failed')),
  CONSTRAINT `reviewer_reference_attempts_bps_check` CHECK (
    (`category_agreement_bps` IS NULL OR `category_agreement_bps` BETWEEN 0 AND 10000)
    AND (`observation_recall_bps` IS NULL OR `observation_recall_bps` BETWEEN 0 AND 10000)
    AND (`observation_precision_bps` IS NULL OR `observation_precision_bps` BETWEEN 0 AND 10000)
  ),
  CONSTRAINT `reviewer_reference_attempts_counts_check` CHECK (
    (`missed_high_sensitivity_count` IS NULL OR `missed_high_sensitivity_count` >= 0)
    AND (`max_severity_delta` IS NULL OR `max_severity_delta` BETWEEN 0 AND 3)
  ),
  CONSTRAINT `reviewer_reference_attempts_json_check` CHECK (json_valid(`blockers_json`) AND json_type(`blockers_json`) = 'array'),
  CONSTRAINT `reviewer_reference_attempts_completion_check` CHECK (
    (`status` = 'in_progress' AND `completed_at` IS NULL AND `category_agreement_bps` IS NULL AND `observation_recall_bps` IS NULL AND `observation_precision_bps` IS NULL AND `missed_high_sensitivity_count` IS NULL AND `max_severity_delta` IS NULL)
    OR (`status` IN ('passed', 'failed') AND `completed_at` IS NOT NULL AND `category_agreement_bps` IS NOT NULL AND `observation_recall_bps` IS NOT NULL AND `observation_precision_bps` IS NOT NULL AND `missed_high_sensitivity_count` IS NOT NULL AND `max_severity_delta` IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviewer_reference_attempts_one_open_unique`
ON `reviewer_reference_attempts` (`reviewer_id`) WHERE `status` = 'in_progress';
--> statement-breakpoint
CREATE INDEX `reviewer_reference_attempts_reviewer_time_idx`
ON `reviewer_reference_attempts` (`reviewer_id`, `completed_at`);
--> statement-breakpoint
CREATE TABLE `reviewer_reference_case_results` (
  `attempt_id` text NOT NULL,
  `case_id` text NOT NULL,
  `candidate_payload_json` text NOT NULL,
  `category_matches` integer NOT NULL,
  `category_total` integer NOT NULL,
  `reference_observation_count` integer NOT NULL,
  `candidate_observation_count` integer NOT NULL,
  `matched_observation_count` integer NOT NULL,
  `missed_observation_count` integer NOT NULL,
  `false_positive_observation_count` integer NOT NULL,
  `missed_high_sensitivity_count` integer NOT NULL,
  `max_severity_delta` integer NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`attempt_id`, `case_id`),
  FOREIGN KEY (`attempt_id`) REFERENCES `reviewer_reference_attempts`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`case_id`) REFERENCES `reviewer_reference_cases`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `reviewer_reference_case_results_json_check` CHECK (json_valid(`candidate_payload_json`)),
  CONSTRAINT `reviewer_reference_case_results_counts_check` CHECK (
    `category_matches` >= 0 AND `category_total` = 10 AND `category_matches` <= `category_total`
    AND `reference_observation_count` >= 0 AND `candidate_observation_count` >= 0
    AND `matched_observation_count` >= 0
    AND `matched_observation_count` <= `reference_observation_count`
    AND `matched_observation_count` <= `candidate_observation_count`
    AND `missed_observation_count` = `reference_observation_count` - `matched_observation_count`
    AND `false_positive_observation_count` = `candidate_observation_count` - `matched_observation_count`
    AND `missed_high_sensitivity_count` >= 0
    AND `max_severity_delta` BETWEEN 0 AND 3
  )
);
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_case_insert_guard`
BEFORE INSERT ON `reviewer_reference_cases`
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM `reviewer_reference_sets`
      WHERE `id` = NEW.`set_id` AND `status` = 'draft'
    ) THEN RAISE(ABORT, 'reference cases may only be added to a draft set')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `review_bundles` b
      INNER JOIN `review_assignments` a ON a.`bundle_id` = b.`id`
      INNER JOIN `editorial_approval_submissions` eas ON eas.`approval_id` = b.`current_approval_id`
      WHERE b.`id` = NEW.`bundle_id`
        AND b.`status` = 'verified'
        AND b.`current_approval_id` IS NOT NULL
        AND a.`submission_id` = NEW.`reference_submission_id`
        AND a.`state` = 'approved'
        AND eas.`submission_id` = NEW.`reference_submission_id`
    ) THEN RAISE(ABORT, 'reference case requires a current verified approved submission')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_case_immutable_update`
BEFORE UPDATE ON `reviewer_reference_cases`
BEGIN
  SELECT RAISE(ABORT, 'reference calibration cases are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_case_immutable_delete`
BEFORE DELETE ON `reviewer_reference_cases`
BEGIN
  SELECT RAISE(ABORT, 'reference calibration cases are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_set_transition_guard`
BEFORE UPDATE OF `status`, `activated_by_user_id`, `activated_at` ON `reviewer_reference_sets`
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN OLD.`status` = 'draft' AND NEW.`status` = 'active' AND (
      NEW.`activated_by_user_id` IS NULL OR NEW.`activated_at` IS NULL OR
      (SELECT COUNT(*) FROM `reviewer_reference_cases` WHERE `set_id` = OLD.`id`) < OLD.`minimum_cases`
    ) THEN RAISE(ABORT, 'reference calibration set is not ready for activation')
  END;
  SELECT CASE
    WHEN NOT (
      (OLD.`status` = 'draft' AND NEW.`status` = 'active')
      OR (OLD.`status` = 'active' AND NEW.`status` = 'retired')
      OR (OLD.`status` = NEW.`status` AND OLD.`activated_by_user_id` IS NEW.`activated_by_user_id` AND OLD.`activated_at` IS NEW.`activated_at`)
    ) THEN RAISE(ABORT, 'invalid reference calibration set transition')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_insert_guard`
BEFORE INSERT ON `reviewer_reference_attempts`
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM `reviewer_reference_sets`
      WHERE `id` = NEW.`set_id` AND `status` = 'active'
    ) THEN RAISE(ABORT, 'reference calibration requires the active set')
  END;
  SELECT CASE
    WHEN NEW.`purpose` = 'initial' AND NOT EXISTS (
      SELECT 1 FROM `reviewers` WHERE `id` = NEW.`reviewer_id` AND `status` = 'probation'
    ) THEN RAISE(ABORT, 'initial calibration requires a probation reviewer')
  END;
  SELECT CASE
    WHEN NEW.`purpose` IN ('reactivation', 'drift') AND NOT EXISTS (
      SELECT 1 FROM `reviewers` WHERE `id` = NEW.`reviewer_id` AND `status` = 'suspended'
    ) THEN RAISE(ABORT, 'reactivation calibration requires a suspended reviewer')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_case_result_insert_guard`
BEFORE INSERT ON `reviewer_reference_case_results`
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `reviewer_reference_attempts` a
      INNER JOIN `reviewer_reference_cases` c ON c.`id` = NEW.`case_id` AND c.`set_id` = a.`set_id`
      WHERE a.`id` = NEW.`attempt_id` AND a.`status` = 'in_progress'
    ) THEN RAISE(ABORT, 'reference case result does not belong to an open attempt')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_case_result_immutable_update`
BEFORE UPDATE ON `reviewer_reference_case_results`
BEGIN
  SELECT RAISE(ABORT, 'reference calibration case results are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_case_result_immutable_delete`
BEFORE DELETE ON `reviewer_reference_case_results`
BEGIN
  SELECT RAISE(ABORT, 'reference calibration case results are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_finalize_guard`
BEFORE UPDATE OF `status` ON `reviewer_reference_attempts`
FOR EACH ROW
WHEN OLD.`status` = 'in_progress' AND NEW.`status` IN ('passed', 'failed')
BEGIN
  SELECT CASE
    WHEN (SELECT COUNT(*) FROM `reviewer_reference_case_results` WHERE `attempt_id` = OLD.`id`)
      <> (SELECT COUNT(*) FROM `reviewer_reference_cases` WHERE `set_id` = OLD.`set_id`)
    THEN RAISE(ABORT, 'all reference calibration cases must be completed')
  END;
  SELECT CASE
    WHEN NEW.`status` = 'passed' AND NOT (
      NEW.`category_agreement_bps` >= 9500
      AND NEW.`observation_recall_bps` >= 9000
      AND NEW.`observation_precision_bps` >= 9000
      AND NEW.`missed_high_sensitivity_count` = 0
      AND NEW.`max_severity_delta` <= 1
    ) THEN RAISE(ABORT, 'failed reference calibration cannot be marked passed')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_immutable_after_final_update`
BEFORE UPDATE ON `reviewer_reference_attempts`
FOR EACH ROW
WHEN OLD.`status` IN ('passed', 'failed')
BEGIN
  SELECT RAISE(ABORT, 'final reference calibration attempts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_immutable_delete`
BEFORE DELETE ON `reviewer_reference_attempts`
BEGIN
  SELECT RAISE(ABORT, 'reference calibration attempts are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_activation_requires_reference_calibration`
BEFORE UPDATE OF `status` ON `reviewers`
FOR EACH ROW
WHEN NEW.`status` = 'active' AND OLD.`status` IN ('probation', 'suspended')
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `reviewer_reference_attempts` a
      INNER JOIN `reviewer_reference_sets` s ON s.`id` = a.`set_id`
      WHERE a.`reviewer_id` = OLD.`id`
        AND a.`status` = 'passed'
        AND s.`status` = 'active'
        AND (
          (OLD.`status` = 'probation' AND a.`purpose` = 'initial')
          OR (
            OLD.`status` = 'suspended'
            AND a.`purpose` IN ('reactivation', 'drift')
            AND a.`completed_at` >= OLD.`updated_at`
          )
        )
    ) THEN RAISE(ABORT, 'reviewer activation requires a current passed reference calibration')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `provisioned_reviewer_starts_probation`
AFTER INSERT ON `internal_users`
FOR EACH ROW
WHEN NEW.`role` IN ('reviewer', 'editorial_reviewer')
  AND NEW.`reviewer_id` IS NOT NULL
  AND NEW.`last_transition_id` IS NOT NULL
BEGIN
  UPDATE `reviewers`
  SET `status` = 'probation', `updated_at` = CURRENT_TIMESTAMP
  WHERE `id` = NEW.`reviewer_id` AND `status` = 'active';
END;