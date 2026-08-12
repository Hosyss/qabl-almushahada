ALTER TABLE `review_bundles` ADD `current_approval_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `review_bundles_current_approval_unique` ON `review_bundles` (`current_approval_id`);
--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `assignment_id` text;
--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `revision` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `review_submissions` ADD `supersedes_submission_id` text;
--> statement-breakpoint
DROP INDEX `review_submissions_bundle_reviewer_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `review_submissions_assignment_revision_unique` ON `review_submissions` (`assignment_id`,`revision`);
--> statement-breakpoint
CREATE INDEX `review_submissions_bundle_reviewer_idx` ON `review_submissions` (`bundle_id`,`reviewer_id`);
--> statement-breakpoint
UPDATE `review_submissions`
SET `assignment_id` = (
  SELECT `review_assignments`.`id`
  FROM `review_assignments`
  WHERE `review_assignments`.`submission_id` = `review_submissions`.`id`
  LIMIT 1
)
WHERE `assignment_id` IS NULL;
--> statement-breakpoint
ALTER TABLE `editorial_approvals` ADD `revision` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `editorial_approvals` ADD `supersedes_approval_id` text;
--> statement-breakpoint
DROP INDEX `editorial_approvals_bundle_unique`;
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_approvals_bundle_revision_unique` ON `editorial_approvals` (`bundle_id`,`revision`);
--> statement-breakpoint
UPDATE `review_bundles`
SET `current_approval_id` = (
  SELECT `editorial_approvals`.`id`
  FROM `editorial_approvals`
  WHERE `editorial_approvals`.`bundle_id` = `review_bundles`.`id`
  ORDER BY `editorial_approvals`.`revision` DESC, `editorial_approvals`.`created_at` DESC, `editorial_approvals`.`id` DESC
  LIMIT 1
)
WHERE `current_approval_id` IS NULL;
--> statement-breakpoint
CREATE TRIGGER `review_submissions_lineage_guard_insert`
BEFORE INSERT ON `review_submissions`
FOR EACH ROW
WHEN NEW.`assignment_id` IS NULL
  OR length(trim(NEW.`assignment_id`)) = 0
  OR NEW.`revision` < 1
  OR NOT EXISTS (
    SELECT 1
    FROM `review_assignments`
    WHERE `id` = NEW.`assignment_id`
      AND `bundle_id` = NEW.`bundle_id`
      AND `version_id` = NEW.`version_id`
      AND `reviewer_id` = NEW.`reviewer_id`
  )
  OR (NEW.`revision` = 1 AND NEW.`supersedes_submission_id` IS NOT NULL)
  OR (
    NEW.`revision` > 1
    AND NOT EXISTS (
      SELECT 1
      FROM `review_submissions` previous
      WHERE previous.`id` = NEW.`supersedes_submission_id`
        AND previous.`assignment_id` = NEW.`assignment_id`
        AND previous.`revision` = NEW.`revision` - 1
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'review submission revision lineage is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `review_submissions_immutable_update`
BEFORE UPDATE ON `review_submissions`
BEGIN
  SELECT RAISE(ABORT, 'review submissions are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `review_submissions_immutable_delete`
BEFORE DELETE ON `review_submissions`
BEGIN
  SELECT RAISE(ABORT, 'review submissions are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `review_category_checks_immutable_update`
BEFORE UPDATE ON `review_category_checks`
BEGIN
  SELECT RAISE(ABORT, 'review category checks are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `review_category_checks_immutable_delete`
BEFORE DELETE ON `review_category_checks`
BEGIN
  SELECT RAISE(ABORT, 'review category checks are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `observations_immutable_update`
BEFORE UPDATE ON `observations`
BEGIN
  SELECT RAISE(ABORT, 'review observations are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `observations_immutable_delete`
BEFORE DELETE ON `observations`
BEGIN
  SELECT RAISE(ABORT, 'review observations are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `observation_flags_immutable_update`
BEFORE UPDATE ON `observation_flags`
BEGIN
  SELECT RAISE(ABORT, 'review observation flags are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `observation_flags_immutable_delete`
BEFORE DELETE ON `observation_flags`
BEGIN
  SELECT RAISE(ABORT, 'review observation flags are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_approvals_lineage_guard_insert`
BEFORE INSERT ON `editorial_approvals`
FOR EACH ROW
WHEN NEW.`revision` < 1
  OR (NEW.`revision` = 1 AND NEW.`supersedes_approval_id` IS NOT NULL)
  OR (
    NEW.`revision` > 1
    AND NOT EXISTS (
      SELECT 1
      FROM `editorial_approvals` previous
      WHERE previous.`id` = NEW.`supersedes_approval_id`
        AND previous.`bundle_id` = NEW.`bundle_id`
        AND previous.`revision` = NEW.`revision` - 1
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'editorial approval revision lineage is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_approvals_immutable_update`
BEFORE UPDATE ON `editorial_approvals`
BEGIN
  SELECT RAISE(ABORT, 'editorial approvals are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_approvals_immutable_delete`
BEFORE DELETE ON `editorial_approvals`
BEGIN
  SELECT RAISE(ABORT, 'editorial approvals are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_approval_submissions_immutable_update`
BEFORE UPDATE ON `editorial_approval_submissions`
BEGIN
  SELECT RAISE(ABORT, 'editorial approval submission links are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_approval_submissions_immutable_delete`
BEFORE DELETE ON `editorial_approval_submissions`
BEGIN
  SELECT RAISE(ABORT, 'editorial approval submission links are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_spot_checks_immutable_update`
BEFORE UPDATE ON `editorial_spot_checks`
BEGIN
  SELECT RAISE(ABORT, 'editorial spot checks are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_spot_checks_immutable_delete`
BEFORE DELETE ON `editorial_spot_checks`
BEGIN
  SELECT RAISE(ABORT, 'editorial spot checks are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `review_bundles_current_approval_guard_update`
BEFORE UPDATE OF `current_approval_id` ON `review_bundles`
FOR EACH ROW
WHEN NEW.`current_approval_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM `editorial_approvals`
    WHERE `id` = NEW.`current_approval_id`
      AND `bundle_id` = NEW.`id`
  )
BEGIN
  SELECT RAISE(ABORT, 'current editorial approval must belong to the same bundle');
END;
