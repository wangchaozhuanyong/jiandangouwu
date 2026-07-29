import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const readOptional = (file) => (
  existsSync(new URL(`../${file}`, import.meta.url)) ? read(file) : ""
);

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
  const channelIndex = orders.indexOf("if (!activeChannel || !isConfiguredContactChannel(activeChannel))");
  const stockIndex = orders.indexOf("stockQuantity: { gte: 1 }");

  assert.ok(gateIndex >= 0);
  assert.ok(policyIndex > gateIndex);
  assert.ok(channelIndex > policyIndex);
  assert.ok(stockIndex > channelIndex);
});

test("接单和客服入口只允许在真实联系方式准备完成后开启", () => {
  const supportContract = read("packages/contracts/src/support.ts");
  const settingsService = read("apps/api/src/settings/settings.service.ts");
  const supportService = read("apps/api/src/support/support.service.ts");
  const sitesAdmin = read("apps/sites/server/admin-api.ts");
  const sitesPublic = read("apps/sites/server/public-api.ts");
  const settingsPage = read("apps/admin/src/features/settings/settings-page.tsx");
  const contactsPage = read("apps/admin/src/features/support/contacts-page.tsx");

  assert.match(supportContract, /isConfiguredContactChannel/u);
  assert.match(supportContract, /unconfiguredContactValues/u);
  assert.match(settingsService, /next\.acceptOrders && !next\.supportEnabled/u);
  assert.match(settingsService, /configuredActiveChannels\.length === 0/u);
  assert.match(settingsService, /parsed\.acceptOrders && supportEnabled/u);
  assert.match(supportService, /CONTACT_CHANNEL_NOT_CONFIGURED/u);
  assert.match(supportService, /CONTACT_CHANNEL_REQUIRED/u);
  assert.match(sitesAdmin, /ORDER_SUPPORT_REQUIRED/u);
  assert.match(sitesAdmin, /CONTACT_CHANNEL_REQUIRED/u);
  assert.match(sitesPublic, /storedSettings\.acceptOrders && supportEnabled/u);
  assert.match(sitesPublic, /!channel \|\| !isConfiguredContactChannel\(channel\)/u);
  assert.match(settingsPage, /orderReadiness\?\.configuredActiveContactChannels/u);
  assert.match(settingsPage, /管理联系方式|Manage contacts/u);
  assert.match(contactsPage, /isConfiguredContactChannel/u);
});

