CREATE TABLE `public_report_intakes` (
  `id` text PRIMARY KEY NOT NULL,
  `target_kind` text NOT NULL,
  `target_public_id` text NOT NULL,
  `target_revision` integer NOT NULL,
  `target_snapshot_ref` text NOT NULL,
  `target_version_id` text,
  `report_reason` text NOT NULL,
  `message` text NOT NULL,
  `client_key_hash` text NOT NULL,
  `status` text DEFAULT 'received' NOT NULL,
  `material_report_id` text REFERENCES `review_reports`(`id`) ON UPDATE no action ON DELETE restrict,
  `triaged_by_user_id` text REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  `triage_note` text,
  `revision` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `triaged_at` text,
  CONSTRAINT `public_report_intakes_target_kind_check`
    CHECK (`target_kind` IN ('human_review', 'evidence_publication', 'editorial_publication')),
  CONSTRAINT `public_report_intakes_target_revision_check` CHECK (`target_revision` >= 0),
  CONSTRAINT `public_report_intakes_reason_check`
    CHECK (`report_reason` IN ('wrong_version', 'missing_content', 'incorrect_content', 'source_issue', 'spoiler', 'other')),
  CONSTRAINT `public_report_intakes_message_check` CHECK (length(trim(`message`)) BETWEEN 20 AND 1500),
  CONSTRAINT `public_report_intakes_client_hash_check` CHECK (length(`client_key_hash`) = 64),
  CONSTRAINT `public_report_intakes_status_check` CHECK (`status` IN ('received', 'dismissed', 'promoted')),
  CONSTRAINT `public_report_intakes_revision_check` CHECK (`revision` >= 0),
  CONSTRAINT `public_report_intakes_triage_state_check` CHECK (
    (`status` = 'received' AND `material_report_id` IS NULL AND `triaged_by_user_id` IS NULL AND `triage_note` IS NULL AND `triaged_at` IS NULL)
    OR
    (`status` = 'dismissed' AND `material_report_id` IS NULL AND `triaged_by_user_id` IS NOT NULL AND length(trim(`triage_note`)) BETWEEN 10 AND 2000 AND `triaged_at` IS NOT NULL)
    OR
    (`status` = 'promoted' AND `target_kind` = 'human_review' AND `material_report_id` IS NOT NULL AND `triaged_by_user_id` IS NOT NULL AND length(trim(`triage_note`)) BETWEEN 10 AND 2000 AND `triaged_at` IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX `public_report_intakes_client_time_idx`
  ON `public_report_intakes` (`client_key_hash`, `created_at`);
--> statement-breakpoint
CREATE INDEX `public_report_intakes_target_status_idx`
  ON `public_report_intakes` (`target_kind`, `target_public_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE INDEX `public_report_intakes_status_time_idx`
  ON `public_report_intakes` (`status`, `created_at`);
--> statement-breakpoint
CREATE TRIGGER `public_report_intakes_payload_immutable_update`
BEFORE UPDATE ON `public_report_intakes`
WHEN NEW.`target_kind` <> OLD.`target_kind`
  OR NEW.`target_public_id` <> OLD.`target_public_id`
  OR NEW.`target_revision` <> OLD.`target_revision`
  OR NEW.`target_snapshot_ref` <> OLD.`target_snapshot_ref`
  OR COALESCE(NEW.`target_version_id`, '') <> COALESCE(OLD.`target_version_id`, '')
  OR NEW.`report_reason` <> OLD.`report_reason`
  OR NEW.`message` <> OLD.`message`
  OR NEW.`client_key_hash` <> OLD.`client_key_hash`
  OR NEW.`created_at` <> OLD.`created_at`
BEGIN
  SELECT RAISE(ABORT, 'public report intake payload is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `public_report_intakes_no_delete`
BEFORE DELETE ON `public_report_intakes`
BEGIN
  SELECT RAISE(ABORT, 'public report intake history is append-only');
END;
