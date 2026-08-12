-- P2Q-04 hardening: aggregate patterns are evaluated after every completed
-- audit, including a confirmed audit that brings the current epoch to the
-- minimum 20-sample window. Immediate finding triggers remain in 0010.

DROP TRIGGER `reviewer_safety_hold_event_insert_guard`;
--> statement-breakpoint

CREATE TRIGGER `reviewer_safety_hold_event_insert_guard`
BEFORE INSERT ON `internal_audit_events`
FOR EACH ROW
WHEN NEW.`event_type` = 'reviewer_safety_hold_placed'
BEGIN
  SELECT CASE
    WHEN NEW.`entity_type` <> 'reviewer'
      OR NOT EXISTS (SELECT 1 FROM `reviewers` WHERE `id` = NEW.`entity_id` AND `status` = 'active')
    THEN RAISE(ABORT, 'reviewer safety hold requires an active reviewer target')
  END;
  SELECT CASE
    WHEN json_type(NEW.`payload_json`, '$.triggerCodes') <> 'array'
      OR json_array_length(NEW.`payload_json`, '$.triggerCodes') = 0
      OR json_type(NEW.`payload_json`, '$.evidence') <> 'object'
    THEN RAISE(ABORT, 'reviewer safety hold evidence is invalid')
  END;
  SELECT CASE
    WHEN json_extract(NEW.`payload_json`, '$.source') NOT IN ('automatic_audit_pattern', 'manual_collusion_suspicion')
    THEN RAISE(ABORT, 'reviewer safety hold source is invalid')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM `internal_audit_events` h
      WHERE h.`event_type` = 'reviewer_safety_hold_placed'
        AND h.`entity_type` = 'reviewer'
        AND h.`entity_id` = NEW.`entity_id`
        AND NOT EXISTS (
          SELECT 1 FROM `internal_audit_events` r
          WHERE r.`event_type` = 'reviewer_safety_hold_resolved'
            AND json_extract(r.`payload_json`, '$.holdEventId') = h.`id`
        )
    ) THEN RAISE(ABORT, 'reviewer already has an unresolved safety hold')
  END;
  SELECT CASE
    WHEN json_extract(NEW.`payload_json`, '$.source') = 'automatic_audit_pattern'
      AND (
        json_extract(NEW.`payload_json`, '$.policyVersion') <> '2026-08-12.v1'
        OR NOT EXISTS (
          SELECT 1 FROM `review_audit_outcomes` o
          WHERE o.`id` = json_extract(NEW.`payload_json`, '$.triggeringOutcomeId')
            AND o.`subject_reviewer_id` = NEW.`entity_id`
            AND o.`auditor_user_id` = NEW.`actor_user_id`
            AND o.`status` IN ('confirmed', 'correction_required')
        )
      )
    THEN RAISE(ABORT, 'automatic reviewer safety hold context is invalid')
  END;
  SELECT CASE
    WHEN json_extract(NEW.`payload_json`, '$.source') = 'manual_collusion_suspicion'
      AND (
        NOT EXISTS (
          SELECT 1 FROM `internal_users`
          WHERE `id` = NEW.`actor_user_id` AND `role` = 'admin' AND `status` = 'active'
        )
        OR NOT EXISTS (
          SELECT 1 FROM json_each(NEW.`payload_json`, '$.triggerCodes')
          WHERE value = 'COLLUSION_SUSPICION'
        )
      )
    THEN RAISE(ABORT, 'manual reviewer safety hold requires an active admin and collusion-suspicion code')
  END;
END;
--> statement-breakpoint

