export const categorySeeds = [
  { slug: "development", order: 1, zh: "编码开发", en: "Coding & development" },
  { slug: "assistant", order: 2, zh: "通用助手", en: "General assistants" },
  { slug: "research", order: 3, zh: "研究效率", en: "Research & productivity" },
  { slug: "creative", order: 4, zh: "图像创作", en: "Image creation" },
] as const;

export const productSeeds = [
  {
    slug: "codex",
    category: "development",
    imageKey: "/assets/product-codex.webp",
    price: "89.00",
    compareAt: "109.00",
    stock: 12,
    zh: {
      name: "OpenAI Codex 专业版",
      kicker: "开发工作流",
      description: "适合希望把需求理解、代码修改、执行与验证串联起来的开发者。提交订单后，客服会根据你填写的联系方式确认服务方式与交付信息。",
    },
    en: {
      name: "OpenAI Codex Professional",
      kicker: "Developer workflow",
      description: "For developers who want requirements, code changes, execution and verification in one connected workflow. Support will confirm delivery through your chosen contact channel.",
    },
  },
  {
    slug: "gemini",
    category: "assistant",
    imageKey: "/assets/product-gemini.webp",
    price: "79.00",
    compareAt: "99.00",
    stock: 8,
    zh: {
      name: "Gemini Advanced",
      kicker: "多模态协作",
      description: "面向文字、图片、文档与复杂任务的多模态 AI 服务。页面展示价格为当前预览币种的设计效果。",
    },
    en: {
      name: "Gemini Advanced",
      kicker: "Multimodal work",
      description: "A multimodal AI service for text, image, documents and complex tasks.",
    },
  },
  {
    slug: "chatgpt",
    category: "assistant",
    imageKey: "/assets/product-chatgpt.webp",
    price: "92.00",
    compareAt: "119.00",
    stock: null,
    zh: {
      name: "ChatGPT Plus",
      kicker: "通用智能助手",
      description: "适用于写作、分析、学习与日常知识工作的通用 AI 服务。无需注册商城账号即可提交订单。",
    },
    en: {
      name: "ChatGPT Plus",
      kicker: "General AI assistant",
      description: "A general AI service for writing, analysis, learning and everyday knowledge work.",
    },
  },
  {
    slug: "claude",
    category: "assistant",
    imageKey: "/assets/product-claude.webp",
    price: "85.00",
    compareAt: "108.00",
    stock: 3,
    zh: {
      name: "Claude Pro",
      kicker: "长文与推理",
      description: "适合长文阅读、结构化写作与复杂问题分析。低库存状态会以克制的琥珀节点提示。",
    },
    en: {
      name: "Claude Pro",
      kicker: "Long-form reasoning",
      description: "Built for long-form reading, structured writing and complex analysis.",
    },
  },
  {
    slug: "cursor",
    category: "development",
    imageKey: "/assets/product-cursor.webp",
    price: "76.00",
    compareAt: "96.00",
    stock: 15,
    zh: {
      name: "Cursor Pro",
      kicker: "AI 代码编辑器",
      description: "面向实际代码库工作的 AI 编辑体验，适合高频编程和项目维护。",
    },
    en: {
      name: "Cursor Pro",
      kicker: "AI code editor",
      description: "An AI editor experience made for real codebases, frequent coding and project maintenance.",
    },
  },
  {
    slug: "perplexity",
    category: "research",
    imageKey: "/assets/product-perplexity.webp",
    price: "72.00",
    compareAt: "90.00",
    stock: 9,
    zh: {
      name: "Perplexity Pro",
      kicker: "研究与检索",
      description: "为资料检索、来源整理与快速研究打造的 AI 服务。",
    },
    en: {
      name: "Perplexity Pro",
      kicker: "Research and search",
      description: "An AI service designed for research, source discovery and rapid synthesis.",
    },
  },
  {
    slug: "copilot",
    category: "development",
    imageKey: "/assets/product-copilot.webp",
    price: "68.00",
    compareAt: "86.00",
    stock: null,
    zh: {
      name: "GitHub Copilot",
      kicker: "编码辅助",
      description: "适合在编辑器与代码托管工作流中使用的智能编码辅助服务。",
    },
    en: {
      name: "GitHub Copilot",
      kicker: "Coding assistant",
      description: "An intelligent coding assistant for editor and repository workflows.",
    },
  },
  {
    slug: "midjourney",
    category: "creative",
    imageKey: "/assets/product-midjourney.webp",
    price: "118.00",
    compareAt: "148.00",
    stock: 0,
    zh: {
      name: "Midjourney Standard",
      kicker: "视觉生成",
      description: "面向视觉创意与图像生成的服务。当前演示为售罄状态，用于检查完整界面反馈。",
    },
    en: {
      name: "Midjourney Standard",
      kicker: "Visual generation",
      description: "A service for visual ideation and image generation.",
    },
  },
] as const;

