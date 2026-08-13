CREATE TABLE `observation_flags_p3s07` (
	`observation_id` text NOT NULL,
	`flag` text NOT NULL,
	PRIMARY KEY(`observation_id`,`flag`),
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "observation_flags_p3s07_value_check" CHECK(`flag` IN (
		'jump_scare', 'blood', 'weapon', 'verbal_bullying', 'physical_bullying',
		'bereavement', 'separation', 'flashing_sequence', 'nudity', 'kissing',
		'intimate_touching', 'sexual_dialogue', 'smoking_or_vaping', 'alcohol_use',
		'drug_use', 'gambling_activity', 'religious_reference_or_practice'
	))
);
--> statement-breakpoint
CREATE TRIGGER `observation_flags_p3s07_category_guard`
BEFORE INSERT ON `observation_flags_p3s07`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1
	FROM `observations` AS observation
	WHERE observation.`id` = NEW.`observation_id`
		AND (
			NEW.`flag` = 'religious_reference_or_practice'
			OR (observation.`category` = 'fear' AND NEW.`flag` = 'jump_scare')
			OR (observation.`category` = 'violence' AND NEW.`flag` IN ('blood', 'weapon'))
			OR (observation.`category` = 'bullying' AND NEW.`flag` IN ('verbal_bullying', 'physical_bullying'))
			OR (observation.`category` = 'grief' AND NEW.`flag` IN ('bereavement', 'separation'))
			OR (observation.`category` = 'flashingLights' AND NEW.`flag` = 'flashing_sequence')
			OR (observation.`category` = 'sexualContent' AND NEW.`flag` IN ('nudity', 'kissing', 'intimate_touching', 'sexual_dialogue'))
			OR (observation.`category` = 'substances' AND NEW.`flag` IN ('smoking_or_vaping', 'alcohol_use', 'drug_use', 'gambling_activity'))
		)
)
BEGIN
	SELECT RAISE(ABORT, 'observation flag is incompatible with observation category');
END;
--> statement-breakpoint
INSERT INTO `observation_flags_p3s07` (`observation_id`, `flag`)
SELECT `observation_id`, `flag` FROM `observation_flags`;
--> statement-breakpoint
DROP TABLE `observation_flags`;
--> statement-breakpoint
ALTER TABLE `observation_flags_p3s07` RENAME TO `observation_flags`;
--> statement-breakpoint
CREATE INDEX `observation_flags_flag_idx` ON `observation_flags` (`flag`);
--> statement-breakpoint
CREATE TRIGGER `observation_flags_immutable_update`
BEFORE UPDATE ON `observation_flags`
BEGIN
	SELECT RAISE(ABORT, 'review observation flags are immutable revisions');
END;
--> statement-breakpoint
CREATE TRIGGER `observation_flags_immutable_delete`
BEFORE DELETE ON `observation_flags`
BEGIN
	SELECT RAISE(ABORT, 'review observation flags are immutable revisions');
END;
--> statement-breakpoint
CREATE TABLE `evidence_publication_fact_flags_p3s07` (
	`fact_id` text NOT NULL,
	`flag` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`fact_id`,`flag`),
	FOREIGN KEY (`fact_id`) REFERENCES `evidence_publication_facts`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "evidence_publication_fact_flags_p3s07_value_check" CHECK(`flag` IN (
		'jump_scare', 'blood', 'weapon', 'verbal_bullying', 'physical_bullying',
		'bereavement', 'separation', 'flashing_sequence', 'nudity', 'kissing',
		'intimate_touching', 'sexual_dialogue', 'smoking_or_vaping', 'alcohol_use',
		'drug_use', 'gambling_activity', 'religious_reference_or_practice'
	))
);
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_fact_flags_p3s07_category_guard`
BEFORE INSERT ON `evidence_publication_fact_flags_p3s07`
FOR EACH ROW
WHEN NOT EXISTS (
	SELECT 1
	FROM `evidence_publication_facts` AS fact
	WHERE fact.`id` = NEW.`fact_id`
		AND (
			NEW.`flag` = 'religious_reference_or_practice'
			OR (fact.`category` = 'fear' AND NEW.`flag` = 'jump_scare')
			OR (fact.`category` = 'violence' AND NEW.`flag` IN ('blood', 'weapon'))
			OR (fact.`category` = 'bullying' AND NEW.`flag` IN ('verbal_bullying', 'physical_bullying'))
			OR (fact.`category` = 'grief' AND NEW.`flag` IN ('bereavement', 'separation'))
			OR (fact.`category` = 'flashingLights' AND NEW.`flag` = 'flashing_sequence')
			OR (fact.`category` = 'sexualContent' AND NEW.`flag` IN ('nudity', 'kissing', 'intimate_touching', 'sexual_dialogue'))
			OR (fact.`category` = 'substances' AND NEW.`flag` IN ('smoking_or_vaping', 'alcohol_use', 'drug_use', 'gambling_activity'))
		)
)
BEGIN
	SELECT RAISE(ABORT, 'evidence publication fact flag is incompatible with fact category');
END;
--> statement-breakpoint
INSERT INTO `evidence_publication_fact_flags_p3s07` (`fact_id`, `flag`, `created_at`)
SELECT `fact_id`, `flag`, `created_at` FROM `evidence_publication_fact_flags`;
--> statement-breakpoint
DROP TABLE `evidence_publication_fact_flags`;
--> statement-breakpoint
ALTER TABLE `evidence_publication_fact_flags_p3s07` RENAME TO `evidence_publication_fact_flags`;
--> statement-breakpoint
CREATE INDEX `evidence_publication_fact_flags_flag_idx` ON `evidence_publication_fact_flags` (`flag`);
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_fact_flags_no_update`
BEFORE UPDATE ON `evidence_publication_fact_flags`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication fact flags are append-only') END;
END;
--> statement-breakpoint
CREATE TRIGGER `evidence_publication_fact_flags_no_delete`
BEFORE DELETE ON `evidence_publication_fact_flags`
BEGIN
	SELECT CASE WHEN 1 THEN RAISE(ABORT, 'evidence publication fact flags are append-only') END;
END;