import type { ContactChannelType, Locale, StorefrontChannel } from "@cloudbridge/contracts";

export type PreviewLocalizedText = Record<Locale, string>;

export type PreviewSurface = "HOME" | "TRANSIT_SUBSCRIPTIONS" | "AI_RECHARGE";
export type PreviewHeroMode = "off" | "single" | "multiple";
export type PreviewDataState = "ready" | "loading" | "empty" | "error" | "offline" | "image-error";
export type PreviewTransitPlanType = "SUBSCRIPTION" | "USAGE" | "TEAM" | "OTHER";
export type PreviewPlatformKey = "CHATGPT" | "GEMINI" | "CLAUDE" | "CREATIVE" | "DEVELOPER" | "SEARCH" | "OTHER";
export type PreviewSkillResourceType = "SKILL" | "PLUGIN" | "CONNECTOR";
export type PreviewSkillSourceLevel = "OFFICIAL" | "COMMUNITY";
export type PreviewPrimaryCategoryKey = "ai-services" | "transit-services";
export type PreviewSecondaryCategoryKey =
  | "general-assistants"
  | "creative-tools"
  | "ai-search"
  | "subscription-plans"
  | "usage-packs"
  | "team-plans";

export type PreviewPrimaryCategory = {
  id: `DEMO-CATEGORY-PRIMARY-${string}`;
  key: PreviewPrimaryCategoryKey;
  label: PreviewLocalizedText;
  sortOrder: number;
};

export type PreviewSecondaryCategory = {
  id: `DEMO-CATEGORY-SECONDARY-${string}`;
  key: PreviewSecondaryCategoryKey;
  primaryKey: PreviewPrimaryCategoryKey;
  label: PreviewLocalizedText;
  sortOrder: number;
};

export type PreviewHero = {
  id: `DEMO-HERO-${string}`;
  surface: PreviewSurface;
  title: PreviewLocalizedText;
  eyebrow: PreviewLocalizedText;
  body: PreviewLocalizedText;
  action: PreviewLocalizedText;
  imageUrl: string;
  imageAlt: PreviewLocalizedText;
  targetHref: Record<Locale, string>;
};

export type PreviewProduct = {
  id: `DEMO-PRODUCT-${string}`;
  slug: string;
  name: PreviewLocalizedText;
  description: PreviewLocalizedText;
  category: PreviewLocalizedText;
  categoryKey: string;
  primaryCategoryKey: PreviewPrimaryCategoryKey;
  secondaryCategoryKey: PreviewSecondaryCategoryKey;
  surfaces: PreviewSurface[];
  imageUrl: string;
  imageAlt: PreviewLocalizedText;
  price: Record<string, string>;
  referencePrice: Record<string, string>;
  availability: "AVAILABLE" | "LOW" | "PAUSED";
  lowStock?: number;
  transitPlanType?: PreviewTransitPlanType;
  platformKey?: PreviewPlatformKey;
  responseTime: PreviewLocalizedText;
  notes: Array<{ title: PreviewLocalizedText; body: PreviewLocalizedText }>;
};

export type PreviewSkill = {
  id: `DEMO-SKILL-${string}`;
  slug: string;
  name: string;
  summary: PreviewLocalizedText;
  categoryKey: string;
  category: PreviewLocalizedText;
  type: PreviewSkillResourceType;
  sourceLevel: PreviewSkillSourceLevel;
  compatible: string[];
  verifiedOn: string;
  githubUrl: `https://github.com/${string}`;
  docsUrl?: `https://${string}`;
  license: string;
  bestFor: PreviewLocalizedText[];
  notFor: PreviewLocalizedText[];
  installHint: PreviewLocalizedText;
  relatedSlugs: string[];
};

export type PreviewOrderLookup = {
  id: `DEMO-ORDER-${string}`;
  orderNumber: `DEMO-CB${string}`;
  contactValue: `DEMO-${string}`;
  productName: PreviewLocalizedText;
  amount: { amount: string; currency: string };
  status: PreviewLocalizedText;
  channel: PreviewLocalizedText;
  maskedContact: string;
  createdAt: PreviewLocalizedText;
  updatedAt: PreviewLocalizedText;
};

