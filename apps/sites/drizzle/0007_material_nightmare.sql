CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`currency_code` text NOT NULL,
	`amount` text NOT NULL,
	`reference_currency_code` text,
	`reference_amount` text,
	`exchange_rate_snapshot` text NOT NULL,
	`product_version` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_items_order_product_unique` ON `order_items` (`order_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `order_items_order_sort_idx` ON `order_items` (`order_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `order_items_product_created_idx` ON `order_items` (`product_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_lookup_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_hash` text NOT NULL,
	`window_started_at` text NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `order_lookup_rate_limits_subject_window_unique` ON `order_lookup_rate_limits` (`subject_kind`,`subject_hash`,`window_started_at`);--> statement-breakpoint
CREATE INDEX `order_lookup_rate_limits_expires_idx` ON `order_lookup_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `product_surfaces` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`surface` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_surfaces_product_surface_unique` ON `product_surfaces` (`product_id`,`surface`);--> statement-breakpoint
CREATE INDEX `product_surfaces_surface_visible_sort_idx` ON `product_surfaces` (`surface`,`is_visible`,`sort_order`);--> statement-breakpoint
CREATE TABLE `skill_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_categories_slug_unique` ON `skill_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `skill_categories_status_sort_idx` ON `skill_categories` (`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `skill_category_translations` (
	`category_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`category_id`, `locale`),
	FOREIGN KEY (`category_id`) REFERENCES `skill_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_category_translations_locale_name_idx` ON `skill_category_translations` (`locale`,`name`);--> statement-breakpoint
CREATE TABLE `skill_translations` (
	`skill_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`suitable_for_json` text DEFAULT '[]' NOT NULL,
	`unsuitable_for_json` text DEFAULT '[]' NOT NULL,
	`install_hint` text NOT NULL,
	PRIMARY KEY(`skill_id`, `locale`),
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_translations_locale_name_idx` ON `skill_translations` (`locale`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`category_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`source_level` text NOT NULL,
	`maintainer` text NOT NULL,
	`github_url` text NOT NULL,
	`documentation_url` text,
	`license` text NOT NULL,
	`compatible_environments_json` text DEFAULT '[]' NOT NULL,
	`verified_at` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `skill_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_unique` ON `skills` (`slug`);--> statement-breakpoint
CREATE INDEX `skills_category_status_sort_idx` ON `skills` (`category_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `skills_status_sort_idx` ON `skills` (`status`,`sort_order`);--> statement-breakpoint
ALTER TABLE `categories` ADD `parent_id` text REFERENCES categories(id);--> statement-breakpoint
CREATE INDEX `categories_parent_status_sort_idx` ON `categories` (`parent_id`,`status`,`sort_order`);--> statement-breakpoint
INSERT OR IGNORE INTO `categories`
  (`id`, `slug`, `parent_id`, `status`, `sort_order`, `version`, `created_at`, `updated_at`)
SELECT
  'category-primary-ai-services',
  'ai-services',
  NULL,
  'ACTIVE',
  COALESCE(MIN(`sort_order`), 0),
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM `categories`
WHERE `id` != 'category-primary-ai-services';--> statement-breakpoint
INSERT OR IGNORE INTO `category_translations` (`category_id`, `locale`, `name`)
VALUES
  ('category-primary-ai-services', 'ZH', 'AI 软件服务'),
  ('category-primary-ai-services', 'EN', 'AI software services');--> statement-breakpoint
UPDATE `categories`
SET
  `parent_id` = 'category-primary-ai-services',
  `version` = `version` + 1,
  `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `id` != 'category-primary-ai-services' AND `parent_id` IS NULL;--> statement-breakpoint
ALTER TABLE `heroes` ADD `placement` text DEFAULT 'HOME' NOT NULL;--> statement-breakpoint
ALTER TABLE `heroes` ADD `mobile_image_key` text;--> statement-breakpoint
ALTER TABLE `heroes` ADD `target_type` text DEFAULT 'PRODUCT' NOT NULL;--> statement-breakpoint
ALTER TABLE `heroes` ADD `target_value` text;--> statement-breakpoint
ALTER TABLE `heroes` ADD `secondary_cta_zh` text;--> statement-breakpoint
ALTER TABLE `heroes` ADD `secondary_cta_en` text;--> statement-breakpoint
ALTER TABLE `heroes` ADD `secondary_target_type` text;--> statement-breakpoint
ALTER TABLE `heroes` ADD `secondary_target_value` text;--> statement-breakpoint
CREATE INDEX `heroes_placement_status_sort_idx` ON `heroes` (`placement`,`status`,`sort_order`);--> statement-breakpoint
UPDATE `heroes`
SET `target_value` = `target_slug`
WHERE `target_value` IS NULL AND `target_slug` IS NOT NULL;--> statement-breakpoint
UPDATE `site_settings`
SET
  `value_json` = json_set(
    `value_json`,
    '$.bannerVisibility',
    json('{"HOME":true,"TRANSIT_SUBSCRIPTIONS":true,"AI_RECHARGE":true}')
  ),
  `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE `key` = 'storefront.settings'
  AND json_type(`value_json`, '$.bannerVisibility') IS NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `platform_key` text;--> statement-breakpoint
ALTER TABLE `products` ADD `transit_plan_type` text;--> statement-breakpoint
INSERT OR IGNORE INTO `product_surfaces`
  (`id`, `product_id`, `surface`, `sort_order`, `is_visible`, `version`, `created_at`, `updated_at`)
SELECT
  'surface-home-' || `id`,
  `id`,
  'HOME',
  `sort_order`,
  1,
  1,
  `created_at`,
  `updated_at`
FROM `products`;--> statement-breakpoint
INSERT OR IGNORE INTO `order_items`
  (`id`, `order_id`, `product_id`, `product_name_snapshot`, `currency_code`, `amount`,
   `reference_currency_code`, `reference_amount`, `exchange_rate_snapshot`, `product_version`,
   `sort_order`, `created_at`)
SELECT
  'legacy-item-' || `id`,
  `id`,
  `product_id`,
  `product_name_snapshot`,
  `currency_code`,
  `amount`,
  `reference_currency_code`,
  `reference_amount`,
  `exchange_rate_snapshot`,
  `product_version`,
  0,
  `created_at`
FROM `orders`;
--> statement-breakpoint
PRAGMA optimize;
