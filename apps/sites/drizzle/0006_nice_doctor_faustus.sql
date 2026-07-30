CREATE TABLE `system_alert_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`dedupe_key` text NOT NULL,
	`source` text NOT NULL,
	`event_type` text NOT NULL,
	`severity` text NOT NULL,
	`status` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`summary_zh` text NOT NULL,
	`summary_en` text NOT NULL,
	`payload_json` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`delivered_at` text,
	`telegram_message_id` text,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `system_alert_deliveries_dedupe_unique` ON `system_alert_deliveries` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `system_alert_deliveries_status_next_idx` ON `system_alert_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `system_alert_deliveries_source_created_idx` ON `system_alert_deliveries` (`source`,`created_at`);