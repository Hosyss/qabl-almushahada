-- P2Q-04 hardening: while a reviewer is active, reviewers.updated_at is the
-- explicit start of the current safety-evaluation epoch. It may advance only
-- as part of a status transition (activation, suspension, probation change),
-- never because unrelated reviewer metadata was edited.

CREATE TRIGGER `reviewer_active_epoch_anchor_immutable`
BEFORE UPDATE OF `updated_at` ON `reviewers`
FOR EACH ROW
WHEN OLD.`status` = 'active'
  AND NEW.`status` = 'active'
  AND NEW.`updated_at` <> OLD.`updated_at`
BEGIN
  SELECT RAISE(ABORT, 'active reviewer safety epoch anchor cannot change without a status transition');
END;
