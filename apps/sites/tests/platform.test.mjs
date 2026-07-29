import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("D1 migration creates the production catalog with safe launch defaults", () => {
  const migration = read("drizzle/0000_salty_fat_cobra.sql");
  const query = [
    migration.replaceAll("--> statement-breakpoint", ""),
    "PRAGMA foreign_key_check;",
    "SELECT",
    "  (SELECT COUNT(*) FROM products),",
    "  (SELECT COUNT(*) FROM categories),",
    "  (SELECT COUNT(*) FROM currencies),",
    "  json_extract((SELECT value_json FROM site_settings WHERE key='storefront.settings'),'$.acceptOrders'),",
    "  (SELECT COUNT(*) FROM merchant_channels WHERE active=1);",
  ].join("\n");
  const result = spawnSync("sqlite3", [":memory:"], {
    encoding: "utf8",
    input: query,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "8|4|9|0|0");
});

test("Sites build declares D1 and R2 and ships the migration", () => {
  const sourceHosting = JSON.parse(read("../../.openai/hosting.json"));
  const builtHosting = JSON.parse(read("dist/.openai/hosting.json"));
  assert.equal(sourceHosting.d1, "DB");
  assert.equal(sourceHosting.r2, "MEDIA");
  assert.deepEqual(builtHosting, sourceHosting);
  assert.match(read("dist/.openai/drizzle/0000_salty_fat_cobra.sql"), /CREATE TABLE `orders`/u);
  assert.match(
    read("dist/.openai/drizzle/0001_robust_mole_man.sql"),
    /CREATE TABLE `backup_snapshots`/u,
  );
  assert.match(
    read("dist/.openai/drizzle/0002_adorable_lethal_legion.sql"),
    /restore_validation_status/u,
  );
});

test("Sites admin uses ChatGPT authentication and never enables customer login", () => {
  const packageJson = read("package.json");
  const adminRoute = read("app/admin/[[...path]]/page.tsx");
  const storefrontProvider = read("../storefront/components/experience-provider.tsx");
  assert.match(packageJson, /VITE_ADMIN_AUTH_PROVIDER=sites/u);
  assert.match(adminRoute, /requireChatGPTUser/u);
  assert.doesNotMatch(storefrontProvider, /password|signIn|loginWithPassword/u);
});

test("Sites runtime contains public, admin, health, D1, and R2 routes", () => {
  const router = read("server/router.ts");
  const admin = read("server/admin-api.ts");
  assert.match(router, /handlePublicApi/u);
  assert.match(router, /handleAdminApi/u);
  assert.match(router, /\/media\//u);
  assert.match(admin, /\/v1\/admin\/sites-readiness/u);
  assert.match(admin, /\/v1\/admin\/backups/u);
  assert.match(admin, /valkey: "not_required"/u);
});

test("Sites worker avoids createRequire with an undefined module URL", () => {
  const workerEntry = read("dist/server/index.js");
  assert.doesNotMatch(workerEntry, /createRequire\(import\.meta\.url\)/u);
  assert.match(workerEntry, /id === "node:async_hooks"/u);
  assert.match(workerEntry, /AsyncLocalStorage: AsyncLocalStorage\$1/u);
  for (const file of collectJavaScriptFiles(new URL("../dist/server/", import.meta.url))) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /createRequire\(import\.meta\.url\)/u);
  }
});

test("Sites logo bypasses unavailable image transforms and the worker keeps a safe fallback", () => {
  const shell = read("../storefront/components/site-shell.tsx");
  const worker = read("worker/index.ts");
  assert.equal((shell.match(/unoptimized/gu) ?? []).length, 2);
  assert.ok(worker.includes("if (!images)"));
  assert.ok(worker.includes('source.startsWith("/")'));
  assert.ok(worker.includes("sourceUrl.origin !== url.origin"));
});

test("Sites backup admin exposes create, verify, logical restore validation, and encrypted download", () => {
  const page = read("../admin/src/features/sites/sites-backups-page.tsx");
  const api = read("../admin/src/features/sites/backups-api.ts");
  assert.match(page, /createSitesBackup/u);
  assert.match(page, /verifySitesBackup/u);
  assert.match(page, /validateSitesBackupRestorePackage/u);
  assert.match(page, /外部邮件、短信或 Telegram 告警尚未连接/u);
  assert.match(page, /backupDownloadUrl/u);
  assert.match(page, /不会写入或覆盖当前 D1/u);
  assert.match(api, /method: "POST"/u);
  assert.match(api, /\/restore-validation/u);
  assert.match(api, /\/download/u);
  assert.doesNotMatch(page, /restoreSitesBackup|恢复成功|恢复演练完成/u);
});

function collectJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) return collectJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}
