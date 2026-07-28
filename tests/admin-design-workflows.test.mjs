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
    "disputes", "banners", "media", "translations", "contacts", "notifications",
    "telegram-bot", "payments", "reconciliation", "team", "roles", "security-events",
    "data-security", "secrets", "backups", "integrations", "settings",
  ]) {
    assert.match(workflows, new RegExp(`(?:^|\\n)\\s*(?:["']${id}["']|${id}):\\s*workflow\\(`, "u"), `${id} should define a complete workflow`);
  }

  assert.match(preview, /<DesignWorkflowDialog/u);
  assert.match(app, /id="account-center"/u);
  assert.match(dashboard, /id="dashboard-insights"/u);
  assert.match(orders, /id="order-workbench"/u);
  assert.match(products, /id="inventory-center"/u);
  assert.match(categories, /id="categories"/u);
  assert.match(currencies, /id="currencies"/u);
  assert.match(security, /id="security"/u);
  assert.match(audit, /id="logs"/u);
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
