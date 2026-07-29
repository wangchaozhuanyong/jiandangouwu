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

test("D1 data migration restores line breaks and the default transit entry", () => {
  const schemaMigration = read("drizzle/0000_salty_fat_cobra.sql");
  const backupMigration = read("drizzle/0001_robust_mole_man.sql");
  const designDataMigration = read("drizzle/0002_fix_storefront_design_data.sql");
  const query = [
    schemaMigration.replaceAll("--> statement-breakpoint", ""),
    backupMigration.replaceAll("--> statement-breakpoint", ""),
    designDataMigration.replaceAll("--> statement-breakpoint", ""),
    "SELECT",
    "  SUM(instr(title, char(10)) > 0),",
    "  SUM(instr(title, '\\n') > 0),",
    "  json_extract((SELECT value_json FROM site_settings WHERE key='storefront.settings'),'$.transitServiceEnabled'),",
    "  (SELECT version FROM site_settings WHERE key='storefront.settings')",
    "FROM hero_translations;",
  ].join("\n");
  const result = spawnSync("sqlite3", [":memory:"], {
    encoding: "utf8",
    input: query,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "8|0|1|2");
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
  assert.match(read("dist/.openai/drizzle/0002_fix_storefront_design_data.sql"), /char\(10\)/u);
  assert.match(read("dist/.openai/drizzle/0002_fix_storefront_design_data.sql"), /transitServiceEnabled/u);
  assert.match(
    read("dist/.openai/drizzle/0003_chunky_tattoo.sql"),
    /restore_validation_status/u,
  );
});

test("Sites scopes admin design tokens and document styles away from the storefront", () => {
  const adminStyles = read("../admin/src/styles.css");
  const adminLayout = read("app/admin/layout.tsx");
  const adminMain = read("../admin/src/main.tsx");
  assert.match(adminStyles, /^\.admin-surface \{/u);
  assert.doesNotMatch(adminStyles, /^:root \{/mu);
  assert.doesNotMatch(adminStyles, /^body \{/mu);
  assert.match(adminStyles, /\.admin-surface \.form-error/u);
  assert.match(adminLayout, /className="admin-surface"/u);
  assert.match(adminMain, /document\.body\.classList\.add\("cloudbridge-admin-document"\)/u);
  assert.match(adminMain, /className="admin-surface"/u);

  const cssDirectory = new URL("../dist/client/assets/", import.meta.url);
  const builtCss = readdirSync(cssDirectory)
    .filter((name) => name.endsWith(".css"))
    .map((name) => readFileSync(new URL(name, cssDirectory), "utf8"))
    .join("\n");
  assert.doesNotMatch(builtCss, /:root\{color:#1c3547;background:#eef4f7/u);
  assert.match(builtCss, /\.admin-surface\{[^}]*--ink:#1c3547[^}]*background:#eef4f7/u);
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

test("Sites backup admin exposes encrypted backup, isolated restore drill evidence, and fail-closed alerting", () => {
  const page = read("../admin/src/features/sites/sites-backups-page.tsx");
  const api = read("../admin/src/features/sites/backups-api.ts");
  const server = read("server/backup-api.ts");
  const admin = read("server/admin-api.ts");
  const runner = read("../../scripts/sites-restore-drill.mjs");
  assert.match(page, /createSitesBackup/u);
  assert.match(page, /verifySitesBackup/u);
  assert.match(page, /validateSitesBackupRestorePackage/u);
  assert.match(page, /邮件、短信或 Telegram 告警尚未连接/u);
  assert.match(page, /隔离恢复运行器/u);
  assert.match(page, /不会写入当前 D1/u);
  assert.match(page, /backupDownloadUrl/u);
  assert.match(server, /createBackupRestoreDrillTransfer/u);
  assert.match(server, /completeBackupRestoreDrill/u);
  assert.match(server, /EXTERNAL_ALERT_DELIVERY/u);
  assert.match(admin, /\/restore-drill-transfer/u);
  assert.match(admin, /\/restore-drill-complete/u);
  assert.match(runner, /new DatabaseSync\(":memory:"\)/u);
  assert.match(runner, /PRAGMA foreign_key_check/u);
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
