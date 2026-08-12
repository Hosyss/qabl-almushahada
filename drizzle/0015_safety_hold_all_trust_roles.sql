-- P2Q-04 hardening: a held reviewer identity cannot remain a current trust
-- contributor through a different internal role. Fail closed for bundles where
-- the identity is a current reviewer, the current editorial approver, or the
-- auditor who confirmed a current selected submission.

DROP TRIGGER `reviewer_safety_hold_invalidates_other_bundles`;
--> statement-breakpoint

CREATE TRIGGER `reviewer_safety_hold_invalidates_other_bundles`
AFTER INSERT ON `internal_audit_events`
FOR EACH ROW
WHEN NEW.`event_type` = 'reviewer_safety_hold_placed'
BEGIN
  UPDATE `review_bundles`
  SET `status` = 'conflicted',
      `current_approval_id` = NULL,
      `revision` = `revision` + 1,
      `workflow_transition_id` = NEW.`id` || ':' || `id`,
      `updated_at` = CURRENT_TIMESTAMP
  WHERE `status` IN ('verified', 'under_review')
    AND (
      json_extract(NEW.`payload_json`, '$.triggeringBundleId') IS NULL
      OR `id` <> json_extract(NEW.`payload_json`, '$.triggeringBundleId')
    )
    AND (
      EXISTS (
        SELECT 1
        FROM `review_assignments` a
        WHERE a.`bundle_id` = `review_bundles`.`id`
          AND a.`reviewer_id` = NEW.`entity_id`
      )
      OR EXISTS (
        SELECT 1
        FROM `editorial_approvals` ea
        WHERE ea.`id` = `review_bundles`.`current_approval_id`
          AND ea.`bundle_id` = `review_bundles`.`id`
          AND ea.`status` = 'approved'
          AND ea.`approver_id` = NEW.`entity_id`
      )
      OR EXISTS (
        SELECT 1
        FROM `review_audit_outcomes` o
        INNER JOIN `review_assignments` a
          ON a.`id` = o.`assignment_id`
         AND a.`bundle_id` = `review_bundles`.`id`
         AND a.`submission_id` = o.`submission_id`
        INNER JOIN `review_audit_selections` s
          ON s.`id` = o.`selection_id`
         AND s.`submission_id` = o.`submission_id`
         AND s.`selected` = 1
        WHERE o.`bundle_id` = `review_bundles`.`id`
          AND o.`auditor_reviewer_id` = NEW.`entity_id`
          AND o.`status` = 'confirmed'
      )
    );
END;
