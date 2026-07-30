import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Sites 公开下单保持客服、联系方式、汇率与库存门禁", () => {
  const publicApi = read("apps/sites/server/public-api.ts");

  assert.match(publicApi, /acceptOrders/u);
  assert.match(publicApi, /assertOrderRatesFresh/u);
  assert.match(publicApi, /isConfiguredContactChannel/u);
  assert.match(publicApi, /stock_quantity = stock_quantity - 1/u);
  assert.match(publicApi, /hashOrderContact/u);
  assert.match(publicApi, /telegramDeliveryInsert/u);
});

test("联系方式后台设置与接单开关仍有真实前置条件", () => {
  const adminApi = read("apps/sites/server/admin-api.ts");
  const publicApi = read("apps/sites/server/public-api.ts");
  const settingsPage = read("apps/admin/src/features/settings/settings-page.tsx");
  const contactsPage = read("apps/admin/src/features/support/contacts-page.tsx");

  assert.match(adminApi, /ORDER_SUPPORT_REQUIRED/u);
  assert.match(adminApi, /CONTACT_CHANNEL_REQUIRED/u);
  assert.match(publicApi, /storedSettings\.acceptOrders && supportEnabled/u);
  assert.match(settingsPage, /configuredActiveContactChannels/u);
  assert.match(contactsPage, /isConfiguredContactChannel/u);
});

test("共享契约包含 Telegram 汇率与数据治理领域", () => {
  const contracts = read("packages/contracts/src/index.ts");

  for (const moduleName of [
    "catalog",
    "content",
    "data-governance",
    "exchange-rates",
    "notifications",
    "orders",
    "settings",
    "storefront",
    "support",
  ]) {
    assert.match(contracts, new RegExp(`export \\* from "\\./${moduleName}\\.js"`, "u"));
  }
});

test("后台汇率和治理页面调用真实 Sites 接口", () => {
  const app = read("apps/admin/src/App.tsx");
  const currencies = read("apps/admin/src/pages/currencies-page.tsx");
  const exchangeApi = read("apps/admin/src/features/exchange-rates/api.ts");
  const governance = read("apps/admin/src/features/data-security/data-governance-panel.tsx");
  const governanceApi = read("apps/admin/src/features/data-security/governance-api.ts");

  assert.match(currencies, /<ExchangeRateSyncPanel/u);
  assert.match(exchangeApi, /\/admin\/exchange-rate-sync/u);
  assert.match(governance, /PREVIEW_ONLY/u);
  assert.match(governanceApi, /\/admin\/data-governance/u);
  assert.match(app, /page === "data-security"[\s\S]*?<DataSecurityPage/u);
  assert.doesNotMatch(app, /features\/backups\/backup-readiness|features\/integrations\/integration-readiness|features\/secrets\/secrets-readiness/u);
});

test("支付与自动退款仍明确保持边界", () => {
  const afterSales = read("apps/admin/src/features/orders/after-sales-page.tsx");
  const reconciliation = read("apps/admin/src/features/finance/reconciliation-page.tsx");

  assert.match(afterSales, /不会调用支付机构、自动退款/u);
  assert.match(reconciliation, /尚未开发外部事件验签/u);
});
