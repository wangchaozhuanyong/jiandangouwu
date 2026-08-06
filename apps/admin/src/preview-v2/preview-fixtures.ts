export type LocalizedPreviewText = Readonly<{
  zh: string;
  en: string;
}>;

export type ProductPlacementId =
  | "HOME"
  | "TRANSIT_SUBSCRIPTIONS"
  | "AI_RECHARGE";

export type PreviewProduct = Readonly<{
  id: string;
  name: LocalizedPreviewText;
  primaryCategoryId: string;
  secondaryCategoryId: string;
  price: string;
  stock: string;
  placements: readonly ProductPlacementId[];
}>;

export type PreviewPrimaryCategory = Readonly<{
  id: string;
  name: LocalizedPreviewText;
  slug: string;
  enabled: boolean;
  sortOrder: number;
}>;

export type PreviewSecondaryCategory = Readonly<{
  id: string;
  parentId: string;
  name: LocalizedPreviewText;
  slug: string;
  enabled: boolean;
  sortOrder: number;
}>;

export const previewPrimaryCategories: readonly PreviewPrimaryCategory[] = [
  { id: "DEMO-CATEGORY-PRIMARY-AI", name: { zh: "AI 软件服务", en: "AI software services" }, slug: "ai-services", enabled: true, sortOrder: 10 },
  { id: "DEMO-CATEGORY-PRIMARY-TRANSIT", name: { zh: "中转站服务", en: "Transit services" }, slug: "transit-services", enabled: true, sortOrder: 20 },
];

export const previewSecondaryCategories: readonly PreviewSecondaryCategory[] = [
  { id: "DEMO-CATEGORY-SECONDARY-GENERAL", parentId: "DEMO-CATEGORY-PRIMARY-AI", name: { zh: "通用助手", en: "General assistants" }, slug: "general-assistants", enabled: true, sortOrder: 10 },
  { id: "DEMO-CATEGORY-SECONDARY-CREATIVE", parentId: "DEMO-CATEGORY-PRIMARY-AI", name: { zh: "创作工具", en: "Creative tools" }, slug: "creative-tools", enabled: true, sortOrder: 20 },
  { id: "DEMO-CATEGORY-SECONDARY-SEARCH", parentId: "DEMO-CATEGORY-PRIMARY-AI", name: { zh: "AI 搜索", en: "AI search" }, slug: "ai-search", enabled: true, sortOrder: 30 },
  { id: "DEMO-CATEGORY-SECONDARY-SUBSCRIPTION", parentId: "DEMO-CATEGORY-PRIMARY-TRANSIT", name: { zh: "订阅套餐", en: "Subscription plans" }, slug: "subscription-plans", enabled: true, sortOrder: 10 },
  { id: "DEMO-CATEGORY-SECONDARY-USAGE", parentId: "DEMO-CATEGORY-PRIMARY-TRANSIT", name: { zh: "使用额度", en: "Usage packs" }, slug: "usage-packs", enabled: true, sortOrder: 20 },
  { id: "DEMO-CATEGORY-SECONDARY-TEAM", parentId: "DEMO-CATEGORY-PRIMARY-TRANSIT", name: { zh: "团队方案", en: "Team plans" }, slug: "team-plans", enabled: true, sortOrder: 30 },
];

export const previewProductPlacements: ReadonlyArray<{
  id: ProductPlacementId;
  label: LocalizedPreviewText;
  path: string;
}> = [
  { id: "HOME", label: { zh: "首页商品区", en: "Home catalog" }, path: "/[locale]#catalog" },
  { id: "TRANSIT_SUBSCRIPTIONS", label: { zh: "中转站订阅页", en: "Transit subscriptions" }, path: "/[locale]/transit" },
  { id: "AI_RECHARGE", label: { zh: "AI 软件代充页", en: "AI software recharge" }, path: "/[locale]/ai-recharge" },
];

