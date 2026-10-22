CREATE TABLE `signup_counts` (
	`scope` text NOT NULL,
	`key_hash` text NOT NULL,
	`day` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`scope`, `key_hash`, `day`)
);
--> statement-breakpoint
CREATE INDEX `idx_signup_counts_day` ON `signup_counts` (`day`);--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_by` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `abuse_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`org_id` text,
	`actor_id` text,
	`ip_hash` text,
	`detail` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_abuse_events_created` ON `abuse_events` (`created_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `signup_ip_hash` text;
