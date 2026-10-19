CREATE TABLE `page_heatmaps` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`match` text NOT NULL,
	`match_value` text NOT NULL,
	`preview_url` text,
	`heatmap_sample` integer,
	`heatmap_stop_days` integer,
	`heatmap_stop_views` integer,
	`heatmap_views` integer DEFAULT 0 NOT NULL,
	`heatmap_since` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_page_heatmaps_project` ON `page_heatmaps` (`project_id`);
--> statement-breakpoint
CREATE TABLE `page_heatmap_clicks_daily` (
	`heatmap_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`day` text NOT NULL,
	`gx` integer NOT NULL,
	`gy` integer NOT NULL,
	`selector` text NOT NULL,
	`clicks` integer DEFAULT 0 NOT NULL,
	`rage` integer DEFAULT 0 NOT NULL,
	`dead` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`heatmap_id`, `variation_id`, `device`, `day`, `gx`, `gy`, `selector`),
	FOREIGN KEY (`heatmap_id`) REFERENCES `page_heatmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_heatmap_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_id` text NOT NULL,
	`heatmap_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`x` integer NOT NULL,
	`y` integer NOT NULL,
	`selector` text NOT NULL,
	`rage` integer DEFAULT false NOT NULL,
	`dead` integer DEFAULT false NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`visitor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`heatmap_id`) REFERENCES `page_heatmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_page_heatmap_points_hm` ON `page_heatmap_points` (`heatmap_id`,`variation_id`,`device`);
--> statement-breakpoint
CREATE INDEX `idx_page_heatmap_points_created` ON `page_heatmap_points` (`created_at`);
--> statement-breakpoint
CREATE TABLE `page_heatmap_scroll_daily` (
	`heatmap_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`day` text NOT NULL,
	`depth` integer NOT NULL,
	`sessions` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`heatmap_id`, `variation_id`, `device`, `day`, `depth`),
	FOREIGN KEY (`heatmap_id`) REFERENCES `page_heatmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_heatmap_scroll_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`heatmap_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`depth` integer NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`visitor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`heatmap_id`) REFERENCES `page_heatmaps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_page_heatmap_scroll_points_hm` ON `page_heatmap_scroll_points` (`heatmap_id`,`variation_id`,`device`);
--> statement-breakpoint
CREATE INDEX `idx_page_heatmap_scroll_points_created` ON `page_heatmap_scroll_points` (`created_at`);
