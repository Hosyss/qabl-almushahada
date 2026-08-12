ALTER TABLE `internal_users` ADD `revision` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `internal_users` ADD `last_transition_id` text;
--> statement-breakpoint
ALTER TABLE `review_bundles` ADD `workflow_transition_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `review_bundles_workflow_transition_unique` ON `review_bundles` (`workflow_transition_id`);
--> statement-breakpoint
CREATE TABLE `internal_audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_user_id` text NOT NULL,
  `event_type` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `payload_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`actor_user_id`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE restrict,
  CONSTRAINT `internal_audit_events_json_check` CHECK(json_valid(`payload_json`)),
  CONSTRAINT `internal_audit_events_event_type_check` CHECK(length(trim(`event_type`)) > 0),
  CONSTRAINT `internal_audit_events_entity_type_check` CHECK(length(trim(`entity_type`)) > 0),
  CONSTRAINT `internal_audit_events_entity_id_check` CHECK(length(trim(`entity_id`)) > 0)
);
--> statement-breakpoint
CREATE INDEX `internal_audit_events_actor_time_idx` ON `internal_audit_events` (`actor_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `internal_audit_events_entity_idx` ON `internal_audit_events` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE TRIGGER `internal_users_identity_lock`
BEFORE UPDATE OF `auth_email`, `role`, `reviewer_id` ON `internal_users`
FOR EACH ROW
WHEN OLD.`auth_email` <> NEW.`auth_email`
  OR OLD.`role` <> NEW.`role`
  OR COALESCE(OLD.`reviewer_id`, '') <> COALESCE(NEW.`reviewer_id`, '')
BEGIN
  SELECT RAISE(ABORT, 'internal user identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `internal_users_revision_guard_insert`
BEFORE INSERT ON `internal_users`
FOR EACH ROW
WHEN NEW.`revision` < 0
BEGIN
  SELECT RAISE(ABORT, 'internal user revision must be nonnegative');
END;
--> statement-breakpoint
CREATE TRIGGER `internal_users_revision_guard_update`
BEFORE UPDATE OF `revision` ON `internal_users`
FOR EACH ROW
WHEN NEW.`revision` < 0
BEGIN
  SELECT RAISE(ABORT, 'internal user revision must be nonnegative');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_events_immutable_update`
BEFORE UPDATE ON `review_audit_events`
BEGIN
  SELECT RAISE(ABORT, 'review audit events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `review_audit_events_immutable_delete`
BEFORE DELETE ON `review_audit_events`
BEGIN
  SELECT RAISE(ABORT, 'review audit events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `internal_audit_events_immutable_update`
BEFORE UPDATE ON `internal_audit_events`
BEGIN
  SELECT RAISE(ABORT, 'internal audit events are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `internal_audit_events_immutable_delete`
BEFORE DELETE ON `internal_audit_events`
BEGIN
  SELECT RAISE(ABORT, 'internal audit events are append-only');
END;
