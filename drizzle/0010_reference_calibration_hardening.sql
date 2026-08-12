CREATE TRIGGER `reviewer_reference_set_metadata_immutable_update`
BEFORE UPDATE OF `label`, `minimum_cases`, `created_by_user_id`, `created_at` ON `reviewer_reference_sets`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'reference calibration set metadata is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_set_immutable_delete`
BEFORE DELETE ON `reviewer_reference_sets`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'reference calibration sets are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_set_retire_open_attempt_guard`
BEFORE UPDATE OF `status` ON `reviewer_reference_sets`
FOR EACH ROW
WHEN OLD.`status` = 'active' AND NEW.`status` = 'retired'
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM `reviewer_reference_attempts`
      WHERE `set_id` = OLD.`id` AND `status` = 'in_progress'
    ) THEN RAISE(ABORT, 'cannot retire a reference set with open calibration attempts')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_reference_integrity_guard`
BEFORE INSERT ON `reviewer_reference_attempts`
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM `reviewer_reference_cases` c
      WHERE c.`set_id` = NEW.`set_id`
        AND NOT EXISTS (
          SELECT 1
          FROM `review_bundles` b
          INNER JOIN `review_assignments` a
            ON a.`bundle_id` = b.`id`
           AND a.`submission_id` = c.`reference_submission_id`
           AND a.`state` = 'approved'
          INNER JOIN `editorial_approval_submissions` eas
            ON eas.`approval_id` = b.`current_approval_id`
           AND eas.`submission_id` = c.`reference_submission_id`
          WHERE b.`id` = c.`bundle_id`
            AND b.`status` = 'verified'
            AND b.`current_approval_id` IS NOT NULL
        )
    ) THEN RAISE(ABORT, 'active reference set contains an invalid current reference case')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_identity_immutable_update`
BEFORE UPDATE OF `reviewer_id`, `set_id`, `purpose`, `started_at` ON `reviewer_reference_attempts`
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'reference calibration attempt identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_completion_time_guard`
BEFORE UPDATE OF `status` ON `reviewer_reference_attempts`
FOR EACH ROW
WHEN OLD.`status` = 'in_progress' AND NEW.`status` IN ('passed', 'failed')
BEGIN
  SELECT CASE
    WHEN datetime(OLD.`started_at`) IS NULL
      OR datetime(NEW.`completed_at`) IS NULL
      OR datetime(NEW.`completed_at`) < datetime(OLD.`started_at`)
    THEN RAISE(ABORT, 'reference calibration completion time is invalid')
  END;
END;
