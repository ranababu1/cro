ALTER TABLE `organizations` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `suspended_at` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `suspended_reason` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `plan` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `monthly_visitor_limit` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `monthly_experiment_limit` integer;