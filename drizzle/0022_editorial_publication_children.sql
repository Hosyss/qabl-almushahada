CREATE TABLE `editorial_publication_sources` (
  `id` text PRIMARY KEY NOT NULL,
  `publication_revision_id` text NOT NULL,
  `source_key` text NOT NULL,
  `publisher` text NOT NULL,
  `source_type` text NOT NULL,
  `source_url` text NOT NULL,
  `accessed_on` text NOT NULL,
  `independence_group_id` text NOT NULL,
  `usage_basis` text NOT NULL,
  `rights_label` text NOT NULL,
  `rights_url` text NOT NULL,
  `usage_note_ar` text NOT NULL,
  `source_version` text,
  `attribution_text` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`publication_revision_id`) REFERENCES `editorial_publication_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `editorial_source_key_check` CHECK(length(trim(`source_key`)) BETWEEN 1 AND 160),
  CONSTRAINT `editorial_source_publisher_check` CHECK(length(trim(`publisher`)) BETWEEN 2 AND 160),
  CONSTRAINT `editorial_source_type_check` CHECK(`source_type` IN ('published_review', 'official_classification', 'open_encyclopedia')),
  CONSTRAINT `editorial_source_url_check` CHECK(`source_url` LIKE 'https://%'),
  CONSTRAINT `editorial_source_accessed_check` CHECK(date(`accessed_on`) IS NOT NULL),
  CONSTRAINT `editorial_source_independence_check` CHECK(length(trim(`independence_group_id`)) BETWEEN 2 AND 160),
  CONSTRAINT `editorial_source_usage_check` CHECK(`usage_basis` IN ('open_license', 'link_only_factual_reference')),
  CONSTRAINT `editorial_source_rights_check` CHECK(length(trim(`rights_label`)) BETWEEN 3 AND 240 AND `rights_url` LIKE 'https://%'),
  CONSTRAINT `editorial_source_note_check` CHECK(length(trim(`usage_note_ar`)) BETWEEN 20 AND 900),
  CONSTRAINT `editorial_source_version_check` CHECK(`source_version` IS NULL OR length(trim(`source_version`)) BETWEEN 1 AND 160),
  CONSTRAINT `editorial_source_attribution_check` CHECK(`attribution_text` IS NULL OR length(trim(`attribution_text`)) BETWEEN 3 AND 700)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_source_key_unique` ON `editorial_publication_sources` (`publication_revision_id`, `source_key`);
--> statement-breakpoint
CREATE INDEX `editorial_publication_sources_revision_idx` ON `editorial_publication_sources` (`publication_revision_id`);
--> statement-breakpoint
CREATE TABLE `editorial_publication_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `publication_revision_id` text NOT NULL,
  `claim_key` text NOT NULL,
  `category` text NOT NULL,
  `summary_ar` text NOT NULL,
  `verification` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`publication_revision_id`) REFERENCES `editorial_publication_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `editorial_claim_key_check` CHECK(length(trim(`claim_key`)) BETWEEN 1 AND 160),
  CONSTRAINT `editorial_claim_category_check` CHECK(`category` IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights')),
  CONSTRAINT `editorial_claim_summary_check` CHECK(length(trim(`summary_ar`)) BETWEEN 20 AND 1000),
  CONSTRAINT `editorial_claim_verification_check` CHECK(`verification` IN ('corroborated', 'single_source'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_claim_key_unique` ON `editorial_publication_claims` (`publication_revision_id`, `claim_key`);
--> statement-breakpoint
CREATE INDEX `editorial_publication_claims_revision_category_idx` ON `editorial_publication_claims` (`publication_revision_id`, `category`);
--> statement-breakpoint
CREATE TABLE `editorial_publication_claim_sources` (
  `publication_revision_id` text NOT NULL,
  `claim_id` text NOT NULL,
  `source_id` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`claim_id`, `source_id`),
  FOREIGN KEY (`publication_revision_id`) REFERENCES `editorial_publication_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`claim_id`) REFERENCES `editorial_publication_claims`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`source_id`) REFERENCES `editorial_publication_sources`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `editorial_publication_claim_sources_revision_idx` ON `editorial_publication_claim_sources` (`publication_revision_id`);
--> statement-breakpoint
CREATE TABLE `editorial_publication_uncertain_categories` (
  `publication_revision_id` text NOT NULL,
  `category` text NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (`publication_revision_id`, `category`),
  FOREIGN KEY (`publication_revision_id`) REFERENCES `editorial_publication_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `editorial_uncertain_category_check` CHECK(`category` IN ('fear', 'violence', 'language', 'bullying', 'sexualContent', 'substances', 'discrimination', 'selfHarm', 'grief', 'flashingLights'))
);
