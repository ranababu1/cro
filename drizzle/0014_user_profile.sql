ALTER TABLE `users` ADD `first_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `last_name` text;--> statement-breakpoint
ALTER TABLE `users` ADD `country` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `company` text;--> statement-breakpoint
ALTER TABLE `users` ADD `job_role` text;--> statement-breakpoint
ALTER TABLE `users` ADD `company_size` text;--> statement-breakpoint
ALTER TABLE `users` ADD `heard_from` text;--> statement-breakpoint
ALTER TABLE `users` ADD `primary_goal` text;--> statement-breakpoint
ALTER TABLE `users` ADD `marketing_opt_in` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_completed_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_pending` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `profile_prompt_dismissed_at` text;
