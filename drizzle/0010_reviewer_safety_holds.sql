-- P2Q-04: append-only reviewer safety holds driven by completed independent audits.
-- Hold and resolution history lives in internal_audit_events so it cannot be rewritten.

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
            AND o.`status` = 'correction_required'
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

CREATE TRIGGER `reviewer_safety_hold_resolution_insert_guard`
BEFORE INSERT ON `internal_audit_events`
FOR EACH ROW
WHEN NEW.`event_type` = 'reviewer_safety_hold_resolved'
BEGIN
  SELECT CASE
    WHEN NEW.`entity_type` <> 'reviewer'
      OR json_extract(NEW.`payload_json`, '$.resolution') NOT IN ('cleared', 'remediation_required')
      OR length(trim(COALESCE(json_extract(NEW.`payload_json`, '$.note'), ''))) NOT BETWEEN 10 AND 4000
    THEN RAISE(ABORT, 'reviewer safety hold resolution payload is invalid')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM `internal_users`
      WHERE `id` = NEW.`actor_user_id` AND `role` = 'admin' AND `status` = 'active'
    ) THEN RAISE(ABORT, 'reviewer safety hold resolution requires an active admin')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM `internal_audit_events` h
      WHERE h.`id` = json_extract(NEW.`payload_json`, '$.holdEventId')
        AND h.`event_type` = 'reviewer_safety_hold_placed'
        AND h.`entity_type` = 'reviewer'
        AND h.`entity_id` = NEW.`entity_id`
    ) THEN RAISE(ABORT, 'reviewer safety hold resolution does not match a hold')
  END;
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM `internal_audit_events` r
      WHERE r.`event_type` = 'reviewer_safety_hold_resolved'
        AND json_extract(r.`payload_json`, '$.holdEventId') = json_extract(NEW.`payload_json`, '$.holdEventId')
    ) THEN RAISE(ABORT, 'reviewer safety hold is already resolved')
  END;
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM `reviewers` r
      INNER JOIN `internal_users` u ON u.`reviewer_id` = r.`id`
      WHERE r.`id` = NEW.`entity_id`
        AND r.`status` = 'suspended'
        AND u.`status` = 'suspended'
    ) THEN RAISE(ABORT, 'reviewer safety hold resolution requires a suspended reviewer account')
  END;
END;
--> statement-breakpoint

