CREATE TABLE `traffic_daily` (
	`day` text NOT NULL,
	`environment_id` text NOT NULL,
	`project_id` text NOT NULL,
	`dim` text NOT NULL,
	`key` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `environment_id`, `dim`, `key`),
	FOREIGN KEY (`environment_id`) REFERENCES `environments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_traffic_daily_env_dim` ON `traffic_daily` (`environment_id`,`dim`,`day`);