export const PREVIEW_NOTICE: PreviewLocalizedText = {
  zh: "界面设计预览 · 模拟数据 · 不会修改服务器数据",
  en: "Interface design preview · Mock data · Server data will not change",
};

export const PREVIEW_VALIDATION_NOTICE: PreviewLocalizedText = {
  zh: "界面校验完成，未创建订单，也未保存服务器数据。",
  en: "Interface validation completed. No order was created and no server data was saved.",
};

export const PREVIEW_ORDER_LOOKUP: PreviewOrderLookup = {
  id: "DEMO-ORDER-LOOKUP-01",
  orderNumber: "DEMO-CB20260802A7C91F2B",
  contactValue: "DEMO-CONTACT-0281",
  productName: { zh: "ChatGPT Plus 人工代充", en: "ChatGPT Plus assisted recharge" },
  amount: { amount: "168.00", currency: "CNY" },
  status: { zh: "待人工确认", en: "Manual review" },
  channel: { zh: "WhatsApp", en: "WhatsApp" },
  maskedContact: "DE••••••••81",
  createdAt: { zh: "2026-08-02 10:42（UTC+8）", en: "2026-08-02 10:42 (UTC+8)" },
  updatedAt: { zh: "2026-08-02 10:48（UTC+8）", en: "2026-08-02 10:48 (UTC+8)" },
};

export const PREVIEW_ORDER_LOOKUPS: readonly PreviewOrderLookup[] = [
  PREVIEW_ORDER_LOOKUP,
  {
    id: "DEMO-ORDER-LOOKUP-02",
    orderNumber: "DEMO-CB20260801F0A13C82",
    contactValue: "DEMO-CONTACT-0281",
    productName: { zh: "Gemini Advanced 人工代充", en: "Gemini Advanced assisted recharge" },
    amount: { amount: "148.00", currency: "CNY" },
    status: { zh: "正在人工办理", en: "In manual processing" },
    channel: { zh: "WhatsApp", en: "WhatsApp" },
    maskedContact: "DE••••••••81",
    createdAt: { zh: "2026-08-01 16:18（UTC+8）", en: "2026-08-01 16:18 (UTC+8)" },
    updatedAt: { zh: "2026-08-02 09:06（UTC+8）", en: "2026-08-02 09:06 (UTC+8)" },
  },
];

export const PREVIEW_CURRENCIES = [
  { code: "CNY", token: "CN¥", digits: 2, name: { zh: "人民币", en: "Chinese yuan" } },
  { code: "MYR", token: "RM", digits: 2, name: { zh: "马来西亚林吉特", en: "Malaysian ringgit" } },
  { code: "USDT", token: "₮", digits: 2, name: { zh: "泰达币", en: "Tether" } },
] as const;

export const PREVIEW_PRIMARY_CATEGORIES: PreviewPrimaryCategory[] = [
  { id: "DEMO-CATEGORY-PRIMARY-AI", key: "ai-services", label: { zh: "AI 软件服务", en: "AI software services" }, sortOrder: 10 },
  { id: "DEMO-CATEGORY-PRIMARY-TRANSIT", key: "transit-services", label: { zh: "中转站服务", en: "Transit services" }, sortOrder: 20 },
];

export const PREVIEW_SECONDARY_CATEGORIES: PreviewSecondaryCategory[] = [
  { id: "DEMO-CATEGORY-SECONDARY-GENERAL", key: "general-assistants", primaryKey: "ai-services", label: { zh: "通用助手", en: "General assistants" }, sortOrder: 10 },
  { id: "DEMO-CATEGORY-SECONDARY-CREATIVE", key: "creative-tools", primaryKey: "ai-services", label: { zh: "创作工具", en: "Creative tools" }, sortOrder: 20 },
  { id: "DEMO-CATEGORY-SECONDARY-SEARCH", key: "ai-search", primaryKey: "ai-services", label: { zh: "AI 搜索", en: "AI search" }, sortOrder: 30 },
  { id: "DEMO-CATEGORY-SECONDARY-SUBSCRIPTION", key: "subscription-plans", primaryKey: "transit-services", label: { zh: "订阅套餐", en: "Subscription plans" }, sortOrder: 10 },
  { id: "DEMO-CATEGORY-SECONDARY-USAGE", key: "usage-packs", primaryKey: "transit-services", label: { zh: "使用额度", en: "Usage packs" }, sortOrder: 20 },
  { id: "DEMO-CATEGORY-SECONDARY-TEAM", key: "team-plans", primaryKey: "transit-services", label: { zh: "团队方案", en: "Team plans" }, sortOrder: 30 },
];