export const previewProducts: readonly PreviewProduct[] = [
  {
    id: "DEMO-PRODUCT-001",
    name: { zh: "Codex 团队服务示例", en: "Codex team service sample" },
    primaryCategoryId: "DEMO-CATEGORY-PRIMARY-AI",
    secondaryCategoryId: "DEMO-CATEGORY-SECONDARY-GENERAL",
    price: "CNY 168.00",
    stock: "DEMO 12",
    placements: ["HOME", "AI_RECHARGE"],
  },
  {
    id: "DEMO-PRODUCT-002",
    name: { zh: "中转订阅示例", en: "Transit subscription sample" },
    primaryCategoryId: "DEMO-CATEGORY-PRIMARY-TRANSIT",
    secondaryCategoryId: "DEMO-CATEGORY-SECONDARY-SUBSCRIPTION",
    price: "CNY 88.00",
    stock: "DEMO ∞",
    placements: ["TRANSIT_SUBSCRIPTIONS"],
  },
  {
    id: "DEMO-PRODUCT-003",
    name: { zh: "Gemini 代充服务示例", en: "Gemini recharge service sample" },
    primaryCategoryId: "DEMO-CATEGORY-PRIMARY-AI",
    secondaryCategoryId: "DEMO-CATEGORY-SECONDARY-GENERAL",
    price: "CNY 128.00",
    stock: "DEMO 6",
    placements: ["HOME", "AI_RECHARGE"],
  },
];

export type BannerPlacementId = ProductPlacementId;
export type BannerTargetType = "NONE" | "PRODUCT" | "CATEGORY" | "EXTERNAL";

export type PreviewBanner = Readonly<{
  id: string;
  placement: BannerPlacementId;
  title: LocalizedPreviewText;
  body: LocalizedPreviewText;
  action: LocalizedPreviewText;
  targetType: BannerTargetType;
  targetValue: string;
  enabled: boolean;
  sortOrder: number;
  tone: "navy" | "teal" | "bronze";
}>;

export const previewBanners: readonly PreviewBanner[] = [
  {
    id: "DEMO-AD-HOME-001",
    placement: "HOME",
    title: { zh: "让复杂服务走一条清楚的路", en: "A clear path through complex services" },
    body: { zh: "展示广告排版、目标和双端安全区域。", en: "Preview advertising layout, targets, and safe areas." },
    action: { zh: "查看服务", en: "View services" },
    targetType: "CATEGORY",
    targetValue: "DEMO-CATEGORY-AI",
    enabled: true,
    sortOrder: 1,
    tone: "navy",
  },
  {
    id: "DEMO-AD-HOME-002",
    placement: "HOME",
    title: { zh: "先看清服务，再留下联系方式", en: "Understand the service before leaving contact details" },
    body: { zh: "第二条首页广告用于检查排序。", en: "A second home ad for ordering review." },
    action: { zh: "查看说明", en: "Read details" },
    targetType: "NONE",
    targetValue: "",
    enabled: false,
    sortOrder: 2,
    tone: "teal",
  },
  {
    id: "DEMO-AD-TRANSIT-001",
    placement: "TRANSIT_SUBSCRIPTIONS",
    title: { zh: "稳定连接，从合适的订阅开始", en: "Reliable access starts with the right subscription" },
    body: { zh: "此处只展示中转站订阅页广告结构。", en: "This area only previews the transit subscription ad structure." },
    action: { zh: "了解订阅", en: "Review subscriptions" },
    targetType: "PRODUCT",
    targetValue: "DEMO-PRODUCT-001",
    enabled: false,
    sortOrder: 1,
    tone: "teal",
  },
  {
    id: "DEMO-AD-TRANSIT-002",
    placement: "TRANSIT_SUBSCRIPTIONS",
    title: { zh: "先确认方案，再开始使用", en: "Confirm the plan before getting started" },
    body: { zh: "第二条中转站广告用于检查顺序和关闭状态。", en: "A second transit ad for order and off-state review." },
    action: { zh: "查看说明", en: "Review details" },
    targetType: "CATEGORY",
    targetValue: "DEMO-CATEGORY-SERVICE",
    enabled: false,
    sortOrder: 2,
    tone: "navy",
  },
  {
    id: "DEMO-AD-AI-RECHARGE-001",
    placement: "AI_RECHARGE",
    title: { zh: "常用 AI 软件，按需选择", en: "Choose the AI software service you need" },
    body: { zh: "代充页面先说明服务范围，再进入人工确认。", en: "The recharge page explains service scope before manual confirmation." },
    action: { zh: "查看代充服务", en: "View recharge services" },
    targetType: "PRODUCT",
    targetValue: "DEMO-PRODUCT-001",
    enabled: true,
    sortOrder: 1,
    tone: "bronze",
  },
  {
    id: "DEMO-AD-AI-RECHARGE-002",
    placement: "AI_RECHARGE",
    title: { zh: "版本与价格，确认后再继续", en: "Confirm the edition and price before continuing" },
    body: { zh: "第二条 AI 代充广告用于检查排序。", en: "A second AI recharge ad for ordering review." },
    action: { zh: "了解确认流程", en: "Review confirmation" },
    targetType: "CATEGORY",
    targetValue: "DEMO-CATEGORY-AI",
    enabled: true,
    sortOrder: 2,
    tone: "teal",
  },
];

