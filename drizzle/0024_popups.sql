CREATE TABLE `popups` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`config` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_popups_project` ON `popups` (`project_id`);--> statement-breakpoint
CREATE TABLE `popup_daily` (
	`day` text NOT NULL,
	`popup_id` text NOT NULL,
	`metric` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `popup_id`, `metric`),
	FOREIGN KEY (`popup_id`) REFERENCES `popups`(`id`) ON UPDATE no action ON DELETE cascade
);
