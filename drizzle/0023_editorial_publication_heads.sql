CREATE TABLE `editorial_publication_heads` (
  `title_id` text PRIMARY KEY NOT NULL,
  `public_id` text NOT NULL,
  `current_revision_id` text NOT NULL,
  `revision` integer NOT NULL,
  `last_transition_id` text NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE restrict,
  FOREIGN KEY (`current_revision_id`) REFERENCES `editorial_publication_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `editorial_head_revision_check` CHECK(`revision` >= 1),
  CONSTRAINT `editorial_head_public_id_check` CHECK(length(trim(`public_id`)) BETWEEN 1 AND 160),
  CONSTRAINT `editorial_head_transition_check` CHECK(length(trim(`last_transition_id`)) BETWEEN 1 AND 200)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_heads_public_unique` ON `editorial_publication_heads` (`public_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_heads_revision_unique` ON `editorial_publication_heads` (`current_revision_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `editorial_publication_heads_transition_unique` ON `editorial_publication_heads` (`last_transition_id`);
