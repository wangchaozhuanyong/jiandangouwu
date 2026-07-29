CREATE TABLE `admin_members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`permissions_json` text NOT NULL,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_members_email_unique` ON `admin_members` (`email`);--> statement-breakpoint
CREATE INDEX `admin_members_status_idx` ON `admin_members` (`status`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`trace_id` text NOT NULL,
	`action` text NOT NULL,
	`result` text NOT NULL,
	`actor_email` text,
	`actor_display_name` text,
	`target_type` text,
	`target_id` text,
	`reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_events_created_idx` ON `audit_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_action_result_idx` ON `audit_events` (`action`,`result`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_status_sort_idx` ON `categories` (`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `category_translations` (
	`category_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`category_id`, `locale`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_translations_locale_name_idx` ON `category_translations` (`locale`,`name`);--> statement-breakpoint
CREATE TABLE `currencies` (
	`code` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`digits` integer DEFAULT 2 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `currencies_active_sort_idx` ON `currencies` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`from_code` text NOT NULL,
	`to_code` text NOT NULL,
	`rate` text NOT NULL,
	`source` text NOT NULL,
	`effective_at` text NOT NULL,
	`expires_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`from_code`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_code`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rates_pair_effective_unique` ON `exchange_rates` (`from_code`,`to_code`,`effective_at`);--> statement-breakpoint
CREATE INDEX `exchange_rates_pair_effective_idx` ON `exchange_rates` (`from_code`,`to_code`,`effective_at`);--> statement-breakpoint
CREATE TABLE `hero_translations` (
	`hero_id` text NOT NULL,
	`locale` text NOT NULL,
	`eyebrow` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`cta` text NOT NULL,
	PRIMARY KEY(`hero_id`, `locale`),
	FOREIGN KEY (`hero_id`) REFERENCES `heroes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `heroes` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`image_key` text NOT NULL,
	`target_slug` text,
	`tone` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `heroes_key_unique` ON `heroes` (`key`);--> statement-breakpoint
CREATE INDEX `heroes_status_sort_idx` ON `heroes` (`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `media_objects` (
	`key` text PRIMARY KEY NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`uploaded_by_email` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_objects_created_idx` ON `media_objects` (`created_at`);--> statement-breakpoint
CREATE TABLE `merchant_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`mode` text NOT NULL,
	`label_zh` text NOT NULL,
	`label_en` text NOT NULL,
	`public_account` text NOT NULL,
	`direct_target` text,
	`service_hours_zh` text NOT NULL,
	`service_hours_en` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_channels_type_unique` ON `merchant_channels` (`type`);--> statement-breakpoint
CREATE INDEX `merchant_channels_active_sort_idx` ON `merchant_channels` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `order_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text,
	`actor_email` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_status_history_order_created_idx` ON `order_status_history` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`product_id` text NOT NULL,
	`product_name_snapshot` text NOT NULL,
	`currency_code` text NOT NULL,
	`amount` text NOT NULL,
	`reference_currency_code` text,
	`reference_amount` text,
	`exchange_rate_snapshot` text NOT NULL,
	`product_version` integer NOT NULL,
	`contact_channel` text NOT NULL,
	`contact_encrypted` text NOT NULL,
	`contact_hash` text NOT NULL,
	`masked_contact` text NOT NULL,
	`accepted_policy_version` text NOT NULL,
	`status` text DEFAULT 'MANUAL_PENDING' NOT NULL,
	`payment_mode` text DEFAULT 'MANUAL' NOT NULL,
	`reserved_until` text NOT NULL,
	`inventory_reserved` integer DEFAULT false NOT NULL,
	`inventory_released_at` text,
	`assigned_to_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`order_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency_unique` ON `orders` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `orders_status_created_idx` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `orders_product_created_idx` ON `orders` (`product_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_translations` (
	`product_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`kicker` text DEFAULT '' NOT NULL,
	`description` text NOT NULL,
	`aliases_json` text,
	PRIMARY KEY(`product_id`, `locale`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_translations_locale_name_idx` ON `product_translations` (`locale`,`normalized_name`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`category_id` text NOT NULL,
	`image_key` text NOT NULL,
	`base_price` text NOT NULL,
	`compare_at_price` text,
	`stock_mode` text DEFAULT 'FINITE' NOT NULL,
	`stock_quantity` integer,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `products_category_status_sort_idx` ON `products` (`category_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `products_status_sort_idx` ON `products` (`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_email` text
);
--> statement-breakpoint
INSERT INTO `categories` (`id`,`slug`,`status`,`sort_order`,`version`,`created_at`,`updated_at`) VALUES
('cat-development','development','ACTIVE',1,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('cat-assistant','assistant','ACTIVE',2,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('cat-research','research','ACTIVE',3,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('cat-creative','creative','ACTIVE',4,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `category_translations` (`category_id`,`locale`,`name`) VALUES
('cat-development','ZH','编码开发'),('cat-development','EN','Coding & development'),
('cat-assistant','ZH','通用助手'),('cat-assistant','EN','General assistants'),
('cat-research','ZH','研究效率'),('cat-research','EN','Research & productivity'),
('cat-creative','ZH','图像创作'),('cat-creative','EN','Image creation');
--> statement-breakpoint
INSERT INTO `products` (`id`,`slug`,`category_id`,`image_key`,`base_price`,`compare_at_price`,`stock_mode`,`stock_quantity`,`status`,`sort_order`,`version`,`created_at`,`updated_at`) VALUES
('product-codex','codex','cat-development','/assets/product-codex.webp','89.00','109.00','FINITE',12,'ACTIVE',1,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('product-gemini','gemini','cat-assistant','/assets/product-gemini.webp','79.00','99.00','FINITE',8,'ACTIVE',2,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('product-chatgpt','chatgpt','cat-assistant','/assets/product-chatgpt.webp','92.00','119.00','UNLIMITED',NULL,'ACTIVE',3,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('product-claude','claude','cat-assistant','/assets/product-claude.webp','85.00','108.00','FINITE',3,'ACTIVE',4,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('product-cursor','cursor','cat-development','/assets/product-cursor.webp','76.00','96.00','FINITE',15,'ACTIVE',5,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('product-perplexity','perplexity','cat-research','/assets/product-perplexity.webp','72.00','90.00','FINITE',9,'ACTIVE',6,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('product-copilot','copilot','cat-development','/assets/product-copilot.webp','68.00','86.00','UNLIMITED',NULL,'ACTIVE',7,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('product-midjourney','midjourney','cat-creative','/assets/product-midjourney.webp','118.00','148.00','FINITE',0,'ACTIVE',8,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `product_translations` (`product_id`,`locale`,`name`,`normalized_name`,`kicker`,`description`,`aliases_json`) VALUES
('product-codex','ZH','OpenAI Codex 专业版','openai codex 专业版','开发工作流','适合希望把需求理解、代码修改、执行与验证串联起来的开发者。提交订单后，客服会根据你填写的联系方式确认服务方式与交付信息。',NULL),
('product-codex','EN','OpenAI Codex Professional','openai codex professional','Developer workflow','For developers who want requirements, code changes, execution and verification in one connected workflow. Support will confirm delivery through your chosen contact channel.',NULL),
('product-gemini','ZH','Gemini Advanced','gemini advanced','多模态协作','面向文字、图片、文档与复杂任务的多模态 AI 服务。','["Google Gemini"]'),
('product-gemini','EN','Gemini Advanced','gemini advanced','Multimodal work','A multimodal AI service for text, images, documents and complex tasks.','["Google Gemini"]'),
('product-chatgpt','ZH','ChatGPT Plus','chatgpt plus','通用智能助手','适用于写作、分析、学习与日常知识工作的通用 AI 服务。无需注册商城账号即可提交订单。','["OpenAI ChatGPT"]'),
('product-chatgpt','EN','ChatGPT Plus','chatgpt plus','General AI assistant','A general AI service for writing, analysis, learning and everyday knowledge work.','["OpenAI ChatGPT"]'),
('product-claude','ZH','Claude Pro','claude pro','长文与推理','适合长文阅读、结构化写作与复杂问题分析。','["Anthropic Claude"]'),
('product-claude','EN','Claude Pro','claude pro','Long-form reasoning','Built for long-form reading, structured writing and complex analysis.','["Anthropic Claude"]'),
('product-cursor','ZH','Cursor Pro','cursor pro','AI 代码编辑器','面向实际代码库工作的 AI 编辑体验，适合高频编程和项目维护。',NULL),
('product-cursor','EN','Cursor Pro','cursor pro','AI code editor','An AI editor experience made for real codebases, frequent coding and project maintenance.',NULL),
('product-perplexity','ZH','Perplexity Pro','perplexity pro','研究与检索','为资料检索、来源整理与快速研究打造的 AI 服务。',NULL),
('product-perplexity','EN','Perplexity Pro','perplexity pro','Research and search','An AI service designed for research, source discovery and rapid synthesis.',NULL),
('product-copilot','ZH','GitHub Copilot','github copilot','编码辅助','适合在编辑器与代码托管工作流中使用的智能编码辅助服务。',NULL),
('product-copilot','EN','GitHub Copilot','github copilot','Coding assistant','An intelligent coding assistant for editor and repository workflows.',NULL),
('product-midjourney','ZH','Midjourney Standard','midjourney standard','视觉生成','面向视觉创意与图像生成的服务。',NULL),
('product-midjourney','EN','Midjourney Standard','midjourney standard','Visual generation','A service for visual ideation and image generation.',NULL);
--> statement-breakpoint
INSERT INTO `currencies` (`code`,`token`,`name_zh`,`name_en`,`digits`,`active`,`sort_order`,`created_at`,`updated_at`) VALUES
('MYR','RM','马来西亚林吉特','Malaysian Ringgit',2,1,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('CNY','CN¥','人民币','Chinese Yuan',2,1,2,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('USD','$','美元','US Dollar',2,1,3,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('SGD','S$','新加坡元','Singapore Dollar',2,1,4,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('EUR','€','欧元','Euro',2,1,5,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('GBP','£','英镑','British Pound',2,1,6,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('JPY','JP¥','日元','Japanese Yen',0,1,7,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('IDR','Rp','印度尼西亚盾','Indonesian Rupiah',0,1,8,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('USDT','₮','泰达币','Tether',2,1,9,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `exchange_rates` (`id`,`from_code`,`to_code`,`rate`,`source`,`effective_at`,`expires_at`,`created_at`) VALUES
('rate-myr','MYR','MYR','1.0000000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-cny','MYR','CNY','1.6200000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-usd','MYR','USD','0.2350000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-sgd','MYR','SGD','0.3160000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-eur','MYR','EUR','0.2160000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-gbp','MYR','GBP','0.1840000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-jpy','MYR','JPY','35.4000000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-idr','MYR','IDR','3820.0000000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z'),
('rate-usdt','MYR','USDT','0.2360000000','migration-seed','2026-07-29T00:00:00.000Z',NULL,'2026-07-29T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `heroes` (`id`,`key`,`image_key`,`target_slug`,`tone`,`status`,`sort_order`,`version`,`created_at`,`updated_at`) VALUES
('hero-main','main','/assets/hero-main.webp',NULL,'cyan','ACTIVE',1,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('hero-codex','codex','/assets/hero-codex.webp','codex','blue','ACTIVE',2,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('hero-gemini','gemini','/assets/hero-gemini.webp','gemini','violet','ACTIVE',3,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('hero-currency','currency','/assets/hero-currency.webp',NULL,'green','ACTIVE',4,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `hero_translations` (`hero_id`,`locale`,`eyebrow`,`title`,`body`,`cta`) VALUES
('hero-main','ZH','云桥 / 01','全球 AI 工具，\n在一座桥上相遇','从 Codex 到 Gemini，让工具、价格与人工服务在一个入口汇合。','探索全部服务'),
('hero-main','EN','CLOUDBRIDGE / 01','Global AI tools,\nconnected by one bridge','From Codex to Gemini, tools, pricing and human support meet in one considered place.','Explore services'),
('hero-codex','ZH','开发工作流 / 02','让 Codex 进入\n真实开发工作流','从需求理解、代码修改到执行验证，让开发过程保持连贯。','查看 Codex'),
('hero-codex','EN','DEVELOPMENT / 02','Bring Codex into\nyour real workflow','Move from requirements and code changes to execution and verification without breaking flow.','View Codex'),
('hero-gemini','ZH','多模态协作 / 03','文字、图像与思考，\n汇入多模态空间','通过 Gemini 连接文档、视觉与复杂问题，让信息不再割裂。','查看 Gemini'),
('hero-gemini','EN','MULTIMODAL / 03','Text, image and thought,\nin one multimodal space','Connect documents, visuals and complex questions with Gemini in a unified flow.','View Gemini'),
('hero-currency','ZH','全球定价 / 04','当地货币与 USDT，\n双价格清楚呈现','根据所在国家显示建议币种，也可以随时手动切换。','查看价格'),
('hero-currency','EN','GLOBAL PRICING / 04','Local currency and USDT,\npresented with clarity','See a suggested local currency for your region, or switch manually at any time.','View pricing');
--> statement-breakpoint
INSERT INTO `merchant_channels` (`id`,`type`,`mode`,`label_zh`,`label_en`,`public_account`,`direct_target`,`service_hours_zh`,`service_hours_en`,`active`,`sort_order`,`version`,`created_at`,`updated_at`) VALUES
('channel-whatsapp','WHATSAPP','DIRECT_LINK','WhatsApp','WhatsApp','未配置',NULL,'未配置','Not configured',0,1,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('channel-email','EMAIL','DIRECT_LINK','电子邮件','Email','未配置',NULL,'未配置','Not configured',0,2,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('channel-telegram','TELEGRAM','DIRECT_LINK','Telegram','Telegram','未配置',NULL,'未配置','Not configured',0,3,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('channel-wechat','WECHAT','QR_COPY','微信','WeChat','未配置',NULL,'未配置','Not configured',0,4,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z'),
('channel-qq','QQ','DIRECT_WITH_FALLBACK','QQ','QQ','未配置',NULL,'未配置','Not configured',0,5,1,'2026-07-29T00:00:00.000Z','2026-07-29T00:00:00.000Z');
--> statement-breakpoint
INSERT INTO `site_settings` (`key`,`value_json`,`version`,`updated_at`,`updated_by_email`) VALUES
('policy.currentVersion','"2026-07-29"',1,'2026-07-29T00:00:00.000Z',NULL),
('storefront.settings','{"siteName":{"zh":"云桥","en":"CloudBridge"},"defaultLocale":"zh","seoDescription":{"zh":"精选全球 AI 工具，以清楚的价格、库存与人工服务连接需求。","en":"Global AI services with clear pricing, availability, and human support."},"policyVersion":"2026-07-29","acceptOrders":false,"supportEnabled":false,"transitServiceEnabled":false,"transitServiceUrl":null}',1,'2026-07-29T00:00:00.000Z',NULL),
('notifications.telegram.new-order','{"requestedEnabled":false,"recipientGroupLabel":"","includedFields":["ORDER_NUMBER","PRODUCT","AMOUNT","CURRENCY","STATUS","CREATED_AT","CONTACT_CHANNEL","MASKED_CONTACT"],"version":1}',1,'2026-07-29T00:00:00.000Z',NULL);
