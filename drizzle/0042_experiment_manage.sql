ALTER TABLE `experiments` ADD `hypothesis` text;--> statement-breakpoint
ALTER TABLE `experiments` ADD `expected_outcome` text;--> statement-breakpoint
ALTER TABLE `experiments` ADD `tags` text;--> statement-breakpoint
ALTER TABLE `experiments` ADD `archived_at` text;--> statement-breakpoint
CREATE INDEX `idx_audit_entity_created` ON `audit_log` (`entity_id`,`created_at`);
