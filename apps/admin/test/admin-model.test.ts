import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessAdminPage,
  ADMIN_PAGES,
} from "../src/admin-model.js";

test("admin direct routes and navigation use the same page permission filter", () => {
  const readOnly = [
    "catalog.read",
    "orders.read",
    "content.read",
    "support.read",
    "settings.read",
  ];
  assert.equal(canAccessAdminPage("products", readOnly), true);
  assert.equal(canAccessAdminPage("orders", readOnly), true);
  assert.equal(canAccessAdminPage("contacts", readOnly), true);
  assert.equal(canAccessAdminPage("team", readOnly), false);
  assert.equal(canAccessAdminPage("roles", readOnly), false);
  assert.equal(canAccessAdminPage("logs", readOnly), false);
  assert.equal(canAccessAdminPage("dashboard", readOnly), true);
  assert.equal(ADMIN_PAGES.every((page) => typeof canAccessAdminPage(page, readOnly) === "boolean"), true);
});

test("media and translation workspaces remain visible when any supported read scope exists", () => {
  assert.equal(canAccessAdminPage("media", ["catalog.read"]), true);
  assert.equal(canAccessAdminPage("media", ["content.read"]), true);
  assert.equal(canAccessAdminPage("translations", ["support.read"]), true);
  assert.equal(canAccessAdminPage("translations", []), false);
});
