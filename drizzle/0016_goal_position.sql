ALTER TABLE `goals` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `goals` SET `position` = (
	SELECT `rn` FROM (
		SELECT `id` AS `gid`, ROW_NUMBER() OVER (PARTITION BY `experiment_id` ORDER BY `is_primary` DESC, `created_at` ASC, `id` ASC) - 1 AS `rn` FROM `goals`
	) WHERE `gid` = `goals`.`id`
);--> statement-breakpoint
CREATE INDEX `idx_goals_experiment_position` ON `goals` (`experiment_id`,`position`);