export const currencySeeds = [
  { code: "MYR", token: "RM", zh: "马来西亚林吉特", en: "Malaysian Ringgit", rate: "1.0000000000", digits: 2 },
  { code: "CNY", token: "CN¥", zh: "人民币", en: "Chinese Yuan", rate: "1.6200000000", digits: 2 },
  { code: "USD", token: "$", zh: "美元", en: "US Dollar", rate: "0.2350000000", digits: 2 },
  { code: "SGD", token: "S$", zh: "新加坡元", en: "Singapore Dollar", rate: "0.3160000000", digits: 2 },
  { code: "EUR", token: "€", zh: "欧元", en: "Euro", rate: "0.2160000000", digits: 2 },
  { code: "GBP", token: "£", zh: "英镑", en: "British Pound", rate: "0.1840000000", digits: 2 },
  { code: "JPY", token: "JP¥", zh: "日元", en: "Japanese Yen", rate: "35.4000000000", digits: 0 },
  { code: "IDR", token: "Rp", zh: "印度尼西亚盾", en: "Indonesian Rupiah", rate: "3820.0000000000", digits: 0 },
  { code: "USDT", token: "₮", zh: "泰达币", en: "Tether", rate: "0.2360000000", digits: 2 },
] as const;

export const heroSeeds = [
  {
    key: "main",
    imageKey: "/assets/hero-main.webp",
    targetSlug: null,
    tone: "cyan",
    zh: { eyebrow: "云桥 / 01", title: "全球 AI 工具，\n在一座桥上相遇", body: "从 Codex 到 Gemini，让工具、价格与人工服务在一个入口汇合。", cta: "探索全部服务" },
    en: { eyebrow: "CLOUDBRIDGE / 01", title: "Global AI tools,\nconnected by one bridge", body: "From Codex to Gemini, tools, pricing and human support meet in one considered place.", cta: "Explore services" },
  },
  {
    key: "codex",
    imageKey: "/assets/hero-codex.webp",
    targetSlug: "codex",
    tone: "blue",
    zh: { eyebrow: "开发工作流 / 02", title: "让 Codex 进入\n真实开发工作流", body: "从需求理解、代码修改到执行验证，让开发过程保持连贯。", cta: "查看 Codex" },
    en: { eyebrow: "DEVELOPMENT / 02", title: "Bring Codex into\nyour real workflow", body: "Move from requirements and code changes to execution and verification without breaking flow.", cta: "View Codex" },
  },
  {
    key: "gemini",
    imageKey: "/assets/hero-gemini.webp",
    targetSlug: "gemini",
    tone: "violet",
    zh: { eyebrow: "多模态协作 / 03", title: "文字、图像与思考，\n汇入多模态空间", body: "通过 Gemini 连接文档、视觉与复杂问题，让信息不再割裂。", cta: "查看 Gemini" },
    en: { eyebrow: "MULTIMODAL / 03", title: "Text, image and thought,\nin one multimodal space", body: "Connect documents, visuals and complex questions with Gemini in a unified flow.", cta: "View Gemini" },
  },
  {
    key: "currency",
    imageKey: "/assets/hero-currency.webp",
    targetSlug: null,
    tone: "green",
    zh: { eyebrow: "全球定价 / 04", title: "当地货币与 USDT，\n双价格清楚呈现", body: "根据所在国家显示建议币种，也可以随时手动切换。", cta: "查看价格" },
    en: { eyebrow: "GLOBAL PRICING / 04", title: "Local currency and USDT,\npresented with clarity", body: "See a suggested local currency for your region, or switch manually at any time.", cta: "View pricing" },
  },
] as const;

