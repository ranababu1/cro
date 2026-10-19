ALTER TABLE `heatmap_points` ADD `source` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `heatmap_points` ADD `visitor` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE TABLE `heatmap_scroll_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`experiment_id` text NOT NULL,
	`variation_id` text NOT NULL,
	`device` text NOT NULL,
	`depth` integer NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`visitor` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_heatmap_scroll_points_exp` ON `heatmap_scroll_points` (`experiment_id`,`variation_id`,`device`);--> statement-breakpoint
CREATE INDEX `idx_heatmap_scroll_points_created` ON `heatmap_scroll_points` (`created_at`);