export const PREVIEW_HEROES: PreviewHero[] = [
  {
    id: "DEMO-HERO-HOME-01",
    surface: "HOME",
    eyebrow: { zh: "CloudBridge V2", en: "CloudBridge V2" },
    title: { zh: "让复杂的数字服务，抵达得更简单。", en: "A clearer bridge to digital services." },
    body: {
      zh: "统一浏览订阅、中转与 AI 软件代充服务，价格清楚，人工确认，交付边界透明。",
      en: "Explore subscriptions, transit, and AI recharge services with clear pricing and human confirmation.",
    },
    action: { zh: "浏览全部服务", en: "Explore services" },
    imageUrl: "/assets/hero-main.webp",
    imageAlt: { zh: "深蓝色云桥数字服务视觉", en: "Deep navy CloudBridge digital service artwork" },
    targetHref: { zh: "/preview/v2/zh#catalog", en: "/preview/v2/en#catalog" },
  },
  {
    id: "DEMO-HERO-HOME-02",
    surface: "HOME",
    eyebrow: { zh: "跨币种人工服务", en: "Human-assisted checkout" },
    title: { zh: "用熟悉的币种，理解每一次选择。", en: "Understand every choice in a familiar currency." },
    body: {
      zh: "多币种展示与参考换算保持独立，最终条件由客服人工确认。",
      en: "Localized prices and references stay distinct, with final terms confirmed by support.",
    },
    action: { zh: "查看服务目录", en: "View catalog" },
    imageUrl: "/assets/hero-currency.webp",
    imageAlt: { zh: "多币种服务视觉", en: "Multi-currency service artwork" },
    targetHref: { zh: "/preview/v2/zh#catalog", en: "/preview/v2/en#catalog" },
  },
  {
    id: "DEMO-HERO-HOME-03",
    surface: "HOME",
    eyebrow: { zh: "AI 软件服务", en: "AI software services" },
    title: { zh: "把常用 AI 工具，整理成一条清晰路径。", en: "A curated path to the AI tools you use." },
    body: {
      zh: "按平台筛选、查看办理说明，再选择一个联系渠道完成后续确认。",
      en: "Filter by platform, review service notes, then continue through one contact channel.",
    },
    action: { zh: "进入 AI 代充", en: "Explore AI recharge" },
    imageUrl: "/assets/hero-gemini.webp",
    imageAlt: { zh: "AI 软件协作视觉", en: "AI software collaboration artwork" },
    targetHref: { zh: "/preview/v2/zh/ai-recharge", en: "/preview/v2/en/ai-recharge" },
  },
  {
    id: "DEMO-HERO-TRANSIT-01",
    surface: "TRANSIT_SUBSCRIPTIONS",
    eyebrow: { zh: "中转站订阅", en: "Transit subscriptions" },
    title: { zh: "订阅、额度与团队方案，一页对比。", en: "Subscriptions, usage, and team plans in one view." },
    body: {
      zh: "这里展示套餐界面与筛选逻辑；真实购买仍前往已配置的中转站。",
      en: "This previews plan discovery and filtering. Real purchasing still opens the configured transit service.",
    },
    action: { zh: "定位套餐", en: "Find a plan" },
    imageUrl: "/assets/hero-codex.webp",
    imageAlt: { zh: "中转站订阅视觉", en: "Transit subscription artwork" },
    targetHref: { zh: "/preview/v2/zh/transit-subscriptions#catalog", en: "/preview/v2/en/transit-subscriptions#catalog" },
  },
  {
    id: "DEMO-HERO-AI-01",
    surface: "AI_RECHARGE",
    eyebrow: { zh: "AI 软件代充", en: "AI software recharge" },
    title: { zh: "按平台找到需要的人工办理服务。", en: "Find a human-assisted service by platform." },
    body: {
      zh: "不收集第三方密码，客服会在外部联系渠道确认账号范围与办理条件。",
      en: "We never request third-party passwords. Support confirms account scope and terms through your chosen channel.",
    },
    action: { zh: "选择平台", en: "Choose a platform" },
    imageUrl: "/assets/hero-gemini.webp",
    imageAlt: { zh: "AI 软件代充视觉", en: "AI software recharge artwork" },
    targetHref: { zh: "/preview/v2/zh/ai-recharge#catalog", en: "/preview/v2/en/ai-recharge#catalog" },
  },
];

