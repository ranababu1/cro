CREATE TABLE `ai_keys` (
	`org_id` text NOT NULL,
	`provider` text NOT NULL,
	`key_enc` text NOT NULL,
	`last4` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`org_id`, `provider`),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_settings` (
	`org_id` text PRIMARY KEY NOT NULL,
	`text_provider` text,
	`text_model` text,
	`image_provider` text,
	`image_model` text,
	`updated_by` text,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`org_id` text NOT NULL,
	`hour` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`org_id`, `hour`)
);
--> statement-breakpoint
CREATE INDEX `idx_ai_usage_hour` ON `ai_usage` (`hour`);