CREATE TRIGGER `reviewer_activation_blocked_by_unresolved_safety_hold`
BEFORE UPDATE OF `status` ON `reviewers`
FOR EACH ROW
WHEN NEW.`status` = 'active'
  AND EXISTS (
    SELECT 1
    FROM `internal_audit_events` h
    WHERE h.`event_type` = 'reviewer_safety_hold_placed'
      AND h.`entity_type` = 'reviewer'
      AND h.`entity_id` = OLD.`id`
      AND NOT EXISTS (
        SELECT 1 FROM `internal_audit_events` r
        WHERE r.`event_type` = 'reviewer_safety_hold_resolved'
          AND json_extract(r.`payload_json`, '$.holdEventId') = h.`id`
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'reviewer activation is blocked by an unresolved safety hold');
END;
--> statement-breakpoint

CREATE TRIGGER `reviewer_reactivation_attempt_blocked_by_unresolved_safety_hold`
BEFORE INSERT ON `reviewer_reference_attempts`
FOR EACH ROW
WHEN NEW.`purpose` IN ('reactivation', 'drift')
  AND EXISTS (
    SELECT 1
    FROM `internal_audit_events` h
    WHERE h.`event_type` = 'reviewer_safety_hold_placed'
      AND h.`entity_type` = 'reviewer'
      AND h.`entity_id` = NEW.`reviewer_id`
      AND NOT EXISTS (
        SELECT 1 FROM `internal_audit_events` r
        WHERE r.`event_type` = 'reviewer_safety_hold_resolved'
          AND json_extract(r.`payload_json`, '$.holdEventId') = h.`id`
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'reference reactivation is blocked until human safety-hold resolution');
END;
--> statement-breakpoint

CREATE TRIGGER `reviewer_safety_hold_from_audit_outcome`
AFTER UPDATE OF `status` ON `review_audit_outcomes`
FOR EACH ROW
WHEN OLD.`status` = 'pending' AND NEW.`status` = 'correction_required'
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
          SELECT 'HIGH_SENSITIVITY_EVENT_MISSED' AS code
          WHERE EXISTS (
            SELECT 1 FROM `review_audit_findings` f
            WHERE f.`outcome_id` = NEW.`id`
              AND f.`finding_type` = 'missed_event'
              AND (
                f.`auditor_severity` = 4
                OR f.`category` = 'selfHarm'
                OR (f.`category` IN ('sexualContent', 'flashingLights') AND f.`auditor_severity` >= 2)
                OR (f.`category` IN ('violence', 'substances', 'discrimination', 'bullying') AND f.`auditor_severity` >= 3)
              )
          )
          UNION ALL
          SELECT 'EXTREME_SEVERITY_GAP'
          WHERE EXISTS (
            SELECT 1 FROM `review_audit_findings` f
            WHERE f.`outcome_id` = NEW.`id`
              AND f.`finding_type` = 'severity_difference'
              AND abs(f.`auditor_severity` - f.`reviewer_severity`) = 3
          )
          UNION ALL
          SELECT 'REPEATED_CORRECTIONS'
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
        )
      )),
      'evidence', json_object(
        'currentEpochSampleSize', (
          SELECT COUNT(*) FROM `review_audit_outcomes` o
          WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
            AND o.`status` IN ('confirmed', 'correction_required')
            AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
        ),
        'evaluatedWindowSize', (
          SELECT COUNT(*) FROM (
            SELECT o.`id` FROM `review_audit_outcomes` o
            WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
              AND o.`status` IN ('confirmed', 'correction_required')
              AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
            ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
          )
        ),
        'latestHighSensitivityMissedEvents', (
          SELECT COUNT(*) FROM `review_audit_findings` f
          WHERE f.`outcome_id` = NEW.`id`
            AND f.`finding_type` = 'missed_event'
            AND (
              f.`auditor_severity` = 4 OR f.`category` = 'selfHarm'
              OR (f.`category` IN ('sexualContent', 'flashingLights') AND f.`auditor_severity` >= 2)
              OR (f.`category` IN ('violence', 'substances', 'discrimination', 'bullying') AND f.`auditor_severity` >= 3)
            )
        ),
        'latestMaxSeverityDelta', COALESCE((
          SELECT MAX(abs(f.`auditor_severity` - f.`reviewer_severity`))
          FROM `review_audit_findings` f
          WHERE f.`outcome_id` = NEW.`id` AND f.`finding_type` = 'severity_difference'
        ), 0)
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
      EXISTS (
        SELECT 1 FROM `review_audit_findings` f
        WHERE f.`outcome_id` = NEW.`id`
          AND f.`finding_type` = 'missed_event'
          AND (
            f.`auditor_severity` = 4 OR f.`category` = 'selfHarm'
            OR (f.`category` IN ('sexualContent', 'flashingLights') AND f.`auditor_severity` >= 2)
            OR (f.`category` IN ('violence', 'substances', 'discrimination', 'bullying') AND f.`auditor_severity` >= 3)
          )
      )
      OR EXISTS (
        SELECT 1 FROM `review_audit_findings` f
        WHERE f.`outcome_id` = NEW.`id`
          AND f.`finding_type` = 'severity_difference'
          AND abs(f.`auditor_severity` - f.`reviewer_severity`) = 3
      )
      OR (
        (SELECT COUNT(*) FROM (
          SELECT o.`id` FROM `review_audit_outcomes` o
          WHERE o.`subject_reviewer_id` = NEW.`subject_reviewer_id`
            AND o.`status` IN ('confirmed', 'correction_required')
            AND datetime(o.`completed_at`) >= datetime((SELECT `updated_at` FROM `reviewers` WHERE `id` = NEW.`subject_reviewer_id`))
          ORDER BY datetime(o.`completed_at`) DESC, o.`id` DESC LIMIT 20
        )) = 20
        AND (
          (SELECT COUNT(*) FROM (
            SELECT o.`id`, o.`status` FROM `review_audit_outcomes` o
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
        )
      )
    );

  UPDATE `reviewers`
  SET `status` = 'suspended', `updated_at` = CURRENT_TIMESTAMP
  WHERE `id` = NEW.`subject_reviewer_id`
    AND `status` = 'active'
    AND EXISTS (
      SELECT 1 FROM `internal_audit_events` h
      WHERE h.`event_type` = 'reviewer_safety_hold_placed'
        AND h.`entity_id` = NEW.`subject_reviewer_id`
        AND json_extract(h.`payload_json`, '$.triggeringOutcomeId') = NEW.`id`
    );

  UPDATE `internal_users`
  SET `status` = 'suspended',
      `revision` = `revision` + 1,
      `last_transition_id` = (
        SELECT h.`id` FROM `internal_audit_events` h
        WHERE h.`event_type` = 'reviewer_safety_hold_placed'
          AND h.`entity_id` = NEW.`subject_reviewer_id`
          AND json_extract(h.`payload_json`, '$.triggeringOutcomeId') = NEW.`id`
        LIMIT 1
      ),
      `updated_at` = CURRENT_TIMESTAMP
  WHERE `reviewer_id` = NEW.`subject_reviewer_id`
    AND `status` = 'active'
    AND EXISTS (
      SELECT 1 FROM `internal_audit_events` h
      WHERE h.`event_type` = 'reviewer_safety_hold_placed'
        AND h.`entity_id` = NEW.`subject_reviewer_id`
        AND json_extract(h.`payload_json`, '$.triggeringOutcomeId') = NEW.`id`
    );
END;
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
    AND EXISTS (
      SELECT 1 FROM `review_assignments` a
      WHERE a.`bundle_id` = `review_bundles`.`id`
        AND a.`reviewer_id` = NEW.`entity_id`
    );
END;