export const PREVIEW_PRODUCTS: PreviewProduct[] = [
  {
    id: "DEMO-PRODUCT-CHATGPT-PLUS",
    slug: "chatgpt-plus-assisted",
    name: { zh: "ChatGPT Plus 人工代充", en: "ChatGPT Plus assisted recharge" },
    description: { zh: "适合需要持续使用高级模型与工具的个人用户。", en: "For individuals who need continued access to advanced models and tools." },
    category: { zh: "AI 软件", en: "AI software" },
    categoryKey: "ai-software",
    primaryCategoryKey: "ai-services",
    secondaryCategoryKey: "general-assistants",
    surfaces: ["HOME", "AI_RECHARGE"],
    imageUrl: "/assets/product-chatgpt.webp",
    imageAlt: { zh: "ChatGPT 服务封面", en: "ChatGPT service cover" },
    price: { CNY: "158.00", MYR: "103.00", USDT: "22.00" },
    referencePrice: { CNY: "¥160", MYR: "RM105", USDT: "₮22.5" },
    availability: "AVAILABLE",
    platformKey: "CHATGPT",
    responseTime: { zh: "约 10–30 分钟响应", en: "Replies in about 10–30 minutes" },
    notes: [
      { title: { zh: "办理范围", en: "Service scope" }, body: { zh: "客服确认账号地区、当前订阅状态与可办理路径。", en: "Support confirms account region, current subscription state, and an eligible path." } },
      { title: { zh: "隐私边界", en: "Privacy boundary" }, body: { zh: "不会在网页中收集第三方平台密码。", en: "Third-party platform passwords are never collected on this site." } },
      { title: { zh: "最终确认", en: "Final confirmation" }, body: { zh: "实际价格与交付条件以人工确认结果为准。", en: "Final price and delivery terms are confirmed by support." } },
    ],
  },
  {
    id: "DEMO-PRODUCT-CLAUDE-PRO",
    slug: "claude-pro-assisted",
    name: { zh: "Claude Pro 人工代充", en: "Claude Pro assisted recharge" },
    description: { zh: "面向长文本、研究和日常写作工作流。", en: "For long-form research, writing, and daily knowledge work." },
    category: { zh: "AI 软件", en: "AI software" },
    categoryKey: "ai-software",
    primaryCategoryKey: "ai-services",
    secondaryCategoryKey: "general-assistants",
    surfaces: ["HOME", "AI_RECHARGE"],
    imageUrl: "/assets/product-claude.webp",
    imageAlt: { zh: "Claude 服务封面", en: "Claude service cover" },
    price: { CNY: "168.00", MYR: "109.00", USDT: "23.50" },
    referencePrice: { CNY: "¥170", MYR: "RM110", USDT: "₮24" },
    availability: "LOW",
    lowStock: 2,
    platformKey: "CLAUDE",
    responseTime: { zh: "约 15–40 分钟响应", en: "Replies in about 15–40 minutes" },
    notes: [
      { title: { zh: "适用场景", en: "Good fit" }, body: { zh: "适合需要稳定长文本与分析能力的个人使用。", en: "Suited to individual long-form and analysis workflows." } },
      { title: { zh: "账号确认", en: "Account check" }, body: { zh: "办理前需确认账号地区与已有订阅。", en: "Account region and existing subscription are checked first." } },
      { title: { zh: "人工交付", en: "Human delivery" }, body: { zh: "客服通过所选联系渠道继续处理。", en: "Support continues through your chosen contact channel." } },
    ],
  },
  {
    id: "DEMO-PRODUCT-GEMINI-ADVANCED",
    slug: "gemini-advanced-assisted",
    name: { zh: "Gemini Advanced 人工代充", en: "Gemini Advanced assisted recharge" },
    description: { zh: "适合 Google 生态中的多模态与办公协作。", en: "For multimodal work across the Google ecosystem." },
    category: { zh: "AI 软件", en: "AI software" },
    categoryKey: "ai-software",
    primaryCategoryKey: "ai-services",
    secondaryCategoryKey: "general-assistants",
    surfaces: ["HOME", "AI_RECHARGE"],
    imageUrl: "/assets/product-gemini.webp",
    imageAlt: { zh: "Gemini 服务封面", en: "Gemini service cover" },
    price: { CNY: "148.00", MYR: "96.00", USDT: "20.50" },
    referencePrice: { CNY: "¥150", MYR: "RM98", USDT: "₮21" },
    availability: "AVAILABLE",
    platformKey: "GEMINI",
    responseTime: { zh: "约 10–30 分钟响应", en: "Replies in about 10–30 minutes" },
    notes: [
      { title: { zh: "生态适配", en: "Ecosystem fit" }, body: { zh: "办理前确认 Google 账号地区与订阅资格。", en: "Google account region and subscription eligibility are checked first." } },
      { title: { zh: "凭据安全", en: "Credential safety" }, body: { zh: "不要在任何网页表单中填写 Google 密码。", en: "Never enter a Google password into a web form." } },
      { title: { zh: "价格说明", en: "Pricing" }, body: { zh: "页面价格为模拟设计数据，不构成报价。", en: "Prices on this preview are mock design data, not an offer." } },
    ],
  },
  {
    id: "DEMO-PRODUCT-MIDJOURNEY",
    slug: "midjourney-assisted",
    name: { zh: "Midjourney 创作订阅", en: "Midjourney creative subscription" },
    description: { zh: "为视觉创作与概念设计提供订阅办理展示。", en: "A subscription concept for visual creation and art direction." },
    category: { zh: "创作工具", en: "Creative tools" },
    categoryKey: "creative",
    primaryCategoryKey: "ai-services",
    secondaryCategoryKey: "creative-tools",
    surfaces: ["HOME", "AI_RECHARGE"],
    imageUrl: "/assets/product-midjourney.webp",
    imageAlt: { zh: "Midjourney 服务封面", en: "Midjourney service cover" },
    price: { CNY: "238.00", MYR: "155.00", USDT: "33.00" },
    referencePrice: { CNY: "¥240", MYR: "RM157", USDT: "₮33.5" },
    availability: "PAUSED",
    platformKey: "CREATIVE",
    responseTime: { zh: "当前暂停办理", en: "Currently paused" },
    notes: [
      { title: { zh: "当前状态", en: "Current state" }, body: { zh: "本预览展示暂停办理状态，不代表真实商品状态。", en: "This preview demonstrates a paused state and does not reflect a live product." } },
      { title: { zh: "账号范围", en: "Account scope" }, body: { zh: "正式办理需先确认账号与套餐。", en: "A live service would first confirm account and plan." } },
      { title: { zh: "真实性", en: "Truth boundary" }, body: { zh: "不会生成假订单或假回执。", en: "No fake order or receipt is generated." } },
    ],
  },
  {
    id: "DEMO-PRODUCT-TRANSIT-MONTHLY",
    slug: "transit-monthly",
    name: { zh: "中转站月度订阅", en: "Transit monthly subscription" },
    description: { zh: "面向个人持续使用场景的月度套餐。", en: "A monthly plan concept for ongoing individual use." },
    category: { zh: "订阅套餐", en: "Subscription" },
    categoryKey: "transit",
    primaryCategoryKey: "transit-services",
    secondaryCategoryKey: "subscription-plans",
    surfaces: ["HOME", "TRANSIT_SUBSCRIPTIONS"],
    imageUrl: "/assets/product-codex.webp",
    imageAlt: { zh: "中转站订阅封面", en: "Transit subscription cover" },
    price: { CNY: "88.00", MYR: "57.00", USDT: "12.20" },
    referencePrice: { CNY: "¥90", MYR: "RM59", USDT: "₮12.5" },
    availability: "AVAILABLE",
    transitPlanType: "SUBSCRIPTION",
    responseTime: { zh: "外部中转站继续", en: "Continues on the transit service" },
    notes: [
      { title: { zh: "购买入口", en: "Purchase path" }, body: { zh: "真实购买仅通过已配置的外部中转站完成。", en: "Real purchasing is completed only through the configured external transit service." } },
      { title: { zh: "本站范围", en: "Site boundary" }, body: { zh: "本站只展示套餐发现与跳转界面。", en: "This site only previews plan discovery and handoff." } },
      { title: { zh: "数据说明", en: "Data note" }, body: { zh: "套餐内容与价格均为 DEMO 模拟数据。", en: "Plan details and prices are DEMO mock data." } },
    ],
  },
  {
    id: "DEMO-PRODUCT-TRANSIT-USAGE",
    slug: "transit-usage-pack",
    name: { zh: "中转站使用额度包", en: "Transit usage pack" },
    description: { zh: "适合弹性使用与短周期项目的额度展示。", en: "A flexible usage concept for short projects." },
    category: { zh: "使用额度", en: "Usage" },
    categoryKey: "transit",
    primaryCategoryKey: "transit-services",
    secondaryCategoryKey: "usage-packs",
    surfaces: ["TRANSIT_SUBSCRIPTIONS"],
    imageUrl: "/assets/product-cursor.webp",
    imageAlt: { zh: "中转站额度包封面", en: "Transit usage pack cover" },
    price: { CNY: "58.00", MYR: "38.00", USDT: "8.10" },
    referencePrice: { CNY: "¥60", MYR: "RM39", USDT: "₮8.5" },
    availability: "AVAILABLE",
    transitPlanType: "USAGE",
    responseTime: { zh: "外部中转站继续", en: "Continues on the transit service" },
    notes: [
      { title: { zh: "用量展示", en: "Usage display" }, body: { zh: "当前仅展示界面，不代表真实额度。", en: "This UI does not represent a live balance." } },
      { title: { zh: "外部交付", en: "External delivery" }, body: { zh: "真实服务由外部中转站承接。", en: "The external transit service handles live delivery." } },
      { title: { zh: "无站内控制台", en: "No site console" }, body: { zh: "CloudBridge 不提供站内中转控制台。", en: "CloudBridge does not provide an in-site transit console." } },
    ],
  },
  {
    id: "DEMO-PRODUCT-TRANSIT-TEAM",
    slug: "transit-team-plan",
    name: { zh: "中转站团队方案", en: "Transit team plan" },
    description: { zh: "用于多人协作与统一额度管理的方案概念。", en: "A plan concept for teams sharing managed usage." },
    category: { zh: "团队方案", en: "Team plan" },
    categoryKey: "transit",
    primaryCategoryKey: "transit-services",
    secondaryCategoryKey: "team-plans",
    surfaces: ["TRANSIT_SUBSCRIPTIONS"],
    imageUrl: "/assets/product-copilot.webp",
    imageAlt: { zh: "中转站团队方案封面", en: "Transit team plan cover" },
    price: { CNY: "288.00", MYR: "187.00", USDT: "40.00" },
    referencePrice: { CNY: "¥290", MYR: "RM189", USDT: "₮40.5" },
    availability: "LOW",
    lowStock: 1,
    transitPlanType: "TEAM",
    responseTime: { zh: "外部中转站继续", en: "Continues on the transit service" },
    notes: [
      { title: { zh: "团队范围", en: "Team scope" }, body: { zh: "正式页面将由外部中转站说明席位与用量。", en: "The external service would describe seats and usage." } },
      { title: { zh: "示例状态", en: "Demo state" }, body: { zh: "低库存仅用于演示界面层级。", en: "Low availability is only a UI demonstration." } },
      { title: { zh: "安全跳转", en: "Safe handoff" }, body: { zh: "只有有效 HTTPS 地址才会打开新窗口。", en: "Only a valid HTTPS destination opens a new window." } },
    ],
  },
  {
    id: "DEMO-PRODUCT-PERPLEXITY",
    slug: "perplexity-pro-assisted",
    name: { zh: "Perplexity Pro 人工代充", en: "Perplexity Pro assisted recharge" },
    description: { zh: "适合研究、检索与来源追踪工作。", en: "For research, search, and source-aware workflows." },
    category: { zh: "AI 搜索", en: "AI search" },
    categoryKey: "ai-search",
    primaryCategoryKey: "ai-services",
    secondaryCategoryKey: "ai-search",
    surfaces: ["AI_RECHARGE"],
    imageUrl: "/assets/product-perplexity.webp",
    imageAlt: { zh: "Perplexity 服务封面", en: "Perplexity service cover" },
    price: { CNY: "138.00", MYR: "90.00", USDT: "19.20" },
    referencePrice: { CNY: "¥140", MYR: "RM92", USDT: "₮19.5" },
    availability: "AVAILABLE",
    platformKey: "SEARCH",
    responseTime: { zh: "约 10–30 分钟响应", en: "Replies in about 10–30 minutes" },
    notes: [
      { title: { zh: "适用范围", en: "Best fit" }, body: { zh: "适合需要带来源检索的个人研究工作。", en: "Suited to source-aware individual research." } },
      { title: { zh: "办理方式", en: "Service path" }, body: { zh: "通过一个联系渠道完成后续人工确认。", en: "Continue human confirmation through one contact channel." } },
      { title: { zh: "模拟价格", en: "Mock price" }, body: { zh: "预览价格不构成真实报价。", en: "Preview pricing is not a live quote." } },
    ],
  },
];