test("三个正式后台页面不再经过设计预览并调用真实接口", () => {
  const app = read("apps/admin/src/App.tsx");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
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

test("团队和角色页面使用真实 MySQL 权限模型与安全写入", () => {
  const app = read("apps/admin/src/App.tsx");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const controller = read("apps/api/src/access/access.controller.ts");
  const service = read("apps/api/src/access/access.service.ts");
  const sessions = read("apps/api/src/auth/session.service.ts");
  const guard = read("apps/api/src/auth/admin-session.guard.ts");
  const team = read("apps/admin/src/features/access/team-page.tsx");
  const roles = read("apps/admin/src/features/access/roles-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/access\/team-page"\)\)/u);
  assert.match(app, /lazy\(\(\) => import\("\.\/features\/access\/roles-page"\)\)/u);
  assert.match(app, /page === "team"[\s\S]*?<TeamPage/u);
  assert.match(app, /page === "roles"[\s\S]*?<RolesPage/u);
  for (const page of ["team", "roles"]) {
    assert.doesNotMatch(preview, new RegExp(`page === "${page}"`, "u"));
  }

  assert.match(controller, /@Controller\("admin\/access"\)/u);
  assert.match(controller, /@RequirePermissions\("team\.manage"\)/u);
  assert.match(controller, /@RequirePermissions\("roles\.manage"\)/u);
  assert.match(service, /RECENT_AUTH_WINDOW_MS/u);
  assert.match(service, /Administrators cannot change their own roles/u);
  assert.match(service, /last active super administrator/u);
  assert.match(service, /updateMemberLifecycle/u);
  assert.match(service, /team\.member\.totp_reset/u);
  assert.match(service, /destroyUserAuthenticationState/u);
  assert.match(service, /totpSecretEncrypted:\s*null/u);
  assert.match(sessions, /scanKeys\("admin-session:\*"\)/u);
  assert.match(sessions, /scanKeys\("auth-flow:\*"\)/u);
  assert.doesNotMatch(sessions, /\.keys\(/u);
  assert.match(service, /TransactionIsolationLevel\.Serializable/u);
  assert.match(service, /result:\s*"SUCCEEDED"[\s\S]*?beforeData:[\s\S]*?afterData:/u);
  assert.match(guard, /currentUser[\s\S]*?currentPermissions/u);
  assert.match(guard, /synchronizePermissions/u);

  assert.match(team, /getTeamOverview/u);
  assert.match(team, /updateMemberRoles/u);
  assert.match(team, /updateMemberLifecycle/u);
  assert.match(team, /sitesRuntime/u);
  assert.match(team, /RESET_TOTP/u);
  assert.match(roles, /getRolesOverview/u);
  assert.match(roles, /updateRolePermissions/u);
  assert.match(team, /window\.confirm/u);
  assert.match(roles, /window\.confirm/u);
  assert.doesNotMatch(`${team}\n${roles}`, /界面设计预览|Interface design preview/u);
  assert.match(css, /\.team-table \.table-head,\s*\.team-table \.table-row\s*\{[^}]*min-width:\s*1320px;/u);
  assert.match(css, /\.row-icon-action\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.access-permission-grid\s*\{\s*grid-template-columns:\s*1fr;/u);
});

test("双语内容工作台聚合现有领域并保持原权限边界", () => {
  const app = read("apps/admin/src/App.tsx");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const page = read("apps/admin/src/features/translations/translations-page.tsx");
  const api = read("apps/admin/src/features/translations/api.ts");
  const sharedApi = read("apps/admin/src/api.ts");
  const model = read("apps/admin/src/features/translations/model.ts");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/translations\/translations-page"\)\)/u);
  assert.match(app, /page === "translations"[\s\S]*?<TranslationsPage/u);
  assert.doesNotMatch(preview, /page === "translations"|function TranslationsDesign/u);

  for (const permission of [
    "catalog.read", "content.read", "support.read", "settings.read",
  ]) {
    assert.match(page, new RegExp(`"${permission}"`, "u"));
  }
  for (const writePermission of [
    "catalog.write", "content.write", "support.write", "settings.write",
  ]) {
    assert.match(model, new RegExp(`allowed\\.has\\("${writePermission}"\\)`, "u"));
  }
  for (const owningWrite of [
    "updateProduct", "updateCategory", "updateHero",
    "updateContactChannel", "updateSiteSettings",
  ]) {
    assert.match(api, new RegExp(`\\b${owningWrite}\\b`, "u"));
  }
  assert.match(api, /getAllProducts/u);
  assert.match(sharedApi, /pageSize=100/u);
  assert.match(sharedApi, /page <= pageCount/u);
  assert.match(page, /normalizeTranslationDraft/u);
  assert.match(page, /requestError instanceof ApiError && requestError\.status === 409/u);
  assert.match(page, /不跨语言自动回退/u);
  assert.doesNotMatch(page, /界面设计预览|Interface design preview/u);
  assert.match(css, /\.translation-workbench\s*\{[^}]*grid-template-columns:/u);
  assert.match(css, /@media \(max-width: 440px\)[\s\S]*?\.translation-field-pair\s*\{\s*grid-template-columns:\s*1fr;/u);
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

test("人工收款与对账准备都使用真实只读内部历史", () => {
  const app = read("apps/admin/src/App.tsx");
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const page = read("apps/admin/src/features/finance/manual-payments-page.tsx");
  const reconciliation = read("apps/admin/src/features/finance/reconciliation-page.tsx");
  const reconciliationModel = read("apps/admin/src/features/finance/reconciliation-model.ts");
  const api = read("apps/admin/src/features/finance/api.ts");
  const filters = read("apps/admin/src/features/finance/filters.tsx");
  const table = read("apps/admin/src/features/finance/table.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/finance\/manual-payments-page"\)\)/u);
  assert.match(app, /page === "payments"[\s\S]*?<ManualPaymentsPage/u);
  assert.match(app, /<ManualPaymentsPage[\s\S]*?permissions\.includes\("contacts\.reveal"\)[\s\S]*?permissions\.includes\("orders\.write"\)/u);
  assert.match(app, /lazy\(\(\) => import\("\.\/features\/finance\/reconciliation-page"\)\)/u);
  assert.match(app, /page === "reconciliation"[\s\S]*?<ReconciliationPage/u);
  assert.doesNotMatch(preview, /page === "reconciliation"|ReconciliationDesign/u);
  assert.match(page, /readManualPaymentQuery\(window\.location\.search\)/u);
  assert.match(page, /<OrderDetailDialog/u);
  assert.match(page, /不是支付流水，不证明款项到账或退款完成/u);
  assert.match(page, /不同币种不会合并为总额/u);
  assert.doesNotMatch(page, /notify\(|DesignPreviewPage|设计预览|保存成功|删除成功/u);

  assert.match(api, /\/admin\/manual-payment-events\?/u);
  assert.match(api, /request<AdminManualPaymentEvent\[\]>/u);
  assert.match(api, /getAllManualPaymentEvents/u);
  assert.match(api, /pageSize:\s*100/u);
  assert.match(api, /\} while \(page <= pageCount\)/u);
  assert.doesNotMatch(api, /method:|POST|PATCH|PUT|DELETE/u);
  assert.match(reconciliation, /Only internal manual records exist; this is not external reconciliation/u);
  assert.match(reconciliation, /No cross-currency total/u);
  assert.match(reconciliationModel, /externalEvidenceState:\s*"NOT_COLLECTED"/u);
  assert.match(reconciliationModel, /allExternalActionsUnverified:\s*true/u);
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
  const preview = readOptional("apps/admin/src/pages/design-preview-page.tsx");
  const api = read("apps/admin/src/features/notifications/api.ts");
  const page = read("apps/admin/src/features/notifications/telegram-new-order-page.tsx");
  const readiness = read("apps/admin/src/features/notifications/notifications-page.tsx");
  const readinessModel = read("apps/admin/src/features/notifications/model.ts");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /lazy\(\(\) => import\("\.\/features\/notifications\/telegram-new-order-page"\)\)/u);
  assert.match(app, /page === "telegram-bot"[\s\S]*?<TelegramNewOrderPage/u);
  assert.match(app, /<TelegramNewOrderPage[\s\S]*?permissions\.includes\("settings\.write"\)/u);
  assert.match(app, /page === "notifications"[\s\S]*?<NotificationsPage/u);
  assert.match(readiness, /getTelegramNewOrderSettings/u);
  assert.match(readinessModel, /NOT_COLLECTED/u);
  assert.doesNotMatch(readiness, /simulateTelegramNewOrder|updateTelegramNewOrderSettings/u);
  assert.doesNotMatch(preview, /page === "notifications"|NotificationsDesign/u);

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
