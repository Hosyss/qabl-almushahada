CREATE TABLE `editorial_spot_checks` (
	`approval_id` text NOT NULL,
	`observation_id` text NOT NULL,
	`result` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`checked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`approval_id`, `observation_id`),
	FOREIGN KEY (`approval_id`) REFERENCES `editorial_approvals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`observation_id`) REFERENCES `observations`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `editorial_spot_checks_result_idx` ON `editorial_spot_checks` (`result`);