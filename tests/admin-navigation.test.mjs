import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ADMIN_NAVIGATION,
  closeAdminTab,
  findAdminGroup,
  flattenAdminNavigation,
  openAdminTab,
  partitionAdminTabs,
  partitionMobileAdminTabs,
  reorderAdminTabs,
  toggleExpandedGroup,
} from "../src/admin-navigation.js";

const expectedPageIds = [
  "dashboard",
  "orders",
  "disputes",
  "products",
  "categories",
  "banners",
  "media",
  "translations",
  "contacts",
  "notifications",
  "telegram-bot",
  "currencies",
  "payments",
  "reconciliation",
  "team",
  "roles",
  "security",
  "security-events",
  "data-security",
  "secrets",
  "logs",
  "backups",
  "integrations",
  "settings",
];

test("navigation keeps the fixed nine-entry order and direct workspace link", () => {
  assert.equal(ADMIN_NAVIGATION.length, 9);
  assert.deepEqual(
    ADMIN_NAVIGATION.map(({ id, kind }) => ({ id, kind })),
    [
      { id: "dashboard", kind: "link" },
      { id: "orders-after-sales", kind: "group" },
      { id: "catalog-management", kind: "group" },
      { id: "content-storefront", kind: "group" },
      { id: "support-notifications", kind: "group" },
      { id: "finance-settlement", kind: "group" },
      { id: "team-access", kind: "group" },
      { id: "security-compliance", kind: "group" },
      { id: "systems-operations", kind: "group" },
    ],
  );
});

test("all 24 admin pages appear exactly once without empty or oversized groups", () => {
  const groups = ADMIN_NAVIGATION.filter((entry) => entry.kind === "group");
  const pageIds = flattenAdminNavigation(ADMIN_NAVIGATION).map((item) => item.id);

  assert.equal(groups.length, 8);
  groups.forEach((group) => {
    assert.ok(group.items.length > 0, `${group.id} must not be empty`);
    assert.ok(group.items.length <= 4, `${group.id} must have at most four items`);
  });
  assert.equal(new Set(pageIds).size, 24);
  assert.deepEqual([...pageIds].sort(), [...expectedPageIds].sort());
});

test("task-oriented groups and existing badges stay attached to the correct pages", () => {
  const entriesById = Object.fromEntries(ADMIN_NAVIGATION.map((entry) => [entry.id, entry]));

  assert.deepEqual(entriesById["orders-after-sales"].items.map((item) => item.id), ["orders", "disputes"]);
  assert.deepEqual(entriesById["finance-settlement"].items.map((item) => item.id), ["currencies", "payments", "reconciliation"]);
  assert.deepEqual(entriesById["team-access"].items.map((item) => item.id), ["team", "roles"]);
  assert.deepEqual(entriesById["security-compliance"].items.map((item) => item.id), ["security", "security-events", "data-security", "secrets"]);
  assert.deepEqual(entriesById["systems-operations"].items.map((item) => item.id), ["logs", "backups", "integrations", "settings"]);
  assert.equal(entriesById["orders-after-sales"].items.find((item) => item.id === "orders").badge, "4");
  assert.equal(entriesById["orders-after-sales"].items.find((item) => item.id === "disputes").badge, "2");
  assert.equal(entriesById["security-compliance"].items.find((item) => item.id === "security-events").badge, "2");
});

test("accordion keeps at most one group expanded", () => {
  assert.equal(toggleExpandedGroup("catalog-management", "content-storefront"), "content-storefront");
  assert.equal(toggleExpandedGroup("content-storefront", "content-storefront"), null);
  assert.equal(findAdminGroup(ADMIN_NAVIGATION, "products")?.id, "catalog-management");
  assert.equal(findAdminGroup(ADMIN_NAVIGATION, "disputes")?.id, "orders-after-sales");
  assert.equal(findAdminGroup(ADMIN_NAVIGATION, "dashboard"), null);
});

test("opening a workspace tab never creates duplicates", () => {
  assert.deepEqual(openAdminTab(["dashboard"], "orders"), ["dashboard", "orders"]);
  assert.deepEqual(openAdminTab(["dashboard", "orders"], "orders"), ["dashboard", "orders"]);
});

test("workspace tabs reorder before and after a target", () => {
  const tabs = ["dashboard", "orders", "products", "categories"];
  assert.deepEqual(
    reorderAdminTabs(tabs, "categories", "orders", "before"),
    ["dashboard", "categories", "orders", "products"],
  );
  assert.deepEqual(
    reorderAdminTabs(tabs, "orders", "products", "after"),
    ["dashboard", "products", "orders", "categories"],
  );
});

