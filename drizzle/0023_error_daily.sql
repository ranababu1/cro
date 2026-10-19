CREATE TABLE `error_daily` (
	`day` text NOT NULL,
	`experiment_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`kind` text NOT NULL,
	`message` text NOT NULL,
	`source` text NOT NULL,
	`line` integer DEFAULT 0 NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `experiment_id`, `variation_id`, `fingerprint`),
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_error_daily_exp_day` ON `error_daily` (`experiment_id`,`day`);