export const PREVIEW_SKILLS: PreviewSkill[] = [
  {
    id: "DEMO-SKILL-AGENTS-SDK",
    slug: "openai-agents-sdk",
    name: "OpenAI Agents SDK",
    summary: { zh: "用工具、交接与追踪能力构建代理型应用。", en: "Build agentic applications with tools, handoffs, and tracing." },
    categoryKey: "agent-development",
    category: { zh: "Agent 开发", en: "Agent development" },
    type: "SKILL",
    sourceLevel: "OFFICIAL",
    compatible: ["Python", "OpenAI API"],
    verifiedOn: "2026-07-31",
    githubUrl: "https://github.com/openai/openai-agents-python",
    docsUrl: "https://openai.github.io/openai-agents-python/",
    license: "MIT",
    bestFor: [{ zh: "需要多代理交接与可观测性的应用", en: "Apps that need multi-agent handoffs and observability" }],
    notFor: [{ zh: "只需要一次普通模型调用的简单脚本", en: "A simple script that only needs one model call" }],
    installHint: { zh: "正式使用前核对仓库 README、运行时版本与 API 密钥边界。", en: "Before use, verify the repository README, runtime version, and API key boundaries." },
    relatedSlugs: ["mcp-servers", "playwright-mcp"],
  },
  {
    id: "DEMO-SKILL-MCP-SERVERS",
    slug: "mcp-servers",
    name: "Model Context Protocol Servers",
    summary: { zh: "查看 MCP 参考服务器与连接器实现。", en: "Explore reference servers and connector implementations for MCP." },
    categoryKey: "connectors",
    category: { zh: "连接器", en: "Connectors" },
    type: "CONNECTOR",
    sourceLevel: "OFFICIAL",
    compatible: ["MCP", "TypeScript", "Python"],
    verifiedOn: "2026-07-31",
    githubUrl: "https://github.com/modelcontextprotocol/servers",
    license: "MIT",
    bestFor: [{ zh: "需要为代理接入外部数据源", en: "Connecting agents to external data sources" }],
    notFor: [{ zh: "不能审查第三方服务权限的场景", en: "Contexts where third-party permissions cannot be reviewed" }],
    installHint: { zh: "仅安装需要的服务器，并按最小权限配置密钥。", en: "Install only the servers you need and configure credentials with least privilege." },
    relatedSlugs: ["openai-agents-sdk", "playwright-mcp"],
  },
  {
    id: "DEMO-SKILL-PLAYWRIGHT-MCP",
    slug: "playwright-mcp",
    name: "Playwright MCP",
    summary: { zh: "通过浏览器自动化完成页面检查与操作。", en: "Use browser automation for page inspection and interaction." },
    categoryKey: "browser-automation",
    category: { zh: "浏览器自动化", en: "Browser automation" },
    type: "PLUGIN",
    sourceLevel: "OFFICIAL",
    compatible: ["Node.js", "MCP", "Browser"],
    verifiedOn: "2026-07-31",
    githubUrl: "https://github.com/microsoft/playwright-mcp",
    license: "Apache-2.0",
    bestFor: [{ zh: "需要可重复浏览器检查的测试与代理", en: "Tests and agents that need repeatable browser checks" }],
    notFor: [{ zh: "需要绕过登录、安全验证或站点条款的任务", en: "Tasks that bypass authentication, security checks, or site terms" }],
    installHint: { zh: "先确认目标站点授权，再按仓库说明配置运行环境。", en: "Confirm site authorization first, then configure the runtime from the repository instructions." },
    relatedSlugs: ["openai-agents-sdk", "mcp-servers"],
  },
  {
    id: "DEMO-SKILL-CODEX",
    slug: "codex-cli",
    name: "OpenAI Codex",
    summary: { zh: "在本地代码库中规划、实现、测试并审查变更。", en: "Plan, implement, test, and review changes in a local codebase." },
    categoryKey: "developer-tools",
    category: { zh: "开发工具", en: "Developer tools" },
    type: "PLUGIN",
    sourceLevel: "OFFICIAL",
    compatible: ["CLI", "IDE", "Git"],
    verifiedOn: "2026-07-31",
    githubUrl: "https://github.com/openai/codex",
    license: "Apache-2.0",
    bestFor: [{ zh: "需要在真实仓库内持续完成工程任务", en: "Ongoing engineering work in a real repository" }],
    notFor: [{ zh: "未经授权修改生产环境的任务", en: "Unauthorized production changes" }],
    installHint: { zh: "阅读官方安装说明，并确认仓库与命令授权边界。", en: "Read the official install guide and confirm repository and command permissions." },
    relatedSlugs: ["openai-agents-sdk", "playwright-mcp"],
  },
  {
    id: "DEMO-SKILL-NEXTJS",
    slug: "nextjs",
    name: "Next.js",
    summary: { zh: "用于构建 React 全栈 Web 应用的框架。", en: "A React framework for full-stack web applications." },
    categoryKey: "web-development",
    category: { zh: "网站开发", en: "Web development" },
    type: "SKILL",
    sourceLevel: "COMMUNITY",
    compatible: ["React", "Node.js", "Web"],
    verifiedOn: "2026-07-31",
    githubUrl: "https://github.com/vercel/next.js",
    license: "MIT",
    bestFor: [{ zh: "需要路由、服务端渲染与前端交互的 Web 产品", en: "Web products that need routing, server rendering, and client interaction" }],
    notFor: [{ zh: "只需要一个无构建流程的静态文档", en: "A static document that needs no build pipeline" }],
    installHint: { zh: "根据官方支持矩阵选择 Node.js 版本并锁定依赖。", en: "Choose a supported Node.js version and lock dependencies." },
    relatedSlugs: ["codex-cli"],
  },
];