test("the pinned workspace tab stays first and invalid moves are safe", () => {
  assert.deepEqual(
    reorderAdminTabs(["dashboard", "orders", "orders", "products"], "dashboard", "products", "after"),
    ["dashboard", "orders", "products"],
  );
  assert.deepEqual(
    reorderAdminTabs(["dashboard", "orders", "products"], "products", "dashboard", "before"),
    ["dashboard", "products", "orders"],
  );
  assert.deepEqual(
    reorderAdminTabs(["dashboard", "orders", "products"], "missing", "orders", "before"),
    ["dashboard", "orders", "products"],
  );
});

test("the pinned dashboard tab cannot be closed", () => {
  assert.deepEqual(
    closeAdminTab(["dashboard", "orders"], "dashboard", "dashboard"),
    { tabs: ["dashboard", "orders"], nextActiveId: "dashboard" },
  );
});

test("closing the active tab selects its left neighbor", () => {
  assert.deepEqual(
    closeAdminTab(["dashboard", "orders", "products"], "products", "products"),
    { tabs: ["dashboard", "orders"], nextActiveId: "orders" },
  );
  assert.deepEqual(
    closeAdminTab(["dashboard", "orders"], "orders", "orders"),
    { tabs: ["dashboard"], nextActiveId: "dashboard" },
  );
});

test("tab overflow keeps the pinned and active tabs visible", () => {
  const result = partitionAdminTabs({
    tabs: ["dashboard", "orders", "products", "categories"],
    activeId: "categories",
    widths: { dashboard: 100, orders: 100, products: 110, categories: 120 },
    availableWidth: 330,
    moreWidth: 80,
  });
  assert.deepEqual(result.visible, ["dashboard", "categories"]);
  assert.deepEqual(result.overflow, ["orders", "products"]);
});

test("overflow partitioning preserves a user-defined tab order", () => {
  const tabs = reorderAdminTabs(
    ["dashboard", "orders", "products", "categories", "settings"],
    "settings",
    "orders",
    "before",
  );
  const result = partitionAdminTabs({
    tabs,
    activeId: "categories",
    widths: { dashboard: 100, orders: 100, products: 110, categories: 120, settings: 100 },
    availableWidth: 350,
    moreWidth: 80,
  });
  assert.deepEqual(tabs, ["dashboard", "settings", "orders", "products", "categories"]);
  assert.deepEqual(result.visible, ["dashboard", "categories"]);
  assert.deepEqual(result.overflow, ["settings", "orders", "products"]);
});

test("new tabs append and active closing follows the reordered left neighbor", () => {
  const reordered = reorderAdminTabs(
    ["dashboard", "orders", "products", "categories"],
    "categories",
    "orders",
    "before",
  );
  assert.deepEqual(openAdminTab(reordered, "settings"), [
    "dashboard",
    "categories",
    "orders",
    "products",
    "settings",
  ]);
  assert.deepEqual(
    closeAdminTab(reordered, "orders", "orders"),
    {
      tabs: ["dashboard", "categories", "products"],
      nextActiveId: "categories",
    },
  );
});

test("mobile tabs show the active page and one useful companion when they fit", () => {
  const tabs = ["dashboard", "orders", "products", "categories", "settings"];
  const widths = { dashboard: 90, orders: 100, products: 110, categories: 110, settings: 100 };
  assert.deepEqual(
    partitionMobileAdminTabs({
      tabs,
      activeId: "dashboard",
      widths,
      availableWidth: 360,
      moreWidth: 82,
    }),
    {
      visible: ["dashboard", "settings"],
      overflow: ["orders", "products", "categories"],
    },
  );
  assert.deepEqual(
    partitionMobileAdminTabs({
      tabs,
      activeId: "categories",
      widths,
      availableWidth: 360,
      moreWidth: 82,
    }),
    {
      visible: ["dashboard", "categories"],
      overflow: ["orders", "products", "settings"],
    },
  );
});

test("mobile tabs keep the full active label when a second tab cannot fit", () => {
  assert.deepEqual(
    partitionMobileAdminTabs({
      tabs: ["dashboard", "settings", "security-events"],
      activeId: "security-events",
      widths: { dashboard: 100, settings: 140, "security-events": 170 },
      availableWidth: 300,
      moreWidth: 80,
    }),
    {
      visible: ["security-events"],
      overflow: ["dashboard", "settings"],
    },
  );
});

test("workspace tab sorting exposes pointer, touch, keyboard, and complete-manager affordances", async () => {
  const [adminSource, css] = await Promise.all([
    readFile(new URL("../src/AdminApp.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  ]);
  for (const evidence of [
    "DotsSixVertical",
    "window.setTimeout(beginPointerSort, 220)",
    "onPointerDown",
    "aria-live=\"polite\"",
    "role=\"dialog\"",
    "tabItems.map",
  ]) {
    assert.ok(adminSource.includes(evidence), `missing workspace sorting evidence: ${evidence}`);
  }
  assert.ok(css.includes(".admin-workspace-tab__sort-handle"));
  assert.ok(css.includes("touch-action: none"));
  assert.ok(css.includes(".admin-workspace-tabs__menu-row.is-drop-before"));
});
