CREATE TABLE `domain_ledger` (
	`domain` text PRIMARY KEY NOT NULL,
	`org_id` text,
	`claimed_at` text,
	`experiments_used` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
CREATE INDEX `idx_domain_ledger_org` ON `domain_ledger` (`org_id`);
