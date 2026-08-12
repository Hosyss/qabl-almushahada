-- P2Q-04: every valid hold source suspends the reviewer/account immediately.
-- Automatic holds from 0010 already perform the same transition; these guarded
-- updates make manual holds database-enforced as well and remain idempotent.

CREATE TRIGGER `reviewer_safety_hold_suspends_target`
AFTER INSERT ON `internal_audit_events`
FOR EACH ROW
WHEN NEW.`event_type` = 'reviewer_safety_hold_placed'
BEGIN
  UPDATE `reviewers`
  SET `status` = 'suspended', `updated_at` = CURRENT_TIMESTAMP
  WHERE `id` = NEW.`entity_id` AND `status` = 'active';

  UPDATE `internal_users`
  SET `status` = 'suspended',
      `revision` = `revision` + 1,
      `last_transition_id` = NEW.`id`,
      `updated_at` = CURRENT_TIMESTAMP
  WHERE `reviewer_id` = NEW.`entity_id` AND `status` = 'active';
END;
