ALTER TABLE `organizations` ADD `scheduled_plan` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `scheduled_period` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `scheduled_plan_at` text;--> statement-breakpoint
ALTER TABLE `billing_subscriptions` ADD `replaces_subscription_id` text;--> statement-breakpoint
ALTER TABLE `billing_subscriptions` ADD `payment_failed_at` text;
