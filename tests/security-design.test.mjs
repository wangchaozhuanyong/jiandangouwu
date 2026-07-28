import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = async (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");

test("the storefront keeps public order lookup out of the active route and header", async () => {
  const app = await readSource("App.jsx");
  const clientAppStart = app.indexOf("function ClientApp");
  const clientAppEnd = app.indexOf("export function App");
  const activeClientRouteSource = app.slice(clientAppStart, clientAppEnd);
  assert.equal(activeClientRouteSource.includes('route === "/order/lookup"'), false);
  assert.equal(app.includes('className="text-action order-action"'), false);
});

test("admin sign-in design keeps only Google Authenticator 6-digit verification", async () => {
  const [app, auth, adminDesign] = await Promise.all([
    readSource("App.jsx"),
    readSource("AdminAuthFlow.jsx"),
    readSource("AdminDesignPages.jsx"),
  ]);
  assert.ok(app.includes("!adminSession"));
  assert.ok(app.includes("googleAuthenticatorEnabled"));
  assert.equal(app.includes('localStorage.setItem("admin'), false);
  assert.equal(app.includes('sessionStorage.setItem("admin'), false);
  for (const evidence of ["Google Authenticator", "6 位动态码", "one-time-code", "auth-code-input", "网页设计演示"]) {
    assert.ok(auth.includes(evidence), `missing admin security design evidence: ${evidence}`);
  }
  for (const removedDesign of ["WebAuthn", "Passkey", "恢复码", "ForgotPanel", "InvitePanel", "LockedPanel"]) {
    assert.equal(auth.includes(removedDesign), false, `removed login-security design remains: ${removedDesign}`);
  }
  assert.ok(adminDesign.includes('role="switch"'));
  assert.ok(adminDesign.includes("onGoogleAuthenticatorToggle"));
  assert.ok(adminDesign.includes("刷新后重置"));
  assert.equal(adminDesign.includes("QRCode"), false);
});

test("hosted payment preview never renders card-entry fields", async () => {
  const payment = await readSource("ClientDesignPages.jsx");
  for (const forbidden of ['name="card', 'name="cvv', 'name="cvc', 'autocomplete="cc-number"', 'autocomplete="cc-csc"']) {
    assert.equal(payment.toLowerCase().includes(forbidden), false, `hosted payment preview contains forbidden field: ${forbidden}`);
  }
  assert.ok(payment.includes("CloudBridge never collects card numbers"));
});

test("secrets design exposes only masked identifiers and status", async () => {
  const admin = await readSource("AdminDesignPages.jsx");
  assert.ok(admin.includes("This page never displays secret values"));
  assert.ok(admin.includes("•••• 4F8A"));
  assert.equal(admin.includes("sk_live_"), false);
  assert.equal(admin.includes("whsec_"), false);
});

test("telegram order-bot design stays simulated, masked, and server-only", async () => {
  const [app, admin, navigation, telegram] = await Promise.all([
    readSource("App.jsx"),
    readSource("AdminApp.jsx"),
    readSource("admin-navigation.js"),
    readSource("TelegramBotPage.jsx"),
  ]);
  assert.ok(app.includes('"telegram-bot":'));
  assert.ok(navigation.includes('id: "telegram-bot"'));
  assert.ok(admin.includes('page === "telegram-bot"'));
  assert.ok(telegram.includes("Secrets Manager"));
  assert.ok(telegram.includes("+60 •••• 0281"));
  assert.ok(telegram.includes("不会真实发送"));
  assert.equal(telegram.includes("api.telegram.org"), false);
  assert.equal(telegram.includes("VITE_TELEGRAM"), false);
  assert.equal(telegram.includes("bot_token"), false);
});
