CREATE TABLE `free_test_usage` (
	`scope` text NOT NULL,
	`key` text NOT NULL,
	`month` text NOT NULL,
	`tests` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`scope`, `key`, `month`)
);
