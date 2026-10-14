ALTER TABLE `users` ADD `last_active_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` text;--> statement-breakpoint
CREATE TABLE `telemetry_daily` (
	`day` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `scope_type`, `scope_id`, `metric`)
);
--> statement-breakpoint
CREATE INDEX `idx_telemetry_daily_scope` ON `telemetry_daily` (`scope_type`,`scope_id`,`day`);--> statement-breakpoint
CREATE INDEX `idx_telemetry_daily_metric` ON `telemetry_daily` (`metric`,`day`);--> statement-breakpoint
CREATE TABLE `product_events` (
	`id` text PRIMARY KEY NOT NULL,
	`occurred_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`user_id` text,
	`org_id` text,
	`project_id` text,
	`experiment_id` text,
	`action` text NOT NULL,
	`meta` text,
	`ip_hash` text
);
--> statement-breakpoint
CREATE INDEX `idx_product_events_occurred` ON `product_events` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_product_events_action` ON `product_events` (`action`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_product_events_user` ON `product_events` (`user_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_product_events_org` ON `product_events` (`org_id`,`occurred_at`);
