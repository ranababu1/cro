ALTER TABLE `usage_monthly` ADD `visitors` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TABLE `org_visitors_monthly` (
	`org_id` text NOT NULL,
	`month` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`org_id`, `month`, `user_id`),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `experiment_stats_daily` (
	`experiment_id` text NOT NULL,
	`scope` text NOT NULL,
	`variation_id` text NOT NULL,
	`day` text NOT NULL,
	`bucket` text NOT NULL,
	`users` integer DEFAULT 0 NOT NULL,
	`events` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`experiment_id`, `scope`, `variation_id`, `day`, `bucket`),
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `rollup_state` (
	`experiment_id` text PRIMARY KEY NOT NULL,
	`rolled_through` text NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_events_experiment_user` ON `events` (`experiment_id`,`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_events_experiment_created` ON `events` (`experiment_id`,`created_at`);--> statement-breakpoint
INSERT OR IGNORE INTO `org_visitors_monthly` (`org_id`, `month`, `user_id`)
SELECT DISTINCT p.org_id, substr(a.assigned_at, 1, 7), a.user_id
FROM assignments a JOIN experiments x ON x.id = a.experiment_id JOIN projects p ON p.id = x.project_id;--> statement-breakpoint
INSERT INTO `usage_monthly` (`org_id`, `month`, `pageviews`, `visitors`)
SELECT org_id, month, 0, count(*) FROM org_visitors_monthly GROUP BY org_id, month
ON CONFLICT(`org_id`, `month`) DO UPDATE SET `visitors` = excluded.visitors;
