ALTER TABLE `review_reports` ADD `version_id` text;
--> statement-breakpoint
ALTER TABLE `review_reports` ADD `invalidated_approval_id` text;
--> statement-breakpoint
ALTER TABLE `review_reports` ADD `previous_bundle_status` text;
--> statement-breakpoint
ALTER TABLE `review_reports` ADD `previous_bundle_revision` integer;
--> statement-breakpoint
ALTER TABLE `review_reports` ADD `resolution_kind` text;
--> statement-breakpoint
ALTER TABLE `review_reports` ADD `resolved_by_user_id` text;
--> statement-breakpoint
ALTER TABLE `review_reports` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `review_reports` ADD `last_transition_id` text;
--> statement-breakpoint
UPDATE `review_reports`
SET `version_id` = (
      SELECT `review_bundles`.`version_id`
      FROM `review_bundles`
      WHERE `review_bundles`.`id` = `review_reports`.`bundle_id`
    ),
    `previous_bundle_status` = 'conflicted',
    `previous_bundle_revision` = 0
WHERE `version_id` IS NULL;
--> statement-breakpoint
CREATE INDEX `review_reports_version_idx` ON `review_reports` (`version_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_reports_one_active_per_bundle`
ON `review_reports` (`bundle_id`)
WHERE `status` IN ('open', 'investigating');
--> statement-breakpoint
CREATE TRIGGER `review_reports_insert_guard`
BEFORE INSERT ON `review_reports`
FOR EACH ROW
WHEN NEW.`version_id` IS NULL
  OR length(trim(NEW.`version_id`)) = 0
  OR NEW.`status` != 'open'
  OR NEW.`previous_bundle_status` IS NOT 'verified'
  OR NEW.`previous_bundle_revision` IS NULL
  OR NEW.`previous_bundle_revision` < 0
  OR NEW.`invalidated_approval_id` IS NULL
  OR NEW.`revision` != 0
  OR NEW.`resolution_kind` IS NOT NULL
  OR NEW.`resolution_note` IS NOT NULL
  OR NEW.`resolved_by_user_id` IS NOT NULL
  OR NEW.`resolved_at` IS NOT NULL
  OR NEW.`last_transition_id` IS NOT NULL
  OR NOT EXISTS (
    SELECT 1 FROM `review_bundles`
    WHERE `id` = NEW.`bundle_id`
      AND `version_id` = NEW.`version_id`
      AND `status` = NEW.`previous_bundle_status`
      AND `revision` = NEW.`previous_bundle_revision`
      AND `current_approval_id` IS NEW.`invalidated_approval_id`
  )
  OR NOT EXISTS (
    SELECT 1 FROM `editorial_approvals` approval
    WHERE approval.`id` = NEW.`invalidated_approval_id`
      AND approval.`bundle_id` = NEW.`bundle_id`
      AND approval.`status` = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM `editorial_approvals` newer
        WHERE newer.`bundle_id` = approval.`bundle_id`
          AND newer.`revision` > approval.`revision`
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'review report opening snapshot is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `review_reports_identity_immutable`
BEFORE UPDATE ON `review_reports`
FOR EACH ROW
WHEN NEW.`bundle_id` != OLD.`bundle_id`
  OR NEW.`version_id` IS NOT OLD.`version_id`
  OR NEW.`report_type` != OLD.`report_type`
  OR NEW.`message` != OLD.`message`
  OR NEW.`invalidated_approval_id` IS NOT OLD.`invalidated_approval_id`
  OR NEW.`previous_bundle_status` IS NOT OLD.`previous_bundle_status`
  OR NEW.`previous_bundle_revision` IS NOT OLD.`previous_bundle_revision`
  OR NEW.`created_at` != OLD.`created_at`
BEGIN
  SELECT RAISE(ABORT, 'review report identity and opening snapshot are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `review_reports_transition_guard`
BEFORE UPDATE ON `review_reports`
FOR EACH ROW
WHEN OLD.`status` IN ('resolved', 'dismissed')
  OR NEW.`revision` != OLD.`revision` + 1
  OR NEW.`last_transition_id` IS NULL
  OR length(trim(NEW.`last_transition_id`)) = 0
  OR NEW.`last_transition_id` IS OLD.`last_transition_id`
  OR NOT (
    (OLD.`status` = 'open' AND NEW.`status` IN ('investigating', 'resolved', 'dismissed'))
    OR (OLD.`status` = 'investigating' AND NEW.`status` IN ('resolved', 'dismissed'))
  )
  OR (
    NEW.`status` IN ('open', 'investigating')
    AND (
      NEW.`resolution_kind` IS NOT NULL
      OR NEW.`resolved_by_user_id` IS NOT NULL
      OR NEW.`resolution_note` IS NOT NULL
      OR NEW.`resolved_at` IS NOT NULL
    )
  )
  OR (
    NEW.`status` = 'dismissed'
    AND (
      NEW.`resolution_kind` IS NOT 'no_issue'
      OR NEW.`resolved_by_user_id` IS NULL
      OR length(trim(NEW.`resolved_by_user_id`)) = 0
      OR NEW.`resolution_note` IS NULL
      OR length(trim(NEW.`resolution_note`)) < 10
      OR NEW.`resolved_at` IS NULL
    )
  )
  OR (
    NEW.`status` = 'resolved'
    AND (
      NEW.`resolution_kind` IS NOT 'correction_required'
      OR NEW.`resolved_by_user_id` IS NULL
      OR length(trim(NEW.`resolved_by_user_id`)) = 0
      OR NEW.`resolution_note` IS NULL
      OR length(trim(NEW.`resolution_note`)) < 10
      OR NEW.`resolved_at` IS NULL
    )
  )
  OR (
    NEW.`resolved_by_user_id` IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM `internal_users`
      WHERE `id` = NEW.`resolved_by_user_id`
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'review report transition is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `review_reports_no_delete`
BEFORE DELETE ON `review_reports`
BEGIN
  SELECT RAISE(ABORT, 'review reports cannot be deleted');
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_approvals_no_insert_with_active_report`
BEFORE INSERT ON `editorial_approvals`
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM `review_reports`
  WHERE `bundle_id` = NEW.`bundle_id`
    AND `status` IN ('open', 'investigating')
)
BEGIN
  SELECT RAISE(ABORT, 'active review report blocks new editorial approvals');
END;
--> statement-breakpoint
CREATE TRIGGER `review_bundles_no_current_approval_with_active_report`
BEFORE UPDATE OF `current_approval_id`, `status` ON `review_bundles`
FOR EACH ROW
WHEN EXISTS (
    SELECT 1 FROM `review_reports`
    WHERE `bundle_id` = NEW.`id`
      AND `status` IN ('open', 'investigating')
  )
  AND (NEW.`current_approval_id` IS NOT NULL OR NEW.`status` = 'verified')
BEGIN
  SELECT RAISE(ABORT, 'active review report blocks current approval and verification');
END;
--> statement-breakpoint
CREATE TRIGGER `review_bundles_verified_requires_current_approval`
BEFORE UPDATE OF `current_approval_id`, `status` ON `review_bundles`
FOR EACH ROW
WHEN NEW.`status` = 'verified'
  AND NEW.`current_approval_id` IS NULL
BEGIN
  SELECT RAISE(ABORT, 'verified bundle requires a current editorial approval');
END;
--> statement-breakpoint
CREATE TRIGGER `review_bundles_current_approval_must_be_latest_approved`
BEFORE UPDATE OF `current_approval_id` ON `review_bundles`
FOR EACH ROW
WHEN NEW.`current_approval_id` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `editorial_approvals` approval
    WHERE approval.`id` = NEW.`current_approval_id`
      AND approval.`bundle_id` = NEW.`id`
      AND approval.`status` = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM `editorial_approvals` newer
        WHERE newer.`bundle_id` = approval.`bundle_id`
          AND newer.`revision` > approval.`revision`
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'current approval must be the latest approved revision for its bundle');
END;
--> statement-breakpoint
CREATE TRIGGER `review_bundles_no_invalidated_approval_restore_after_correction`
BEFORE UPDATE OF `current_approval_id` ON `review_bundles`
FOR EACH ROW
WHEN NEW.`current_approval_id` IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM `review_reports`
    WHERE `bundle_id` = NEW.`id`
      AND `status` = 'resolved'
      AND `resolution_kind` = 'correction_required'
      AND `invalidated_approval_id` = NEW.`current_approval_id`
  )
BEGIN
  SELECT RAISE(ABORT, 'confirmed correction requires a new editorial approval revision');
END;
