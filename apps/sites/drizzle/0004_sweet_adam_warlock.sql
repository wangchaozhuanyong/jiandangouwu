CREATE TABLE `data_key_versions` (
	`key_id` text PRIMARY KEY NOT NULL,
	`slot` text NOT NULL,
	`status` text NOT NULL,
	`contacts_migrated` integer DEFAULT 0 NOT NULL,
	`backups_migrated` integer DEFAULT 0 NOT NULL,
	`error_code` text,
	`created_at` text NOT NULL,
	`activated_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `data_key_versions_status_created_idx` ON `data_key_versions` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `exchange_rate_sync_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_key` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text NOT NULL,
	`provider_summary` text NOT NULL,
	`updated_currencies_json` text DEFAULT '[]' NOT NULL,
	`error_code` text,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rate_sync_runs_schedule_unique` ON `exchange_rate_sync_runs` (`schedule_key`);--> statement-breakpoint
CREATE INDEX `exchange_rate_sync_runs_started_idx` ON `exchange_rate_sync_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `privacy_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`requester_reference` text NOT NULL,
	`requester_lookup_hash` text NOT NULL,
	`reason` text NOT NULL,
	`identity_verified_at` text,
	`completed_at` text,
	`created_by_email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_status_created_idx` ON `privacy_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `privacy_requests_lookup_idx` ON `privacy_requests` (`requester_lookup_hash`);--> statement-breakpoint
CREATE TABLE `telegram_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text,
	`order_number` text NOT NULL,
	`event_type` text NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text,
	`delivered_at` text,
	`telegram_message_id` text,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `telegram_deliveries_order_event_unique` ON `telegram_deliveries` (`order_id`,`event_type`);--> statement-breakpoint
CREATE INDEX `telegram_deliveries_status_next_idx` ON `telegram_deliveries` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `telegram_deliveries_created_idx` ON `telegram_deliveries` (`created_at`);--> statement-breakpoint
ALTER TABLE `orders` ADD `contact_erased_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `contact_erasure_request_id` text;--> statement-breakpoint
INSERT OR IGNORE INTO `site_settings`
  (`key`,`value_json`,`version`,`updated_at`,`updated_by_email`)
VALUES
  ('exchange-rates.sync','{"enabled":true,"intervalMinutes":360,"modes":{"CNY":"AUTO","USD":"AUTO","SGD":"AUTO","EUR":"AUTO","GBP":"AUTO","JPY":"AUTO","IDR":"AUTO","USDT":"AUTO"}}',1,'2026-07-29T00:00:00.000Z',NULL);--> statement-breakpoint
INSERT OR IGNORE INTO `site_settings`
  (`key`,`value_json`,`version`,`updated_at`,`updated_by_email`)
VALUES
  ('data-governance.retention','{"enabled":false,"contactAnonymizeAfterDays":180,"orderRetentionDays":730,"auditRetentionDays":365,"telegramRetentionDays":90,"backupRetentionDays":30}',1,'2026-07-29T00:00:00.000Z',NULL);
