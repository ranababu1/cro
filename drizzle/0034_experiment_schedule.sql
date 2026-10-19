ALTER TABLE `experiments` ADD `schedule_start_at` text;
--> statement-breakpoint
ALTER TABLE `experiments` ADD `schedule_stop_at` text;
--> statement-breakpoint
ALTER TABLE `experiments` ADD `schedule_error` text;
--> statement-breakpoint
ALTER TABLE `experiments` ADD `ramp_start` integer;
--> statement-breakpoint
ALTER TABLE `experiments` ADD `ramp_step` integer;
--> statement-breakpoint
ALTER TABLE `experiments` ADD `ramp_every_hours` integer;
--> statement-breakpoint
CREATE INDEX `idx_experiments_schedule_start` ON `experiments` (`schedule_start_at`);
--> statement-breakpoint
CREATE INDEX `idx_experiments_schedule_stop` ON `experiments` (`schedule_stop_at`);