export type PreviewSkillCategory = Readonly<{
  id: string;
  name: LocalizedPreviewText;
  sortOrder: number;
}>;

export type PreviewSkill = Readonly<{
  id: string;
  categoryId: string;
  name: LocalizedPreviewText;
  summary: LocalizedPreviewText;
  sourceUrl: string;
  compatibility: readonly string[];
  license: "MIT" | "Apache-2.0" | "Commercial" | "Custom";
}>;

export const previewSkillCategories: readonly PreviewSkillCategory[] = [
  { id: "DEMO-SKILL-CATEGORY-001", name: { zh: "网站设计", en: "Web design" }, sortOrder: 1 },
  { id: "DEMO-SKILL-CATEGORY-002", name: { zh: "运营效率", en: "Operations" }, sortOrder: 2 },
  { id: "DEMO-SKILL-CATEGORY-003", name: { zh: "内容制作", en: "Content production" }, sortOrder: 3 },
];

export const previewSkills: readonly PreviewSkill[] = [
  {
    id: "DEMO-SKILL-001",
    categoryId: "DEMO-SKILL-CATEGORY-001",
    name: { zh: "界面审计 Skill 示例", en: "Interface audit Skill sample" },
    summary: { zh: "检查层级、留白、响应式与可访问性。", en: "Reviews hierarchy, spacing, responsiveness, and accessibility." },
    sourceUrl: "https://github.com/openai/openai-agents-python",
    compatibility: ["Codex", "ChatGPT"],
    license: "MIT",
  },
  {
    id: "DEMO-SKILL-002",
    categoryId: "DEMO-SKILL-CATEGORY-002",
    name: { zh: "运营检查 Skill 示例", en: "Operations review Skill sample" },
    summary: { zh: "把重复检查整理成可复核步骤。", en: "Turns recurring reviews into verifiable steps." },
    sourceUrl: "https://github.com/openai/codex",
    compatibility: ["Codex"],
    license: "Apache-2.0",
  },
];

export type PreviewSettings = Readonly<{
  advertising: Readonly<Record<BannerPlacementId, boolean>>;
  transitEnabled: boolean;
  transitUrl: string;
  supportEnabled: boolean;
  supportChannel: "DEMO-WHATSAPP" | "DEMO-WECHAT" | "DEMO-QQ";
  ordersEnabled: boolean;
}>;

export const previewSettings: PreviewSettings = {
  advertising: {
    HOME: true,
    TRANSIT_SUBSCRIPTIONS: false,
    AI_RECHARGE: true,
  },
  transitEnabled: true,
  transitUrl: "https://demo.invalid/transit",
  supportEnabled: true,
  supportChannel: "DEMO-WHATSAPP",
  ordersEnabled: false,
};
