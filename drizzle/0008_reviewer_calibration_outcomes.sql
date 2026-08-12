CREATE TABLE `review_audit_outcomes` (
  `id` text PRIMARY KEY NOT NULL,
  `selection_id` text NOT NULL,
  `submission_id` text NOT NULL,
  `assignment_id` text NOT NULL,
  `bundle_id` text NOT NULL,
  `version_id` text NOT NULL,
  `subject_reviewer_id` text NOT NULL,
  `auditor_user_id` text NOT NULL,
  `auditor_reviewer_id` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `notes` text DEFAULT '' NOT NULL,
  `revision` integer DEFAULT 0 NOT NULL,
  `final_transition_id` text,
  `completed_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`selection_id`) REFERENCES `review_audit_selections`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`submission_id`) REFERENCES `review_submissions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`assignment_id`) REFERENCES `review_assignments`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`subject_reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`auditor_user_id`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`auditor_reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `review_audit_outcomes_status_check`
    CHECK (`status` IN ('pending', 'confirmed', 'correction_required')),
  CONSTRAINT `review_audit_outcomes_revision_check`
    CHECK (`revision` IN (0, 1)),
  CONSTRAINT `review_audit_outcomes_notes_check`
    CHECK (length(`notes`) <= 4000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_audit_outcomes_selection_unique`
ON `review_audit_outcomes` (`selection_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_audit_outcomes_transition_unique`
ON `review_audit_outcomes` (`final_transition_id`);
--> statement-breakpoint
CREATE INDEX `review_audit_outcomes_subject_time_idx`
ON `review_audit_outcomes` (`subject_reviewer_id`, `completed_at`);
--> statement-breakpoint
CREATE INDEX `review_audit_outcomes_auditor_time_idx`
ON `review_audit_outcomes` (`auditor_reviewer_id`, `completed_at`);
--> statement-breakpoint
CREATE TABLE `review_audit_findings` (
  `id` text PRIMARY KEY NOT NULL,
  `outcome_id` text NOT NULL,
  `finding_type` text NOT NULL,
  `category` text NOT NULL,
  `target_observation_id` text,
  `reviewer_severity` integer,
  `auditor_severity` integer NOT NULL,
  `start_second` integer,
  `end_second` integer,
  `summary` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`outcome_id`) REFERENCES `review_audit_outcomes`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`target_observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `review_audit_findings_type_check`
    CHECK (`finding_type` IN ('missed_event', 'severity_difference')),
  CONSTRAINT `review_audit_findings_category_check`
    CHECK (`category` IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')),
  CONSTRAINT `review_audit_findings_auditor_severity_check`
    CHECK (`auditor_severity` BETWEEN 1 AND 4),
  CONSTRAINT `review_audit_findings_reviewer_severity_check`
    CHECK (`reviewer_severity` IS NULL OR `reviewer_severity` BETWEEN 1 AND 4),
  CONSTRAINT `review_audit_findings_summary_check`
    CHECK (length(trim(`summary`)) BETWEEN 5 AND 1000),
  CONSTRAINT `review_audit_findings_shape_check`
    CHECK (
      (`finding_type` = 'missed_event'
        AND `target_observation_id` IS NULL
        AND `reviewer_severity` IS NULL
        AND `start_second` IS NOT NULL
        AND `end_second` IS NOT NULL
        AND `start_second` >= 0
        AND `end_second` >= `start_second`)
      OR
      (`finding_type` = 'severity_difference'
        AND `target_observation_id` IS NOT NULL
        AND `reviewer_severity` IS NOT NULL
        AND `reviewer_severity` != `auditor_severity`
        AND `start_second` IS NULL
        AND `end_second` IS NULL)
    )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_audit_findings_observation_unique`
ON `review_audit_findings` (`outcome_id`, `target_observation_id`)
WHERE `target_observation_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `review_audit_findings_type_idx`
ON `review_audit_findings` (`finding_type`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER `review_audit_outcomes_insert_guard`
BEFORE INSERT ON `review_audit_outcomes`
FOR EACH ROW
WHEN NEW.`status` != 'pending'
  OR NEW.`revision` != 0
  OR NEW.`final_transition_id` IS NOT NULL
  OR NEW.`completed_at` IS NOT NULL
  OR NEW.`subject_reviewer_id` = NEW.`auditor_reviewer_id`
  OR NOT EXISTS (
    SELECT 1
    FROM `review_audit_selections` s
    INNER JOIN `review_assignments` a ON a.`id` = s.`assignment_id`
    INNER JOIN `internal_users` u ON u.`id` = NEW.`auditor_user_id`
    INNER JOIN `reviewers` subject ON subject.`id` = s.`reviewer_id`
    INNER JOIN `reviewers` auditor ON auditor.`id` = NEW.`auditor_reviewer_id`
    WHERE s.`id` = NEW.`selection_id`
      AND s.`selected` = 1
      AND s.`submission_id` = NEW.`submission_id`
      AND s.`assignment_id` = NEW.`assignment_id`
      AND s.`bundle_id` = NEW.`bundle_id`
      AND s.`version_id` = NEW.`version_id`
      AND s.`reviewer_id` = NEW.`subject_reviewer_id`
      AND a.`submission_id` = s.`submission_id`
      AND a.`state` = 'submitted'
      AND u.`role` = 'editorial_reviewer'
      AND u.`status` = 'active'
      AND u.`reviewer_id` = NEW.`auditor_reviewer_id`
      AND auditor.`status` = 'active'
      AND subject.`independence_group_id` != auditor.`independence_group_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'audit outcome opening context is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_findings_insert_guard`
BEFORE INSERT ON `review_audit_findings`
FOR EACH ROW
WHEN NOT EXISTS (
    SELECT 1 FROM `review_audit_outcomes`
    WHERE `id` = NEW.`outcome_id`
      AND `status` = 'pending'
      AND `revision` = 0
  )
  OR (
    NEW.`finding_type` = 'severity_difference'
    AND NOT EXISTS (
      SELECT 1
      FROM `review_audit_outcomes` outcome
      INNER JOIN `observations` observation
        ON observation.`id` = NEW.`target_observation_id`
       AND observation.`submission_id` = outcome.`submission_id`
      WHERE outcome.`id` = NEW.`outcome_id`
        AND observation.`category` = NEW.`category`
        AND observation.`severity` = NEW.`reviewer_severity`
    )
  )
  OR (
    NEW.`finding_type` = 'missed_event'
    AND NOT EXISTS (
      SELECT 1
      FROM `review_audit_outcomes` outcome
      INNER JOIN `title_versions` version ON version.`id` = outcome.`version_id`
      WHERE outcome.`id` = NEW.`outcome_id`
        AND NEW.`end_second` <= version.`runtime_seconds`
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'audit finding does not match the selected submission');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_findings_no_update`
BEFORE UPDATE ON `review_audit_findings`
BEGIN
  SELECT RAISE(ABORT, 'audit findings are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_findings_no_delete`
BEFORE DELETE ON `review_audit_findings`
BEGIN
  SELECT RAISE(ABORT, 'audit findings are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_outcomes_finalize_guard`
BEFORE UPDATE ON `review_audit_outcomes`
FOR EACH ROW
WHEN OLD.`status` != 'pending'
  OR OLD.`revision` != 0
  OR NEW.`selection_id` != OLD.`selection_id`
  OR NEW.`submission_id` != OLD.`submission_id`
  OR NEW.`assignment_id` != OLD.`assignment_id`
  OR NEW.`bundle_id` != OLD.`bundle_id`
  OR NEW.`version_id` != OLD.`version_id`
  OR NEW.`subject_reviewer_id` != OLD.`subject_reviewer_id`
  OR NEW.`auditor_user_id` != OLD.`auditor_user_id`
  OR NEW.`auditor_reviewer_id` != OLD.`auditor_reviewer_id`
  OR NEW.`notes` != OLD.`notes`
  OR NEW.`created_at` != OLD.`created_at`
  OR NEW.`status` NOT IN ('confirmed', 'correction_required')
  OR NEW.`revision` != 1
  OR NEW.`final_transition_id` IS NULL
  OR length(trim(NEW.`final_transition_id`)) = 0
  OR NEW.`completed_at` IS NULL
  OR (
    NEW.`status` = 'confirmed'
    AND EXISTS (
      SELECT 1 FROM `review_audit_findings`
      WHERE `outcome_id` = OLD.`id`
    )
  )
  OR (
    NEW.`status` = 'correction_required'
    AND NOT EXISTS (
      SELECT 1 FROM `review_audit_findings`
      WHERE `outcome_id` = OLD.`id`
    )
  )
  OR NOT EXISTS (
    SELECT 1
    FROM `review_assignments` a
    INNER JOIN `review_audit_selections` s ON s.`id` = OLD.`selection_id`
    INNER JOIN `internal_users` u ON u.`id` = OLD.`auditor_user_id`
    INNER JOIN `reviewers` subject ON subject.`id` = OLD.`subject_reviewer_id`
    INNER JOIN `reviewers` auditor ON auditor.`id` = OLD.`auditor_reviewer_id`
    WHERE a.`id` = OLD.`assignment_id`
      AND a.`submission_id` = OLD.`submission_id`
      AND a.`state` = 'submitted'
      AND s.`selected` = 1
      AND u.`role` = 'editorial_reviewer'
      AND u.`status` = 'active'
      AND u.`reviewer_id` = OLD.`auditor_reviewer_id`
      AND auditor.`status` = 'active'
      AND subject.`independence_group_id` != auditor.`independence_group_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'audit outcome finalization is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_outcomes_no_delete`
BEFORE DELETE ON `review_audit_outcomes`
BEGIN
  SELECT RAISE(ABORT, 'audit outcomes are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_approvals_selected_audits_must_be_confirmed`
BEFORE INSERT ON `editorial_approvals`
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM `review_assignments` a
  INNER JOIN `review_audit_selections` selection
    ON selection.`submission_id` = a.`submission_id`
   AND selection.`assignment_id` = a.`id`
  WHERE a.`bundle_id` = NEW.`bundle_id`
    AND selection.`selected` = 1
    AND NOT EXISTS (
      SELECT 1 FROM `review_audit_outcomes` outcome
      WHERE outcome.`selection_id` = selection.`id`
        AND outcome.`submission_id` = a.`submission_id`
        AND outcome.`status` = 'confirmed'
    )
)
BEGIN
  SELECT RAISE(ABORT, 'selected audit must be confirmed before editorial approval');
END;
--> statement-breakpoint
CREATE TRIGGER `review_assignments_selected_audit_must_be_confirmed_before_approval`
BEFORE UPDATE OF `state` ON `review_assignments`
FOR EACH ROW
WHEN NEW.`state` = 'approved'
  AND EXISTS (
    SELECT 1 FROM `review_audit_selections` selection
    WHERE selection.`submission_id` = NEW.`submission_id`
      AND selection.`assignment_id` = NEW.`id`
      AND selection.`selected` = 1
      AND NOT EXISTS (
        SELECT 1 FROM `review_audit_outcomes` outcome
        WHERE outcome.`selection_id` = selection.`id`
          AND outcome.`status` = 'confirmed'
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'selected audit must be confirmed before assignment approval');
END;
--> statement-breakpoint
CREATE TRIGGER `review_bundles_selected_audits_must_be_confirmed_before_verification`
BEFORE UPDATE OF `status` ON `review_bundles`
FOR EACH ROW
WHEN NEW.`status` = 'verified'
  AND EXISTS (
    SELECT 1
    FROM `review_assignments` a
    INNER JOIN `review_audit_selections` selection
      ON selection.`submission_id` = a.`submission_id`
     AND selection.`assignment_id` = a.`id`
    WHERE a.`bundle_id` = NEW.`id`
      AND selection.`selected` = 1
      AND NOT EXISTS (
        SELECT 1 FROM `review_audit_outcomes` outcome
        WHERE outcome.`selection_id` = selection.`id`
          AND outcome.`status` = 'confirmed'
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'selected audit must be confirmed before bundle verification');
END;