export const PREVIEW_SKILL_CATEGORIES: Array<{ key: string; label: PreviewLocalizedText }> = [
  { key: "all", label: { zh: "全部", en: "All" } },
  { key: "agent-development", label: { zh: "Agent 开发", en: "Agent development" } },
  { key: "connectors", label: { zh: "连接器", en: "Connectors" } },
  { key: "browser-automation", label: { zh: "浏览器自动化", en: "Browser automation" } },
  { key: "developer-tools", label: { zh: "开发工具", en: "Developer tools" } },
  { key: "web-development", label: { zh: "网站开发", en: "Web development" } },
  { key: "content", label: { zh: "内容生产", en: "Content production" } },
  { key: "operations", label: { zh: "运营与分析", en: "Operations & analytics" } },
];

export const PREVIEW_DEMO_CHANNELS: StorefrontChannel[] = [
  {
    type: "WHATSAPP" satisfies ContactChannelType,
    mode: "DIRECT_LINK",
    label: "DEMO WhatsApp",
    account: "DEMO-ACCOUNT",
    directTarget: "https://wa.me/10000000000",
    qrImageUrl: null,
    serviceHours: "DEMO · 09:00–21:00",
  },
  {
    type: "EMAIL" satisfies ContactChannelType,
    mode: "DIRECT_LINK",
    label: "DEMO Email",
    account: "demo@example.invalid",
    directTarget: "mailto:demo@example.invalid",
    qrImageUrl: null,
    serviceHours: "DEMO · 09:00–21:00",
  },
];

export const previewProductBySlug = (slug: string) => PREVIEW_PRODUCTS.find((item) => item.slug === slug) ?? null;
export const previewSkillBySlug = (slug: string) => PREVIEW_SKILLS.find((item) => item.slug === slug) ?? null;
