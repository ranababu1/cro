CREATE TABLE `heatmap_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` text NOT NULL,
	`experiment_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`selector` text NOT NULL,
	`rage` integer DEFAULT false NOT NULL,
	`dead` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_heatmap_points_exp` ON `heatmap_points` (`experiment_id`,`variation_id`,`device`);--> statement-breakpoint
CREATE INDEX `idx_heatmap_points_created` ON `heatmap_points` (`created_at`);--> statement-breakpoint
CREATE TABLE `heatmap_clicks_daily` (
	`experiment_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`day` text NOT NULL,
	`gx` integer NOT NULL,
	`gy` integer NOT NULL,
	`selector` text NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`rage` integer DEFAULT 0 NOT NULL,
	`dead` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`experiment_id`, `variation_id`, `device`, `day`, `gx`, `gy`, `selector`),
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE TABLE `heatmap_scroll_daily` (
	`experiment_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`day` text NOT NULL,
	`depth` integer NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`experiment_id`, `variation_id`, `device`, `day`, `depth`),
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);
