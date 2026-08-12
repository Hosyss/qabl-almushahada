CREATE TABLE `review_audit_selections` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_id` text NOT NULL,
  `assignment_id` text NOT NULL,
  `bundle_id` text NOT NULL,
  `version_id` text NOT NULL,
  `reviewer_id` text NOT NULL,
  `risk_tier` text NOT NULL,
  `sample_rate_bps` integer NOT NULL,
  `draw_u32` integer NOT NULL,
  `selected` integer NOT NULL,
  `risk_triggers_json` text DEFAULT '[]' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`submission_id`) REFERENCES `review_submissions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`assignment_id`) REFERENCES `review_assignments`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`bundle_id`) REFERENCES `review_bundles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`version_id`) REFERENCES `title_versions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `review_audit_selections_risk_tier_check`
    CHECK (`risk_tier` IN ('baseline', 'high_risk')),
  CONSTRAINT `review_audit_selections_rate_check`
    CHECK (`sample_rate_bps` IN (1000, 5000)),
  CONSTRAINT `review_audit_selections_draw_check`
    CHECK (`draw_u32` BETWEEN 0 AND 4294967295),
  CONSTRAINT `review_audit_selections_selected_check`
    CHECK (`selected` IN (0, 1)),
  CONSTRAINT `review_audit_selections_json_check`
    CHECK (json_valid(`risk_triggers_json`) AND json_type(`risk_triggers_json`) = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_audit_selections_submission_unique`
ON `review_audit_selections` (`submission_id`);
--> statement-breakpoint
CREATE INDEX `review_audit_selections_selected_time_idx`
ON `review_audit_selections` (`selected`, `created_at`);
--> statement-breakpoint
CREATE INDEX `review_audit_selections_reviewer_time_idx`
ON `review_audit_selections` (`reviewer_id`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER `review_audit_selections_insert_guard`
BEFORE INSERT ON `review_audit_selections`
FOR EACH ROW
WHEN NOT EXISTS (
    SELECT 1
    FROM `review_submissions` s
    INNER JOIN `review_assignments` a ON a.`id` = s.`assignment_id`
    WHERE s.`id` = NEW.`submission_id`
      AND s.`assignment_id` = NEW.`assignment_id`
      AND s.`bundle_id` = NEW.`bundle_id`
      AND s.`version_id` = NEW.`version_id`
      AND s.`reviewer_id` = NEW.`reviewer_id`
      AND a.`bundle_id` = NEW.`bundle_id`
      AND a.`version_id` = NEW.`version_id`
      AND a.`reviewer_id` = NEW.`reviewer_id`
      AND a.`submission_id` = NEW.`submission_id`
      AND a.`state` = 'submitted'
  )
  OR (
    EXISTS (
      SELECT 1
      FROM `observations` o
      WHERE o.`submission_id` = NEW.`submission_id`
        AND (
          o.`severity` = 4
          OR (o.`category` = 'selfHarm' AND o.`severity` >= 1)
          OR (o.`category` IN ('sexualContent', 'flashingLights') AND o.`severity` >= 2)
          OR (o.`category` IN ('violence', 'substances', 'discrimination', 'bullying') AND o.`severity` >= 3)
          OR EXISTS (
            SELECT 1 FROM `observation_flags` f
            WHERE f.`observation_id` = o.`id`
              AND (
                f.`flag` = 'flashing_sequence'
                OR (f.`flag` IN ('blood', 'weapon', 'physical_bullying') AND o.`severity` >= 3)
              )
          )
        )
    )
    AND (
      NEW.`risk_tier` != 'high_risk'
      OR NEW.`sample_rate_bps` != 5000
      OR json_array_length(NEW.`risk_triggers_json`) = 0
    )
  )
  OR (
    NOT EXISTS (
      SELECT 1
      FROM `observations` o
      WHERE o.`submission_id` = NEW.`submission_id`
        AND (
          o.`severity` = 4
          OR (o.`category` = 'selfHarm' AND o.`severity` >= 1)
          OR (o.`category` IN ('sexualContent', 'flashingLights') AND o.`severity` >= 2)
          OR (o.`category` IN ('violence', 'substances', 'discrimination', 'bullying') AND o.`severity` >= 3)
          OR EXISTS (
            SELECT 1 FROM `observation_flags` f
            WHERE f.`observation_id` = o.`id`
              AND (
                f.`flag` = 'flashing_sequence'
                OR (f.`flag` IN ('blood', 'weapon', 'physical_bullying') AND o.`severity` >= 3)
              )
          )
        )
    )
    AND (
      NEW.`risk_tier` != 'baseline'
      OR NEW.`sample_rate_bps` != 1000
      OR json_array_length(NEW.`risk_triggers_json`) != 0
    )
  )
  OR NEW.`selected` != CASE
    WHEN NEW.`draw_u32` < ((4294967296 * NEW.`sample_rate_bps`) / 10000) THEN 1
    ELSE 0
  END
BEGIN
  SELECT RAISE(ABORT, 'post-submission audit selection decision is invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_selections_no_update`
BEFORE UPDATE ON `review_audit_selections`
BEGIN
  SELECT RAISE(ABORT, 'post-submission audit selection decisions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_selections_no_delete`
BEFORE DELETE ON `review_audit_selections`
BEGIN
  SELECT RAISE(ABORT, 'post-submission audit selection decisions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `review_assignments_require_audit_decision_before_approval`
BEFORE UPDATE OF `state` ON `review_assignments`
FOR EACH ROW
WHEN NEW.`state` = 'approved'
  AND (
    NEW.`submission_id` IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM `review_audit_selections`
      WHERE `submission_id` = NEW.`submission_id`
        AND `assignment_id` = NEW.`id`
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'current submission has no post-submission audit selection decision');
END;
--> statement-breakpoint
CREATE TRIGGER `review_bundles_require_audit_decisions_before_verification`
BEFORE UPDATE OF `status` ON `review_bundles`
FOR EACH ROW
WHEN NEW.`status` = 'verified'
  AND EXISTS (
    SELECT 1
    FROM `review_assignments` a
    WHERE a.`bundle_id` = NEW.`id`
      AND a.`submission_id` IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM `review_audit_selections` s
        WHERE s.`submission_id` = a.`submission_id`
          AND s.`assignment_id` = a.`id`
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'bundle contains a current submission without an audit selection decision');
END;
