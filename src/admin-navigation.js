export const PINNED_ADMIN_TAB_ID = "dashboard";

export const ADMIN_NAVIGATION = [
  {
    kind: "link",
    id: "dashboard",
    label: { zh: "工作台", en: "Workspace" },
    pageLabel: { zh: "运营总览", en: "Operations" },
    icon: "SquaresFour",
  },
  {
    kind: "group",
    id: "orders-after-sales",
    label: { zh: "订单与售后", en: "Orders & after-sales" },
    icon: "Receipt",
    items: [
      { id: "orders", label: { zh: "订单中心", en: "Orders" }, icon: "Receipt", badge: "4" },
      { id: "disputes", label: { zh: "退款与争议", en: "Refunds & disputes" }, icon: "WarningCircle", badge: "2" },
    ],
  },
  {
    kind: "group",
    id: "catalog-management",
    label: { zh: "商品管理", en: "Catalog management" },
    icon: "Package",
    items: [
      { id: "products", label: { zh: "商品中心", en: "Products" }, icon: "Package" },
      { id: "categories", label: { zh: "商品分类", en: "Product categories" }, icon: "List" },
    ],
  },
  {
    kind: "group",
    id: "content-storefront",
    label: { zh: "内容与展示", en: "Content & storefront" },
    icon: "ImageIcon",
    items: [
      { id: "banners", label: { zh: "首页轮播", en: "Hero stories" }, icon: "ImageIcon" },
      { id: "media", label: { zh: "媒体资源", en: "Media library" }, icon: "CloudArrowUp" },
      { id: "translations", label: { zh: "语言与内容", en: "Language & copy" }, icon: "Translate" },
    ],
  },
  {
    kind: "group",
    id: "support-notifications",
    label: { zh: "客服与通知", en: "Support & notifications" },
    icon: "ChatsCircle",
    items: [
      { id: "contacts", label: { zh: "联系方式", en: "Contact channels" }, icon: "ChatsCircle" },
      { id: "notifications", label: { zh: "通知中心", en: "Notifications" }, icon: "Bell" },
      { id: "telegram-bot", label: { zh: "Telegram 机器人", en: "Telegram bot" }, icon: "TelegramLogo" },
    ],
  },
  {
    kind: "group",
    id: "finance-settlement",
    label: { zh: "财务与结算", en: "Finance & settlement" },
    icon: "CurrencyCircleDollar",
    items: [
      { id: "currencies", label: { zh: "币种与汇率", en: "Currencies & rates" }, icon: "CurrencyCircleDollar" },
      { id: "payments", label: { zh: "支付与收款", en: "Payments" }, icon: "CurrencyCircleDollar" },
      { id: "reconciliation", label: { zh: "支付对账", en: "Reconciliation" }, icon: "ArrowsClockwise" },
    ],
  },
  {
    kind: "group",
    id: "team-access",
    label: { zh: "成员与权限", en: "Team & access" },
    icon: "UsersThree",
    items: [
      { id: "team", label: { zh: "员工账户", en: "Team accounts" }, icon: "UsersThree" },
      { id: "roles", label: { zh: "角色与权限", en: "Roles & permissions" }, icon: "Key" },
    ],
  },
  {
    kind: "group",
    id: "security-compliance",
    label: { zh: "安全与合规", en: "Security & compliance" },
    icon: "ShieldCheck",
    items: [
      { id: "security", label: { zh: "安全中心", en: "Security" }, icon: "ShieldCheck" },
      { id: "security-events", label: { zh: "安全事件", en: "Security events" }, icon: "WarningCircle", badge: "2" },
      { id: "data-security", label: { zh: "数据安全", en: "Data security" }, icon: "Database" },
      { id: "secrets", label: { zh: "密钥与机密", en: "Secrets" }, icon: "LockKey" },
    ],
  },
  {
    kind: "group",
    id: "systems-operations",
    label: { zh: "系统与运维", en: "Systems & operations" },
    icon: "SlidersHorizontal",
    items: [
      { id: "logs", label: { zh: "日志与监控", en: "Logs & monitoring" }, icon: "ListMagnifyingGlass" },
      { id: "backups", label: { zh: "备份与恢复", en: "Backup & recovery" }, icon: "CloudArrowUp" },
      { id: "integrations", label: { zh: "系统与集成", en: "Systems & integrations" }, icon: "PlugsConnected" },
      { id: "settings", label: { zh: "网站设置", en: "Site settings" }, icon: "SlidersHorizontal" },
    ],
  },
];

export const flattenAdminNavigation = (entries) => entries.flatMap((entry) => (
  entry.kind === "link"
    ? [{ ...entry, label: entry.pageLabel || entry.label }]
    : entry.items
));

