CREATE TABLE `usage_daily` (
	`org_id` text NOT NULL,
	`day` text NOT NULL,
	`visitors` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`org_id`, `day`),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
ALTER TABLE `organizations` ADD `experiments_started_total` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `organizations` SET `experiments_started_total` = (
	SELECT count(*) FROM experiments x JOIN projects p ON p.id = x.project_id
	WHERE p.org_id = organizations.id AND x.started_at IS NOT NULL
);
