CREATE TABLE `webhooks` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`url` text NOT NULL,
	`secret` text NOT NULL,
	`events` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`last_delivery_at` text,
	`last_status` integer,
	`last_error` text,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_webhooks_org` ON `webhooks` (`org_id`);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`webhook_id` text NOT NULL,
	`org_id` text NOT NULL,
	`event` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`locked_at` text,
	`response_status` integer,
	`last_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`sent_at` text,
	FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_webhook_deliveries_dedupe` ON `webhook_deliveries` (`webhook_id`,`dedupe_key`);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_due` ON `webhook_deliveries` (`status`,`next_attempt_at`);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_webhook` ON `webhook_deliveries` (`webhook_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_webhook_deliveries_created` ON `webhook_deliveries` (`created_at`);
