import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("Telegram 后台显示真实连接、回执和人工重试", () => {
  const page = read("apps/admin/src/features/notifications/telegram-new-order-page.tsx");
  const api = read("apps/admin/src/features/notifications/api.ts");

  assert.match(page, /testTelegramConnection/u);
  assert.match(page, /getTelegramDeliveries/u);
  assert.match(page, /retryTelegramDelivery/u);
  assert.match(page, /telegramMessageId/u);
  assert.match(api, /\$\{settingsPath\}\/test/u);
  assert.match(api, /telegram-deliveries/u);
});

test("自动汇率界面在桌面和移动端保持单一真实状态", () => {
  const page = read("apps/admin/src/features/exchange-rates/exchange-rate-sync-panel.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(page, /ECB|欧洲央行/u);
  assert.match(page, /Coinbase/u);
  assert.match(page, /AUTO/u);
  assert.match(page, /MANUAL/u);
  assert.match(page, /runExchangeRateSync/u);
  assert.match(css, /\.exchange-sync-modes/u);
  assert.match(css, /@media \(max-width: 440px\)[\s\S]*?\.exchange-sync-modes/u);
});

test("数据治理界面明确只预览并保护不可逆操作", () => {
  const page = read("apps/admin/src/features/data-security/data-governance-panel.tsx");

  assert.match(page, /writesPerformed/u);
  assert.match(page, /ANONYMIZE VERIFIED CONTACT/u);
  assert.match(page, /CLOUDBRIDGE_DATA_KEY_NEXT/u);
  assert.match(page, /ROTATE|runDataKeyRotation/u);
  assert.match(page, /PREVIEW_ONLY/u);
});

test("Sites 系统页只展示 D1、R2、ChatGPT 与托管密钥", () => {
  const page = read("apps/admin/src/features/sites/sites-platform-page.tsx");

  assert.match(page, /Sites D1/u);
  assert.match(page, /Sites R2/u);
  assert.match(page, /ChatGPT/u);
  assert.match(page, /dataEncryptionKey/u);
  assert.doesNotMatch(page, /MySQL|Valkey|AWS|RDS|KMS/u);
});