export const merchantChannelSeeds = [
  { type: "WHATSAPP", mode: "DIRECT_LINK", zh: "WhatsApp", en: "WhatsApp", account: "+60 12 888 6618", directTarget: "https://wa.me/60128886618", hoursZh: "10:00–22:00", hoursEn: "10:00–22:00" },
  { type: "EMAIL", mode: "DIRECT_LINK", zh: "电子邮件", en: "Email", account: "support@cloudbridge.test", directTarget: "mailto:support@cloudbridge.test", hoursZh: "24 小时内回复", hoursEn: "Replies within 24 hours" },
  { type: "TELEGRAM", mode: "DIRECT_LINK", zh: "Telegram", en: "Telegram", account: "@CloudBridgeSupport", directTarget: "https://t.me/CloudBridgeSupport", hoursZh: "10:00–22:00", hoursEn: "10:00–22:00" },
  { type: "WECHAT", mode: "QR_COPY", zh: "微信", en: "WeChat", account: "CloudBridge_AI", directTarget: null, hoursZh: "10:00–22:00", hoursEn: "10:00–22:00" },
  { type: "QQ", mode: "DIRECT_WITH_FALLBACK", zh: "QQ", en: "QQ", account: "288661812", directTarget: "mqqwpa://im/chat?chat_type=wpa&uin=288661812", hoursZh: "10:00–22:00", hoursEn: "10:00–22:00" },
] as const;

export const permissionSeeds = [
  "catalog.read",
  "catalog.write",
  "orders.read",
  "orders.write",
  "contacts.reveal",
  "currencies.write",
  "team.manage",
  "roles.manage",
  "audit.read",
  "content.read",
  "content.write",
  "support.read",
  "support.write",
  "settings.read",
  "settings.write",
] as const;

export const roleSeeds = [
  {
    key: "SUPER_ADMIN",
    nameZh: "超级管理员",
    nameEn: "Super admin",
    description: "Full CloudBridge administration access",
    permissions: [...permissionSeeds],
    systemProtected: true,
  },
  {
    key: "OPERATIONS_MANAGER",
    nameZh: "运营管理员",
    nameEn: "Operations manager",
    description: "Catalog, content, orders, support, settings, and audit operations",
    permissions: [
      "catalog.read",
      "catalog.write",
      "orders.read",
      "orders.write",
      "contacts.reveal",
      "currencies.write",
      "audit.read",
      "content.read",
      "content.write",
      "support.read",
      "support.write",
      "settings.read",
      "settings.write",
    ],
    systemProtected: false,
  },
  {
    key: "ORDER_SUPPORT",
    nameZh: "订单客服",
    nameEn: "Order support",
    description: "Order handling and controlled contact access",
    permissions: [
      "orders.read",
      "orders.write",
      "contacts.reveal",
      "support.read",
    ],
    systemProtected: false,
  },
  {
    key: "CONTENT_EDITOR",
    nameZh: "内容编辑",
    nameEn: "Content editor",
    description: "Catalog, hero, and bilingual storefront content",
    permissions: [
      "catalog.read",
      "catalog.write",
      "content.read",
      "content.write",
      "settings.read",
    ],
    systemProtected: false,
  },
  {
    key: "FINANCE_REVIEWER",
    nameZh: "财务审核",
    nameEn: "Finance reviewer",
    description: "Read-only order payment history and audit evidence",
    permissions: [
      "orders.read",
      "audit.read",
    ],
    systemProtected: false,
  },
] as const;

export const storefrontSettingsSeed = {
  siteName: {
    zh: "云桥",
    en: "CloudBridge",
  },
  defaultLocale: "zh",
  seoDescription: {
    zh: "精选全球 AI 工具，以清楚的价格、库存与人工服务连接需求。",
    en: "Global AI services with clear pricing, availability, and human support.",
  },
  policyVersion: "2026-07-27",
  acceptOrders: true,
  supportEnabled: true,
  inventoryRiskThreshold: 3,
  transitServiceEnabled: true,
  transitServiceUrl: null,
} as const;

export const storefrontSettingsSeedForPolicy = (value: unknown) => {
  const policyVersion = typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value.trim())
    ? value.trim()
    : storefrontSettingsSeed.policyVersion;
  return {
    ...storefrontSettingsSeed,
    policyVersion,
  };
};
