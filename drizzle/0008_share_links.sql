CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`token` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_share_links_token` ON `share_links` (`token`);--> statement-breakpoint
CREATE INDEX `idx_share_links_experiment` ON `share_links` (`experiment_id`);
