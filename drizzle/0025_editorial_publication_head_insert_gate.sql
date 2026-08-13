CREATE TRIGGER `editorial_publication_heads_insert_gate`
BEFORE INSERT ON `editorial_publication_heads`
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `editorial_publication_revisions` publication
    WHERE publication.`id` = NEW.`current_revision_id`
      AND publication.`title_id` = NEW.`title_id`
      AND publication.`public_id` = NEW.`public_id`
      AND publication.`revision` = NEW.`revision`
      AND publication.`supersedes_revision_id` IS NULL
      AND publication.`revision_kind` IN ('initial', 'legacy_bootstrap')
      AND publication.`decision_status` = 'insufficient_data'
      AND publication.`decision_eligible` = 0
  ) THEN RAISE(ABORT, 'editorial head requires a matching initial or legacy-bootstrap snapshot') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM `editorial_publication_sources` WHERE `publication_revision_id` = NEW.`current_revision_id`)
    THEN RAISE(ABORT, 'editorial publication requires at least one source') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM `editorial_publication_claims` WHERE `publication_revision_id` = NEW.`current_revision_id`)
    THEN RAISE(ABORT, 'editorial publication requires at least one claim') END;
  SELECT CASE WHEN (
    SELECT COUNT(DISTINCT category) FROM (
      SELECT `category` FROM `editorial_publication_claims` WHERE `publication_revision_id` = NEW.`current_revision_id`
      UNION ALL
      SELECT `category` FROM `editorial_publication_uncertain_categories` WHERE `publication_revision_id` = NEW.`current_revision_id`
    )
  ) <> 10 THEN RAISE(ABORT, 'editorial publication must explicitly partition all ten content categories') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM `editorial_publication_claims` claim
    INNER JOIN `editorial_publication_uncertain_categories` uncertain
      ON uncertain.`publication_revision_id` = claim.`publication_revision_id`
     AND uncertain.`category` = claim.`category`
    WHERE claim.`publication_revision_id` = NEW.`current_revision_id`
  ) THEN RAISE(ABORT, 'editorial publication cannot mark a claimed category uncertain') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM `editorial_publication_claims` claim
    WHERE claim.`publication_revision_id` = NEW.`current_revision_id`
      AND NOT EXISTS (SELECT 1 FROM `editorial_publication_claim_sources` link WHERE link.`claim_id` = claim.`id`)
  ) THEN RAISE(ABORT, 'every editorial claim must have at least one linked source') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM `editorial_publication_sources` source
    WHERE source.`publication_revision_id` = NEW.`current_revision_id`
      AND NOT EXISTS (SELECT 1 FROM `editorial_publication_claim_sources` link WHERE link.`source_id` = source.`id`)
  ) THEN RAISE(ABORT, 'every editorial source must support at least one claim') END;
  SELECT CASE WHEN EXISTS (
    SELECT claim.`id`
    FROM `editorial_publication_claims` claim
    LEFT JOIN `editorial_publication_claim_sources` link ON link.`claim_id` = claim.`id`
    LEFT JOIN `editorial_publication_sources` source ON source.`id` = link.`source_id`
    WHERE claim.`publication_revision_id` = NEW.`current_revision_id`
    GROUP BY claim.`id`, claim.`verification`
    HAVING (claim.`verification` = 'corroborated' AND COUNT(DISTINCT source.`independence_group_id`) < 2)
       OR (claim.`verification` = 'single_source' AND COUNT(DISTINCT source.`independence_group_id`) <> 1)
  ) THEN RAISE(ABORT, 'editorial claim verification does not match independent-source support') END;
END;
