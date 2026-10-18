CREATE TABLE `funnels` (
	`id` text PRIMARY KEY NOT NULL,
	`experiment_id` text NOT NULL,
	`name` text NOT NULL,
	`steps` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_funnels_experiment` ON `funnels` (`experiment_id`);
