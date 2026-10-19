CREATE INDEX IF NOT EXISTS `idx_popup_daily_popup` ON `popup_daily` (`popup_id`,`day`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_survey_daily_survey` ON `survey_daily` (`survey_id`,`day`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_survey_responses_day` ON `survey_responses` (`day`);
