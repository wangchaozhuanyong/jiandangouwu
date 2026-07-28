import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = async (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("orders use dedicated one-line columns at desktop and mobile widths", async () => {
  const admin = await readProjectFile("src/AdminApp.jsx");
  const tableStart = admin.indexOf("function OrdersTable");
  const tableEnd = admin.indexOf("function DashboardPage");
  const table = admin.slice(tableStart, tableEnd);

  for (const label of ["订单号", "订单时间", "金额", "联系渠道", "联系账号", "处理状态", "付款状态", "负责人"]) {
    assert.ok(table.includes(label), `missing order column: ${label}`);
  }

  assert.ok(table.includes("formatTableDateTime(order.createdAt)"));
  assert.ok(table.includes('className="order-amount-cell"'));
  assert.ok(table.includes("<small>· {order.usdt}</small>"));
  assert.equal(table.includes("mobile-order-list"), false);
  assert.equal(table.includes("mobile-order-card"), false);
});

test("admin row grids separate secondary values into explicit columns", async () => {
  const [admin, design, telegram] = await Promise.all([
    readProjectFile("src/AdminApp.jsx"),
    readProjectFile("src/AdminDesignPages.jsx"),
    readProjectFile("src/TelegramBotPage.jsx"),
  ]);

  for (const label of ["分类", "缺失字段", "代码", "名称", "邮箱", "工作组", "修改时间", "设备与追踪"]) {
    assert.ok(admin.includes(label), `missing admin table column: ${label}`);
  }

  for (const className of [
    "webhook-events__header",
    "dispute-list__header",
    "retention-table__header",
    "restore-points__header",
    "security-event-list__header",
  ]) {
    assert.ok(design.includes(className), `missing design table header: ${className}`);
  }

  assert.ok(design.includes('className={`google-auth-switch'));
  assert.ok(design.includes("google-auth-digits"));
  assert.equal(design.includes("security-session-table__header"), false);
  assert.ok(telegram.includes('zh ? "事件编号" : "Event ID"'));
  assert.equal(telegram.includes("<strong>{row.event[lang]}</strong><small>{row.id}</small>"), false);
});

test("the shared table contract keeps records on one line and scrolls internally", async () => {
  const css = await readProjectFile("src/styles.css");
  assert.ok(css.includes("Admin data-table contract: one record equals one visual line"));
  assert.ok(css.includes("white-space: nowrap"));
  assert.ok(css.includes("text-overflow: ellipsis"));
  assert.ok(css.includes(".recent-orders .responsive-table > table"));
  assert.ok(css.includes("display: table"));
  assert.ok(css.includes("position: sticky"));
});