export const findAdminGroup = (entries, pageId) => (
  entries.find((entry) => (
    entry.kind === "group" && entry.items.some((item) => item.id === pageId)
  )) || null
);

export const toggleExpandedGroup = (currentGroupId, nextGroupId) => (
  currentGroupId === nextGroupId ? null : nextGroupId
);

export const openAdminTab = (openTabs, pageId) => (
  openTabs.includes(pageId) ? openTabs : [...openTabs, pageId]
);

export const reorderAdminTabs = (
  openTabs,
  sourceId,
  targetId,
  placement = "before",
  pinnedTabId = PINNED_ADMIN_TAB_ID,
) => {
  const uniqueTabs = [...new Set(openTabs)];
  const tabs = uniqueTabs.includes(pinnedTabId)
    ? [pinnedTabId, ...uniqueTabs.filter((id) => id !== pinnedTabId)]
    : uniqueTabs;

  if (
    sourceId === pinnedTabId
    || sourceId === targetId
    || !tabs.includes(sourceId)
    || !tabs.includes(targetId)
    || !["before", "after"].includes(placement)
  ) {
    return tabs;
  }

  const remaining = tabs.filter((id) => id !== sourceId);
  const targetIndex = remaining.indexOf(targetId);
  const minimumIndex = remaining[0] === pinnedTabId ? 1 : 0;
  const requestedIndex = targetId === pinnedTabId
    ? minimumIndex
    : targetIndex + (placement === "after" ? 1 : 0);
  const insertionIndex = Math.min(
    remaining.length,
    Math.max(minimumIndex, requestedIndex),
  );

  return [
    ...remaining.slice(0, insertionIndex),
    sourceId,
    ...remaining.slice(insertionIndex),
  ];
};

export const closeAdminTab = (
  openTabs,
  tabId,
  activeTabId,
  pinnedTabId = PINNED_ADMIN_TAB_ID,
) => {
  if (tabId === pinnedTabId || !openTabs.includes(tabId)) {
    return { tabs: openTabs, nextActiveId: activeTabId };
  }

  const closingIndex = openTabs.indexOf(tabId);
  const tabs = openTabs.filter((id) => id !== tabId);
  if (tabId !== activeTabId) {
    return { tabs, nextActiveId: activeTabId };
  }

  return {
    tabs,
    nextActiveId: openTabs[closingIndex - 1] || pinnedTabId,
  };
};

export const partitionAdminTabs = ({
  tabs,
  activeId,
  widths,
  availableWidth,
  moreWidth,
  pinnedId = PINNED_ADMIN_TAB_ID,
}) => {
  const widthOf = (id) => widths[id] || 0;
  const totalWidth = tabs.reduce((sum, id) => sum + widthOf(id), 0);
  if (totalWidth <= availableWidth) {
    return { visible: tabs, overflow: [] };
  }

  const budget = Math.max(0, availableWidth - moreWidth);
  const required = [...new Set([pinnedId, activeId])].filter((id) => tabs.includes(id));
  const visibleSet = new Set(required);
  let usedWidth = required.reduce((sum, id) => sum + widthOf(id), 0);

  tabs.forEach((id) => {
    if (visibleSet.has(id)) return;
    const nextWidth = widthOf(id);
    if (usedWidth + nextWidth <= budget) {
      visibleSet.add(id);
      usedWidth += nextWidth;
    }
  });

  return {
    visible: tabs.filter((id) => visibleSet.has(id)),
    overflow: tabs.filter((id) => !visibleSet.has(id)),
  };
};

export const partitionMobileAdminTabs = ({
  tabs,
  activeId,
  widths,
  availableWidth,
  moreWidth,
  pinnedId = PINNED_ADMIN_TAB_ID,
}) => {
  if (tabs.length <= 2) {
    return { visible: tabs, overflow: [] };
  }

  const widthOf = (id) => widths[id] || 0;
  const active = tabs.includes(activeId)
    ? activeId
    : tabs.includes(pinnedId)
      ? pinnedId
      : tabs[0];
  const budget = Math.max(0, availableWidth - moreWidth);
  const visibleSet = new Set([active]);
  let usedWidth = widthOf(active);
  const candidates = active !== pinnedId && tabs.includes(pinnedId)
    ? [pinnedId, ...[...tabs].reverse()]
    : [...tabs].reverse();

  for (const id of candidates) {
    if (visibleSet.size >= 2) break;
    if (visibleSet.has(id)) continue;
    const nextWidth = widthOf(id);
    if (usedWidth + nextWidth > budget) continue;
    visibleSet.add(id);
    usedWidth += nextWidth;
  }

  return {
    visible: tabs.filter((id) => visibleSet.has(id)),
    overflow: tabs.filter((id) => !visibleSet.has(id)),
  };
};
