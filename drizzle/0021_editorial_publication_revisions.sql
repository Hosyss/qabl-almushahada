CREATE TABLE `editorial_publication_revisions` (
  `id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL,
  `title_id` text NOT NULL,
  `revision` integer NOT NULL,
  `supersedes_revision_id` text,
  `revision_kind` text NOT NULL,
  `publication_state` text NOT NULL,
  `title_label` text NOT NULL,
  `title_ar` text NOT NULL,
  `title_en` text NOT NULL,
  `release_year` integer NOT NULL,
  `kind` text NOT NULL,
  `policy_version` text NOT NULL,
  `published_at` text NOT NULL,
  `updated_at` text NOT NULL,
  `scope_ar` text NOT NULL,
  `analysis_ar` text NOT NULL,
  `decision_status` text NOT NULL DEFAULT 'insufficient_data',
  `decision_eligible` integer NOT NULL DEFAULT 0,
  `content_fingerprint` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`supersedes_revision_id`) REFERENCES `editorial_publication_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `editorial_publication_revision_check` CHECK(`revision` >= 1),
  CONSTRAINT `editorial_publication_revision_kind_check` CHECK(`revision_kind` IN ('initial', 'legacy_bootstrap', 'revision')),
  CONSTRAINT `editorial_publication_state_check` CHECK(`publication_state` IN ('published', 'withdrawn')),
  CONSTRAINT `editorial_publication_public_id_check` CHECK(length(trim(`public_id`)) BETWEEN 1 AND 160),
  CONSTRAINT `editorial_publication_title_label_check` CHECK(length(trim(`title_label`)) BETWEEN 1 AND 240),
  CONSTRAINT `editorial_publication_title_ar_check` CHECK(length(trim(`title_ar`)) BETWEEN 1 AND 240),
  CONSTRAINT `editorial_publication_title_en_check` CHECK(length(trim(`title_en`)) BETWEEN 1 AND 240),
  CONSTRAINT `editorial_publication_year_check` CHECK(`release_year` BETWEEN 1880 AND 2200),
  CONSTRAINT `editorial_publication_kind_check` CHECK(`kind` IN ('movie', 'series', 'episode', 'special')),
  CONSTRAINT `editorial_publication_policy_check` CHECK(length(trim(`policy_version`)) BETWEEN 1 AND 120),
  CONSTRAINT `editorial_publication_published_check` CHECK(datetime(`published_at`) IS NOT NULL),
  CONSTRAINT `editorial_publication_updated_check` CHECK(datetime(`updated_at`) IS NOT NULL),
  CONSTRAINT `editorial_publication_scope_check` CHECK(length(trim(`scope_ar`)) BETWEEN 20 AND 1200),
  CONSTRAINT `editorial_publication_analysis_check` CHECK(length(trim(`analysis_ar`)) BETWEEN 40 AND 2400),
  CONSTRAINT `editorial_publication_decision_status_check` CHECK(`decision_status` = 'insufficient_data'),
  CONSTRAINT `editorial_publication_decision_eligible_check` CHECK(`decision_eligible` = 0),
  CONSTRAINT `editorial_publication_fingerprint_check` CHECK(length(`content_fingerprint`) = 71 AND substr(`content_fingerprint`, 1, 7) = 'sha256:')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_public_revision_unique` ON `editorial_publication_revisions` (`public_id`, `revision`);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_title_revision_unique` ON `editorial_publication_revisions` (`title_id`, `revision`);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_supersedes_unique` ON `editorial_publication_revisions` (`supersedes_revision_id`) WHERE `supersedes_revision_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `editorial_publication_title_idx` ON `editorial_publication_revisions` (`title_id`, `publication_state`, `revision`);
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_revision_lineage_guard`
BEFORE INSERT ON `editorial_publication_revisions`
BEGIN
  SELECT CASE WHEN NEW.`revision_kind` = 'initial' AND (NEW.`revision` <> 1 OR NEW.`supersedes_revision_id` IS NOT NULL)
    THEN RAISE(ABORT, 'initial editorial publication must start at revision one without a predecessor') END;
  SELECT CASE WHEN NEW.`revision_kind` = 'legacy_bootstrap' AND NEW.`supersedes_revision_id` IS NOT NULL
    THEN RAISE(ABORT, 'legacy editorial bootstrap cannot claim an unpersisted predecessor') END;
  SELECT CASE WHEN NEW.`revision_kind` = 'revision' AND NOT EXISTS (
    SELECT 1 FROM `editorial_publication_revisions` previous
    WHERE previous.`id` = NEW.`supersedes_revision_id`
      AND previous.`public_id` = NEW.`public_id`
      AND previous.`title_id` = NEW.`title_id`
      AND previous.`revision` = NEW.`revision` - 1
  ) THEN RAISE(ABORT, 'editorial publication revision lineage is invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_revisions_no_update`
BEFORE UPDATE ON `editorial_publication_revisions`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication revisions are append-only') END; END;
--> statement-breakpoint
CREATE TRIGGER `editorial_publication_revisions_no_delete`
BEFORE DELETE ON `editorial_publication_revisions`
BEGIN SELECT CASE WHEN 1 THEN RAISE(ABORT, 'editorial publication revisions are append-only') END; END;
