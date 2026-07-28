import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = async (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("all visible brand lockups reuse the shared CloudBridge mark", async () => {
  const [brand, client, admin, auth] = await Promise.all([
    readSource("BrandMark.jsx"),
    readSource("App.jsx"),
    readSource("AdminApp.jsx"),
    readSource("AdminAuthFlow.jsx"),
  ]);

  assert.ok(brand.includes('src="/assets/cloudbridge-logo.png"'));
  for (const size of ["client", "footer"]) {
    assert.ok(client.includes(`<BrandMark size="${size}" />`));
  }
  for (const size of ["admin", "preview"]) {
    assert.ok(admin.includes(`<BrandMark size="${size}" />`));
  }
  assert.ok(auth.includes('<BrandMark size="auth" />'));
});

test("brand lockups contain no secondary subtitle", async () => {
  const [client, admin, auth] = await Promise.all([
    readSource("App.jsx"),
    readSource("AdminApp.jsx"),
    readSource("AdminAuthFlow.jsx"),
  ]);

  assert.equal(client.includes("<small>{t.brandLine}</small>"), false);
  assert.equal(client.includes("<small>{t.footerLine}</small>"), false);
  assert.equal(admin.includes("云桥管理中心"), false);
  assert.equal(admin.includes("Operations console"), false);
  assert.equal(auth.includes("云桥管理中心"), false);
  assert.equal(auth.includes("CloudBridge Admin"), false);
});

test("shared mark preserves its artwork while every surface owns an explicit frame", async () => {
  const css = await readSource("styles.css");

  assert.ok(css.includes(".brand-mark img"));
  assert.ok(css.includes("object-fit: contain"));
  for (const modifier of ["client", "admin", "auth", "footer", "preview"]) {
    assert.ok(css.includes(`.brand-mark--${modifier}`), `missing ${modifier} logo frame`);
  }
  assert.equal(css.includes(".admin-auth-brand img {\n  width: 38px;\n  height: 38px;"), false);
});
