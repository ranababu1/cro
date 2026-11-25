ALTER TABLE `organizations` ADD `plan_ends_at` text;--> statement-breakpoint
CREATE TABLE `billing_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_subscription_id` text NOT NULL,
	`provider_plan_id` text,
	`plan` text,
	`period` text,
	`status` text NOT NULL,
	`paid_through` text,
	`next_billing_at` text,
	`last_payment_at` text,
	`created_by` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_billing_subscriptions_provider_id` ON `billing_subscriptions` (`provider`,`provider_subscription_id`);--> statement-breakpoint
CREATE INDEX `idx_billing_subscriptions_org` ON `billing_subscriptions` (`org_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `billing_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`resource_id` text,
	`received_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`processed_at` text,
	`result` text
);
