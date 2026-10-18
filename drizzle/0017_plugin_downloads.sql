CREATE TABLE `plugin_downloads` (
	`id` text PRIMARY KEY NOT NULL,
	`plugin` text NOT NULL,
	`version` text NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`ip_hash` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_plugin_downloads_user` ON `plugin_downloads` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_plugin_downloads_org` ON `plugin_downloads` (`org_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_plugin_downloads_created` ON `plugin_downloads` (`created_at`);
