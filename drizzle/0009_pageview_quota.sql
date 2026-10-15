ALTER TABLE `organizations` ADD `monthly_pageview_limit` integer;--> statement-breakpoint
CREATE TABLE `usage_monthly` (
	`org_id` text NOT NULL,
	`month` text NOT NULL,
	`pageviews` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`org_id`, `month`),
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE cascade
);
