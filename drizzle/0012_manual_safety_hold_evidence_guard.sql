-- P2Q-04: manual collusion-suspicion holds must cite stored audit evidence,
-- and at least one cited event must directly reference the target reviewer.

CREATE TRIGGER `reviewer_manual_safety_hold_evidence_guard`
BEFORE INSERT ON `internal_audit_events`
FOR EACH ROW
WHEN NEW.`event_type` = 'reviewer_safety_hold_placed'
  AND json_extract(NEW.`payload_json`, '$.source') = 'manual_collusion_suspicion'
BEGIN
  SELECT CASE
    WHEN json_type(NEW.`payload_json`, '$.evidence.evidenceEventIds') <> 'array'
      OR json_array_length(NEW.`payload_json`, '$.evidence.evidenceEventIds') NOT BETWEEN 1 AND 20
    THEN RAISE(ABORT, 'manual reviewer safety hold requires stored audit evidence ids')
  END;

  SELECT CASE
    WHEN EXISTS (
      SELECT 1
      FROM json_each(NEW.`payload_json`, '$.evidence.evidenceEventIds') evidence
      WHERE NOT EXISTS (
        SELECT 1 FROM `internal_audit_events` i WHERE i.`id` = evidence.value
      )
      AND NOT EXISTS (
        SELECT 1 FROM `review_audit_events` r WHERE r.`id` = evidence.value
      )
    ) THEN RAISE(ABORT, 'manual reviewer safety hold references missing audit evidence')
  END;

  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM json_each(NEW.`payload_json`, '$.evidence.evidenceEventIds') evidence
      WHERE EXISTS (
        SELECT 1
        FROM `internal_audit_events` i
        WHERE i.`id` = evidence.value
          AND (
            i.`entity_id` = NEW.`entity_id`
            OR json_extract(i.`payload_json`, '$.reviewerId') = NEW.`entity_id`
            OR json_extract(i.`payload_json`, '$.subjectReviewerId') = NEW.`entity_id`
          )
      )
      OR EXISTS (
        SELECT 1
        FROM `review_audit_events` r
        LEFT JOIN `review_audit_outcomes` o
          ON r.`entity_type` = 'review_audit_outcome' AND o.`id` = r.`entity_id`
        WHERE r.`id` = evidence.value
          AND (
            json_extract(r.`payload_json`, '$.subjectReviewerId') = NEW.`entity_id`
            OR o.`subject_reviewer_id` = NEW.`entity_id`
          )
      )
    ) THEN RAISE(ABORT, 'manual reviewer safety hold evidence is not linked to the target reviewer')
  END;
END;
