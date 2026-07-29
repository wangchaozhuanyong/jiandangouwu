CREATE TABLE `backup_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_key` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`object_key` text NOT NULL,
	`schema_version` integer NOT NULL,
	`record_counts_json` text NOT NULL,
	`byte_size` integer,
	`checksum_sha256` text,
	`created_by_email` text,
	`reason` text NOT NULL,
	`error_code` text,
	`created_at` text NOT NULL,
	`verified_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backup_snapshots_schedule_key_unique` ON `backup_snapshots` (`schedule_key`);--> statement-breakpoint
CREATE INDEX `backup_snapshots_created_idx` ON `backup_snapshots` (`created_at`);--> statement-breakpoint
CREATE INDEX `backup_snapshots_status_created_idx` ON `backup_snapshots` (`status`,`created_at`);