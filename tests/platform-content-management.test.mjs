import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("内容、客服和网站设置使用独立 API 领域模块", () => {
  const appModule = read("apps/api/src/app.module.ts");
  const contentController = read("apps/api/src/content/content.admin.controller.ts");
  const supportController = read("apps/api/src/support/support.admin.controller.ts");
  const settingsController = read("apps/api/src/settings/settings.admin.controller.ts");

  for (const moduleName of ["ContentModule", "SupportModule", "SettingsModule"]) {
    assert.match(appModule, new RegExp(`\\b${moduleName}\\b`, "u"));
  }
  assert.match(contentController, /@Controller\("admin\/heroes"\)/u);
  assert.match(contentController, /@Patch\("order"\)/u);
  assert.match(contentController, /RequirePermissions\("content\.write"\)/u);
  assert.match(supportController, /@Controller\("admin\/contact-channels"\)/u);
  assert.match(supportController, /RequirePermissions\("support\.write"\)/u);
  assert.match(settingsController, /@Controller\("admin\/site-settings"\)/u);
  assert.match(settingsController, /RequirePermissions\("settings\.write"\)/u);
});

test("共享契约按领域拆分并由客户端复用公开配置", () => {
  const contracts = read("packages/contracts/src/index.ts");
  const storefrontApi = read("apps/storefront/lib/api.ts");
  const configContract = read("packages/contracts/src/storefront.ts");

  for (const moduleName of ["catalog", "common", "content", "orders", "settings", "storefront", "support"]) {
    assert.match(contracts, new RegExp(`export \\* from "\\./${moduleName}\\.js"`, "u"));
  }
  assert.match(configContract, /settings:\s*StorefrontSettings/u);
  assert.match(storefrontApi, /StorefrontConfig[\s\S]*from "@cloudbridge\/contracts"/u);
  assert.doesNotMatch(storefrontApi, /export type HeroStory\s*=/u);
});

test("订单服务在扣库存前执行接单、政策与渠道门禁", () => {
  const orders = read("apps/api/src/orders/orders.service.ts");
  const gateIndex = orders.indexOf("if (!settings.acceptOrders)");
  const policyIndex = orders.indexOf("input.acceptedPolicyVersion !== settings.policyVersion");
  const channelIndex = orders.indexOf("if (!activeChannel)");
  const stockIndex = orders.indexOf("stockQuantity: { gte: 1 }");

  assert.ok(gateIndex >= 0);
  assert.ok(policyIndex > gateIndex);
  assert.ok(channelIndex > policyIndex);
  assert.ok(stockIndex > channelIndex);
});

