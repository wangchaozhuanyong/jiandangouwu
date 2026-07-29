import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("正式后台的24个页面都具备完整流程设计或专属设计入口", () => {
  const workflows = read("apps/admin/src/design-workflows.tsx");
  const preview = read("apps/admin/src/pages/design-preview-page.tsx");
  const app = read("apps/admin/src/App.tsx");
  const dashboard = read("apps/admin/src/pages/dashboard-page.tsx");
  const orders = read("apps/admin/src/pages/orders-page.tsx");
  const products = read("apps/admin/src/pages/products-page.tsx");
  const categories = read("apps/admin/src/pages/categories-page.tsx");
  const currencies = read("apps/admin/src/pages/currencies-page.tsx");
  const security = read("apps/admin/src/pages/security-page.tsx");
  const audit = read("apps/admin/src/pages/audit-page.tsx");

  for (const id of [
    "disputes", "media", "translations", "notifications",
    "telegram-bot", "payments", "reconciliation", "team", "roles", "security-events",
    "data-security", "secrets", "backups", "integrations",
  ]) {
    assert.match(workflows, new RegExp(`(?:^|\\n)\\s*(?:["']${id}["']|${id}):\\s*workflow\\(`, "u"), `${id} should define a complete workflow`);
  }

  assert.match(preview, /<DesignWorkflowDialog/u);
  assert.match(app, /id="account-center"/u);
  assert.match(dashboard, /id="dashboard-insights"/u);
  assert.match(orders, /<OrderDetailDialog/u);
  assert.doesNotMatch(orders, /DesignWorkflowDialog|order-workbench|design-preview-note/u);
  assert.match(products, /id="inventory-center"/u);
  assert.match(categories, /id="categories"/u);
  assert.match(currencies, /id="currencies"/u);
  assert.match(security, /id="security"/u);
  assert.match(audit, /id="logs"/u);
  assert.match(app, /page === "banners"[\s\S]*?<BannersPage/u);
  assert.match(app, /page === "contacts"[\s\S]*?<ContactsPage/u);
  assert.match(app, /page === "settings"[\s\S]*?<SettingsPage/u);
});

test("设计工作流覆盖主流程与恢复状态且不产生服务器写入", () => {
  const workflows = read("apps/admin/src/design-workflows.tsx");

  for (const state of [
    "ready",
    "initial-loading",
    "empty",
    "offline",
    "error",
    "forbidden",
    "conflict",
  ]) {
    assert.match(workflows, new RegExp(`"${state}"`, "u"), `${state} should be previewable`);
  }

  assert.match(workflows, /aria-current=\{step === index \? "step"/u);
  assert.match(workflows, /服务器数据保持不变/u);
  assert.match(workflows, /没有执行保存、发送或其他服务器操作/u);
  assert.match(workflows, /event\.key === "Escape"|<Dialog/u);
  assert.doesNotMatch(workflows, /\bfetch\(|createProduct\(|updateOrderStatus\(|updateRate\(/u);
});

test("完整流程设计保持移动端和44px操作目标", () => {
  const css = read("apps/admin/src/styles.css");

  assert.match(css, /\.design-flow-statebar button\s*\{[^}]*min-height:\s*40px;/u);
  assert.match(css, /\.design-flow-actions > button\s*\{[^}]*min-height:\s*44px;/u);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.design-flow-layout\s*\{\s*grid-template-columns:\s*1fr;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.design-flow-steps\s*\{\s*grid-template-columns:\s*1fr;/u);
  assert.match(css, /\.row-actions\s*\{[^}]*display:\s*flex;/u);
});

test("真实订单中心使用模块化列表、详情、权限和敏感信息边界", () => {
  const app = read("apps/admin/src/App.tsx");
  const page = read("apps/admin/src/pages/orders-page.tsx");
  const api = read("apps/admin/src/features/orders/api.ts");
  const filters = read("apps/admin/src/features/orders/order-filters.tsx");
  const table = read("apps/admin/src/features/orders/orders-table.tsx");
  const detail = read("apps/admin/src/features/orders/order-detail-dialog.tsx");
  const contact = read("apps/admin/src/features/orders/sensitive-contact-panel.tsx");
  const timeline = read("apps/admin/src/features/orders/order-timeline.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /canWrite=\{user\.permissions\.includes\("orders\.write"\)\}/u);
  assert.match(app, /canRevealContact=\{user\.permissions\.includes\("contacts\.reveal"\)\}/u);
  assert.match(page, /readOrderQuery\(window\.location\.search,\s*scope\)/u);
  assert.match(page, /window\.addEventListener\("popstate"/u);
  assert.match(page, /filtered[\s\S]*?没有符合当前筛选的订单/u);
  assert.match(filters, /statuses\.map/u);
  assert.match(filters, /assigneeId/u);
  assert.match(filters, /contactChannelTypes\.map/u);

  for (const path of [
    "/admin/orders?",
    "/admin/orders/assignees",
    "/status",
    "/assignment",
    "/reveal-contact",
  ]) {
    assert.match(api, new RegExp(path.replace(/[?]/gu, "\\?"), "u"));
  }

  for (const column of [
    "订单号", "创建时间", "商品", "金额", "币种", "参考金额", "参考币种",
    "渠道", "脱敏账号", "订单状态", "人工付款记录阶段", "负责人", "预留到期", "操作",
  ]) {
    assert.match(table, new RegExp(column, "u"), `${column} should remain a dedicated column`);
  }
  assert.match(table, /<table className="order-record-table">/u);
  assert.doesNotMatch(table, /revealAdminOrderContact|revealedContact/u);

  assert.match(detail, /getAdminOrderDetail/u);
  assert.match(detail, /data\.allowedTransitions\.map/u);
  assert.match(detail, /expectedStatus:\s*data\.status/u);
  assert.match(detail, /expectedAssigneeId:\s*data\.assignedTo/u);
  assert.match(detail, /error instanceof ApiError && error\.status === 409/u);
  assert.match(detail, /\{canWrite \?/u);
  assert.match(detail, /\{canRevealContact \?/u);
  assert.match(timeline, /events\.map/u);

  assert.match(contact, /revealDurationMs = 60_000/u);
  assert.match(contact, /document\.hidden/u);
  assert.match(contact, /visibilitychange/u);
  assert.match(contact, /reason\.trim\(\)/u);
  assert.doesNotMatch(contact, /localStorage|sessionStorage|useCachedAdminResource|notify\(/u);

  assert.match(css, /\.order-record-table\s*\{[^}]*min-width:\s*1860px;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.order-record-table th:first-child/u);
  assert.match(css, /\.row-action\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
});
