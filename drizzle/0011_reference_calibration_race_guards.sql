CREATE TRIGGER `reviewer_reference_attempt_independence_guard`
BEFORE INSERT ON `reviewer_reference_attempts`
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM `reviewer_reference_cases` c
      INNER JOIN `review_submissions` s ON s.`id` = c.`reference_submission_id`
      INNER JOIN `reviewers` reference_reviewer ON reference_reviewer.`id` = s.`reviewer_id`
      INNER JOIN `reviewers` candidate_reviewer ON candidate_reviewer.`id` = NEW.`reviewer_id`
      WHERE c.`set_id` = NEW.`set_id`
        AND (
          reference_reviewer.`id` = candidate_reviewer.`id`
          OR reference_reviewer.`independence_group_id` = candidate_reviewer.`independence_group_id`
        )
    ) THEN RAISE(ABORT, 'reference calibration requires independent reference reviewers')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_case_result_current_reference_guard`
BEFORE INSERT ON `reviewer_reference_case_results`
FOR EACH ROW
BEGIN
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM `reviewer_reference_attempts` attempt
      INNER JOIN `reviewer_reference_cases` c
        ON c.`id` = NEW.`case_id`
       AND c.`set_id` = attempt.`set_id`
      INNER JOIN `review_bundles` b ON b.`id` = c.`bundle_id`
      INNER JOIN `review_assignments` assignment
        ON assignment.`bundle_id` = b.`id`
       AND assignment.`submission_id` = c.`reference_submission_id`
       AND assignment.`state` = 'approved'
      INNER JOIN `editorial_approval_submissions` eas
        ON eas.`approval_id` = b.`current_approval_id`
       AND eas.`submission_id` = c.`reference_submission_id`
      WHERE attempt.`id` = NEW.`attempt_id`
        AND attempt.`status` = 'in_progress'
        AND b.`status` = 'verified'
        AND b.`current_approval_id` IS NOT NULL
    ) THEN RAISE(ABORT, 'reference case is no longer current verified evidence')
  END;
END;
--> statement-breakpoint
CREATE TRIGGER `reviewer_reference_attempt_finalize_current_reference_guard`
BEFORE UPDATE OF `status` ON `reviewer_reference_attempts`
FOR EACH ROW
WHEN OLD.`status` = 'in_progress' AND NEW.`status` IN ('passed', 'failed')
BEGIN
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM `reviewer_reference_cases` c
      WHERE c.`set_id` = OLD.`set_id`
        AND NOT EXISTS (
          SELECT 1
          FROM `review_bundles` b
          INNER JOIN `review_assignments` assignment
            ON assignment.`bundle_id` = b.`id`
           AND assignment.`submission_id` = c.`reference_submission_id`
           AND assignment.`state` = 'approved'
          INNER JOIN `editorial_approval_submissions` eas
            ON eas.`approval_id` = b.`current_approval_id`
           AND eas.`submission_id` = c.`reference_submission_id`
          WHERE b.`id` = c.`bundle_id`
            AND b.`status` = 'verified'
            AND b.`current_approval_id` IS NOT NULL
        )
    ) THEN RAISE(ABORT, 'reference calibration cannot finalize with stale reference evidence')
  END;
END;