test("三个正式后台页面不再经过设计预览并调用真实接口", () => {
  const app = read("apps/admin/src/App.tsx");
  const preview = read("apps/admin/src/pages/design-preview-page.tsx");
  const banners = read("apps/admin/src/features/content/banners-page.tsx");
  const contacts = read("apps/admin/src/features/support/contacts-page.tsx");
  const settings = read("apps/admin/src/features/settings/settings-page.tsx");

  assert.match(app, /page === "banners"[\s\S]*?<BannersPage/u);
  assert.match(app, /page === "contacts"[\s\S]*?<ContactsPage/u);
  assert.match(app, /page === "settings"[\s\S]*?<SettingsPage/u);
  for (const page of ["banners", "contacts", "settings"]) {
    assert.doesNotMatch(preview, new RegExp(`page === "${page}"`, "u"));
  }
  assert.match(banners, /createHero\(|updateHero\(|reorderHeroes\(/u);
  assert.match(contacts, /updateContactChannel\(|reorderContactChannels\(/u);
  assert.match(settings, /updateSiteSettings\(/u);
  assert.doesNotMatch(`${banners}\n${contacts}\n${settings}`, /界面设计预览|Interface design preview/u);
});

test("售后处理复用真实订单中心并限制为人工售后状态", () => {
  const app = read("apps/admin/src/App.tsx");
  const afterSales = read("apps/admin/src/features/orders/after-sales-page.tsx");
  const orders = read("apps/admin/src/pages/orders-page.tsx");
  const filters = read("apps/admin/src/features/orders/order-filters.tsx");
  const orderApi = read("apps/admin/src/features/orders/api.ts");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/orders\/after-sales-page"\)\)/u);
  assert.match(app, /page === "disputes"[\s\S]*?<AfterSalesPage/u);
  assert.match(app, /<AfterSalesPage[\s\S]*?permissions\.includes\("contacts\.reveal"\)[\s\S]*?permissions\.includes\("orders\.write"\)/u);
  assert.match(afterSales, /<OrdersPage[\s\S]*?scope="AFTER_SALES"/u);
  assert.match(afterSales, /人工售后订单视图/u);
  assert.match(afterSales, /不会调用支付机构、自动退款/u);
  assert.doesNotMatch(afterSales, /界面设计预览|Interface design preview/u);
  assert.match(orders, /afterSalesStatuses\s*=\s*\[\s*"REFUND_PENDING",\s*"REFUNDED",\s*"DISPUTED"/u);
  assert.match(orders, /scope === "AFTER_SALES"[\s\S]*?afterSalesStatuses/u);
  assert.match(orders, /getAdminOrders\(query,\s*signal\)/u);
  assert.match(orders, /statuses=\{availableStatuses\}/u);
  assert.match(filters, /statuses\.map/u);
  assert.match(orderApi, /if \(query\.scope\) params\.set\("scope", query\.scope\)/u);
});

test("人工收款记录是真实只读历史且对账继续保留设计预览", () => {
  const app = read("apps/admin/src/App.tsx");
  const preview = read("apps/admin/src/pages/design-preview-page.tsx");
  const page = read("apps/admin/src/features/finance/manual-payments-page.tsx");
  const api = read("apps/admin/src/features/finance/api.ts");
  const filters = read("apps/admin/src/features/finance/filters.tsx");
  const table = read("apps/admin/src/features/finance/table.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/finance\/manual-payments-page"\)\)/u);
  assert.match(app, /page === "payments"[\s\S]*?<ManualPaymentsPage/u);
  assert.match(app, /<ManualPaymentsPage[\s\S]*?permissions\.includes\("contacts\.reveal"\)[\s\S]*?permissions\.includes\("orders\.write"\)/u);
  assert.match(preview, /page === "reconciliation"[\s\S]*?<ReconciliationDesign/u);
  assert.match(page, /readManualPaymentQuery\(window\.location\.search\)/u);
  assert.match(page, /<OrderDetailDialog/u);
  assert.match(page, /不是支付流水，不证明款项到账或退款完成/u);
  assert.match(page, /不同币种不会合并为总额/u);
  assert.doesNotMatch(page, /notify\(|DesignPreviewPage|设计预览|保存成功|删除成功/u);

  assert.match(api, /\/admin\/manual-payment-events\?/u);
  assert.match(api, /request<AdminManualPaymentEvent\[\]>/u);
  assert.doesNotMatch(api, /method:|POST|PATCH|PUT|DELETE/u);
  for (const queryField of ["search", "eventType", "currencyCode", "actorId", "assigneeId"]) {
    assert.match(api, new RegExp(`params\\.set\\("${queryField}"`, "u"));
  }
  assert.match(filters, /manualPaymentEventTypes\.map/u);
  assert.match(filters, /currencyCode/u);
  assert.match(filters, /actorId/u);
  assert.match(filters, /assigneeId/u);

  for (const column of [
    "事件 ID", "记录时间", "订单号", "商品", "记录类型", "金额", "币种",
    "参考金额", "参考币种", "汇率快照", "操作者", "原因", "当前负责人", "外部核验", "操作",
  ]) {
    assert.match(table, new RegExp(column, "u"), `${column} should remain a dedicated column`);
  }
  assert.match(table, /<table className="manual-payment-record-table">/u);
  assert.match(table, /event\.externalActionVerified/u);
  assert.match(table, /event\.statusHistoryId/u);
  assert.match(table, /event\.recordedAt/u);
  assert.doesNotMatch(table, /<br|<small/u);
  assert.match(css, /\.manual-payment-record-table\s*\{[^}]*min-width:\s*2300px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.manual-payment-record-table th:first-child/u);
  assert.match(css, /\.row-action\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
});

test("Telegram 页面只保存未来意向并使用服务器脱敏模拟", () => {
  const app = read("apps/admin/src/App.tsx");
  const preview = read("apps/admin/src/pages/design-preview-page.tsx");
  const api = read("apps/admin/src/features/notifications/api.ts");
  const page = read("apps/admin/src/features/notifications/telegram-new-order-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/notifications\/telegram-new-order-page"\)\)/u);
  assert.match(app, /page === "telegram-bot"[\s\S]*?<TelegramNewOrderPage/u);
  assert.match(app, /<TelegramNewOrderPage[\s\S]*?permissions\.includes\("settings\.write"\)/u);
  assert.match(preview, /page === "notifications"[\s\S]*?<NotificationsDesign/u);

  assert.match(api, /\/admin\/telegram-new-order-settings/u);
  assert.match(api, /method:\s*"PUT"/u);
  assert.match(api, /\/simulation/u);
  assert.match(api, /method:\s*"POST"/u);
  assert.doesNotMatch(api, /https?:\/\/|fetch\(/u);

  for (const fixedState of [
    "NOT_CONNECTED",
    "effectiveEnabled",
    "tokenConfigured",
    "externalDeliveryVerified",
    "deliveryAttempted",
    "SIMULATED",
  ]) {
    assert.match(`${api}\n${page}`, new RegExp(fixedState, "u"));
  }
  assert.match(api, /settings\.effectiveEnabled !== false/u);
  assert.match(api, /simulation\.deliveryAttempted !== false/u);
  assert.match(api, /data:\s*requireUnconnectedSettings\(response\.data\)/u);
  assert.doesNotMatch(preview, /page === "telegram-bot"|function TelegramDesign/u);
  for (const field of [
    "ORDER_NUMBER", "PRODUCT", "AMOUNT", "CURRENCY", "STATUS", "CREATED_AT",
    "CONTACT_CHANNEL", "MASKED_CONTACT",
  ]) {
    assert.match(page, new RegExp(field, "u"));
  }
  assert.match(page, /useAdminPageDirty\(dirty\)/u);
  assert.match(page, /normalized\.reason\.length < 8/u);
  assert.match(page, /requestError instanceof ApiError && requestError\.status === 409/u);
  assert.match(page, /Recent authentication expired|近期认证已过期/u);
  assert.match(page, /服务器固定的虚构订单/u);
  assert.match(page, /没有发送 Telegram 消息/u);
  assert.doesNotMatch(page, /连接机器人|发送测试消息|重试发送|发送记录|Bot Token|Chat ID|已连接|已启用/u);
  assert.doesNotMatch(page, /<h1/u);
  assert.match(css, /\.telegram-field-allowlist label\s*\{[^}]*min-height:\s*48px;/u);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.telegram-settings-layout\s*\{\s*grid-template-columns:\s*1fr;/u);
});

test("管理员可编辑配置不会被重复 seed 覆盖", () => {
  const seed = read("apps/api/prisma/seed.ts");
  for (const model of [
    "category",
    "categoryTranslation",
    "currency",
    "exchangeRate",
    "product",
    "productTranslation",
    "hero",
    "heroTranslation",
    "merchantChannel",
  ]) {
    const block = seed.match(
      new RegExp(`prisma\\.${model}\\.upsert\\(\\{[\\s\\S]*?\\n\\s*\\}\\);`, "u"),
    )?.[0] ?? "";
    assert.match(block, /update:\s*\{\}/u, `${model} seed must preserve existing admin data`);
  }
  assert.match(seed, /key:\s*"storefront\.settings"/u);
});

test("真实后台组合多个未保存来源并拦截站内返回与退出", () => {
  const experience = read("apps/admin/src/admin-experience.tsx");
  const app = read("apps/admin/src/App.tsx");
  const banners = read("apps/admin/src/features/content/banners-page.tsx");
  const contacts = read("apps/admin/src/features/support/contacts-page.tsx");

  assert.match(experience, /dirtySources\s*=\s*useRef\(new Set<string>\(\)\)/u);
  assert.match(experience, /setPageDirty\(source, dirty\)/u);
  assert.match(experience, /setPageDirty\(source, false\)/u);
  assert.match(app, /const onPopState[\s\S]*?!confirmNavigation\(locale\)/u);
  assert.match(app, /const signOut = async \(\) => \{\s*if \(!confirmNavigation\(locale\)\) return;/u);
  assert.match(banners, /useAdminPageDirty\(orderDirty\)/u);
  assert.match(contacts, /useAdminPageDirty\(orderDirty\)/u);
});

test("管理员会话权限来自数据库并同步到当前服务端会话", () => {
  const authController = read("apps/api/src/auth/auth.controller.ts");
  const authService = read("apps/api/src/auth/auth.service.ts");
  const sessionService = read("apps/api/src/auth/session.service.ts");
  const adminApi = read("apps/admin/src/api.ts");
  const app = read("apps/admin/src/App.tsx");

  assert.match(authService, /include:\s*\{\s*permissions:\s*\{\s*include:\s*\{\s*permission:\s*true/u);
  assert.match(authService, /permissions,\s*totpEnabled/u);
  assert.match(authController, /sessions\.synchronizePermissions\(token,\s*user\.permissions\)/u);
  assert.match(sessionService, /async synchronizePermissions\([\s\S]*?permissions:\s*\[\.\.\.new Set\(permissions\)\]\.sort\(\)/u);
  assert.match(adminApi, /permissions:\s*string\[\]/u);
  for (const permission of ["content.write", "support.write", "settings.write"]) {
    assert.match(app, new RegExp(`permissions\\.includes\\("${permission.replace(".", "\\.")}"\\)`, "u"));
  }
});

test("后台写入权限、缓存提交和输入安全门禁保持一致", () => {
  const experience = read("apps/admin/src/admin-experience.tsx");
  const adminApi = read("apps/admin/src/api.ts");
  const adminUi = read("apps/admin/src/admin-ui.tsx");
  const banners = read("apps/admin/src/features/content/banners-page.tsx");
  const contacts = read("apps/admin/src/features/support/contacts-page.tsx");
  const settings = read("apps/admin/src/features/settings/settings-page.tsx");

  assert.match(experience, /scopedCacheKey\(key\)/u);
  assert.match(experience, /const commit = useCallback\(\(value: T\)/u);
  assert.match(experience, /error\.status === 401 \|\| error\.status === 403/u);
  assert.match(adminApi, /response\.status === 401[\s\S]*?unauthorizedHandler\?\.\(\)/u);
  assert.match(adminUi, /onCloseRef\.current\(\)/u);

  assert.match(banners, /isSafeLocalRasterAsset/u);
  assert.match(banners, /disabled=\{orderDirty\}/u);
  assert.match(banners, /commit\(response\.data\)/u);
  assert.match(contacts, /disabled=\{orderDirty\}/u);
  assert.match(contacts, /commit\(response\.data\)/u);
  assert.doesNotMatch(contacts, /显示顺序|Display order/u);

  assert.match(settings, /data\.transitServiceUrl !== normalized\.transitServiceUrl/u);
  assert.match(settings, /parsed\.protocol !== "https:"/u);
  assert.match(settings, /policyVersionPattern\.test/u);
  assert.match(settings, /normalized\.reason\.length < 8/u);
  assert.match(settings, /aria-label=\{label\}/u);
  assert.match(settings, /<fieldset className="settings-editable-fieldset" disabled=\{!canWrite\}>/u);
});
