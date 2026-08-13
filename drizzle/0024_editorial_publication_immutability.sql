CREATE TRIGGER `editorial_publication_sources_insert_guard`
BEFORE INSERT ON `editorial_publication_sources`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM `editorial_publication_heads` WHERE `current_revision_id` = NEW.`publication_revision_id`)
    OR EXISTS (SELECT 1 FROM `editorial_publication_revisions` WHERE `supersedes_revision_id` = NEW.`publication_revision_id`)
    THEN RAISE(ABORT, 'finalized editorial publication children are immutable') END;
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_claims_insert_guard`
BEFORE INSERT ON `editorial_publication_claims`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM `editorial_publication_heads` WHERE `current_revision_id` = NEW.`publication_revision_id`)
    OR EXISTS (SELECT 1 FROM `editorial_publication_revisions` WHERE `supersedes_revision_id` = NEW.`publication_revision_id`)
    THEN RAISE(ABORT, 'finalized editorial publication children are immutable') END;
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_claim_sources_insert_guard`
BEFORE INSERT ON `editorial_publication_claim_sources`
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `editorial_publication_claims` claim
    INNER JOIN `editorial_publication_sources` source ON source.`id` = NEW.`source_id`
    WHERE claim.`id` = NEW.`claim_id`
      AND claim.`publication_revision_id` = NEW.`publication_revision_id`
      AND source.`publication_revision_id` = NEW.`publication_revision_id`
  ) THEN RAISE(ABORT, 'editorial claim-source link must stay inside one publication revision') END;
  SELECT CASE WHEN EXISTS (SELECT 1 FROM `editorial_publication_heads` WHERE `current_revision_id` = NEW.`publication_revision_id`)
    OR EXISTS (SELECT 1 FROM `editorial_publication_revisions` WHERE `supersedes_revision_id` = NEW.`publication_revision_id`)
    THEN RAISE(ABORT, 'finalized editorial publication children are immutable') END;
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_uncertain_insert_guard`
BEFORE INSERT ON `editorial_publication_uncertain_categories`
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM `editorial_publication_heads` WHERE `current_revision_id` = NEW.`publication_revision_id`)
    OR EXISTS (SELECT 1 FROM `editorial_publication_revisions` WHERE `supersedes_revision_id` = NEW.`publication_revision_id`)
    THEN RAISE(ABORT, 'finalized editorial publication children are immutable') END;
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_sources_no_update`
BEFORE UPDATE ON `editorial_publication_sources`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication sources are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_sources_no_delete`
BEFORE DELETE ON `editorial_publication_sources`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication sources are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_claims_no_update`
BEFORE UPDATE ON `editorial_publication_claims`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication claims are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_claims_no_delete`
BEFORE DELETE ON `editorial_publication_claims`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication claims are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_claim_sources_no_update`
BEFORE UPDATE ON `editorial_publication_claim_sources`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication claim-source links are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_claim_sources_no_delete`
BEFORE DELETE ON `editorial_publication_claim_sources`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication claim-source links are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_uncertain_no_update`
BEFORE UPDATE ON `editorial_publication_uncertain_categories`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication uncertain categories are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_uncertain_no_delete`
BEFORE DELETE ON `editorial_publication_uncertain_categories`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication uncertain categories are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_heads_no_delete`
BEFORE DELETE ON `editorial_publication_heads`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication heads cannot be deleted') END; END;
