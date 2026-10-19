ALTER TABLE `experiments` ADD `heatmap_sample` integer;--> statement-breakpoint
ALTER TABLE `experiments` ADD `heatmap_stop_days` integer;--> statement-breakpoint
ALTER TABLE `experiments` ADD `heatmap_stop_views` integer;--> statement-breakpoint
ALTER TABLE `experiments` ADD `heatmap_views` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `experiments` ADD `heatmap_since` text;