CREATE TRIGGER `reviewer_safety_hold_from_confirmed_audit_window`
AFTER UPDATE OF `status` ON `review_audit_outcomes`
FOR EACH ROW
WHEN OLD.`status` = 'pending' AND NEW.`status` = 'confirmed'
BEGIN
  INSERT INTO `internal_audit_events`
    (`id`, `actor_user_id`, `event_type`, `entity_type`, `entity_id`, `payload_json`, `created_at`)
  SELECT
    'safety-hold-' || lower(hex(randomblob(16))),
    NEW.`auditor_user_id`,
    'reviewer_safety_hold_placed',
    'reviewer',
    NEW.`subject_reviewer_id`,
    json_object(
      'source', 'automatic_audit_pattern',
      'policyVersion', '2026-08-12.v1',
      'triggeringOutcomeId', NEW.`id`,
      'triggeringBundleId', NEW.`bundle_id`,
      'triggerCodes', json((
        SELECT json_group_array(code) FROM (
          SELECT 'REPEATED_CORRECTIONS' AS code
          WHERE (
            SELECT COUNT(*) FROM (
              SELECT o.`id`, o.`status`
              FROM `review_audit_outcomes` o
              WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
                AND o.`status` IN ('confirmed', 'correction_required')
                AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
              ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
            ) recent WHERE recent.`status` = 'correction_required'
          ) >= 5
          UNION ALL
          SELECT 'REPEATED_MISSED_EVENTS'
          WHERE (
            SELECT COUNT(*) FROM (
              SELECT o.`id`
              FROM `review_audit_outcomes` o
              WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
                AND o.`status` IN ('confirmed', 'correction_required')
                AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
              ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
            ) recent
            WHERE EXISTS (
              SELECT 1 FROM `review_audit_findings` f
              WHERE f.`outcome_id` = recent.`id` AND f.`finding_type` = 'missed_event'
            )
          ) >= 3
          UNION ALL
          SELECT 'REPEATED_LARGE_SEVERITY_GAPS'
          WHERE (
            SELECT COUNT(*) FROM (
              SELECT o.`id`
              FROM `review_audit_outcomes` o
              WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
                AND o.`status` IN ('confirmed', 'correction_required')
                AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
              ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
            ) recent
            WHERE EXISTS (
              SELECT 1 FROM `review_audit_findings` f
              WHERE f.`outcome_id` = recent.`id`
                AND f.`finding_type` = 'severity_difference'
                AND abs(f.`auditor_severity` - f.`reviewer_severity`) >= 2
            )
          ) >= 3
        )
      )),
      'evidence', json_object(
        'currentEpochSampleSize', (
          SELECT COUNT(*) FROM `review_audit_outcomes` o
          WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
            AND o.`status` IN ('confirmed', 'correction_required')
            AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
        ),
        'evaluatedWindowSize', 20,
        'triggeredOnConfirmedWindowCompletion', 1
      )
    ),
    CURRENT_TIMESTAMP
  WHERE EXISTS (
      SELECT 1 FROM `reviewers`
      WHERE `id` = NEW.`subject_reviewer_id` AND `status` = 'active'
    )
    AND NOT EXISTS (
      SELECT 1 FROM `internal_audit_events` h
      WHERE h.`event_type` = 'reviewer_safety_hold_placed'
        AND h.`entity_type` = 'reviewer'
        AND h.`entity_id` = NEW.`subject_reviewer_id`
        AND NOT EXISTS (
          SELECT 1 FROM `internal_audit_events` r
          WHERE r.`event_type` = 'reviewer_safety_hold_resolved'
            AND json_extract(r.`payload_json`, '$.holdEventId') = h.`id`
        )
    )
    AND (
      SELECT COUNT(*) FROM (
        SELECT o.`id`
        FROM `review_audit_outcomes` o
        WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
          AND o.`status` IN ('confirmed', 'correction_required')
          AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
        ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
      )
    ) = 20
    AND (
      (SELECT COUNT(*) FROM (
        SELECT o.`id`, o.`status`
        FROM `review_audit_outcomes` o
        WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
          AND o.`status` IN ('confirmed', 'correction_required')
          AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
        ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
      ) recent WHERE recent.`status` = 'correction_required') >= 5
      OR (SELECT COUNT(*) FROM (
        SELECT o.`id` FROM `review_audit_outcomes` o
        WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
          AND o.`status` IN ('confirmed', 'correction_required')
          AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
        ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
      ) recent WHERE EXISTS (
        SELECT 1 FROM `review_audit_findings` f
        WHERE f.`outcome_id` = recent.`id` AND f.`finding_type` = 'missed_event'
      )) >= 3
      OR (SELECT COUNT(*) FROM (
        SELECT o.`id` FROM `review_audit_outcomes` o
        WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
          AND o.`status` IN ('confirmed', 'correction_required')
          AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
        ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
      ) recent WHERE EXISTS (
        SELECT 1 FROM `review_audit_findings` f
        WHERE f.`outcome_id` = recent.`id`
          AND f.`finding_type` = 'severity_difference'
          AND abs(f.`auditor_severity` - f.`reviewer_severity`) >= 2
      )) >= 3
    );
END;
