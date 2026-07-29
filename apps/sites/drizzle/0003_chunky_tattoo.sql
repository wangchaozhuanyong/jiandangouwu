ALTER TABLE `backup_snapshots` ADD `restore_validation_status` text DEFAULT 'NOT_RUN' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_snapshots` ADD `restore_validation_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `backup_snapshots` ADD `restore_validated_at` text;--> statement-breakpoint
ALTER TABLE `backup_snapshots` ADD `restore_validated_by_email` text;--> statement-breakpoint
ALTER TABLE `backup_snapshots` ADD `restore_validation_reason` text;--> statement-breakpoint
ALTER TABLE `backup_snapshots` ADD `restore_validation_error_code` text;