import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("主平台技术栈和 MySQL 数据约束保持一致", () => {
  const root = JSON.parse(read("package.json"));
  const api = JSON.parse(read("apps/api/package.json"));
  const storefront = JSON.parse(read("apps/storefront/package.json"));
  const admin = JSON.parse(read("apps/admin/package.json"));
  const schema = read("apps/api/prisma/schema.prisma");
  const apiDockerfile = read("apps/api/Dockerfile");
  const prismaService = read("apps/api/src/prisma/prisma.service.ts");

  assert.equal(root.name, "cloudbridge-platform");
  assert.match(storefront.dependencies.next, /^16\./u);
  assert.match(admin.devDependencies.vite, /^8\./u);
  assert.match(api.dependencies["@nestjs/core"], /^11\./u);
  assert.equal(root.dependencies.react, storefront.dependencies.react);
  assert.equal(root.dependencies.react, admin.dependencies.react);
  assert.equal(root.dependencies["react-dom"], storefront.dependencies["react-dom"]);
  assert.equal(root.dependencies["react-dom"], admin.dependencies["react-dom"]);
  assert.match(schema, /provider\s*=\s*"mysql"/u);
  assert.match(schema, /basePrice\s+Decimal/u);
  assert.match(schema, /idempotencyKey\s+String\s+@unique/u);
  assert.match(schema, /passwordHash\s+String\?\s+@db\.Text/u);
  assert.doesNotMatch(schema, /model WebAuthnCredential|model RecoveryCode/u);
  assert.match(apiDockerfile, /ENV DATABASE_URL=mysql:\/\/cloudbridge:build-only@localhost:3306\/cloudbridge/u);
  assert.match(apiDockerfile, /ENV SHADOW_DATABASE_URL=mysql:\/\/cloudbridge:build-only@localhost:3306\/cloudbridge_shadow/u);
  assert.match(apiDockerfile, /--mount=type=cache,target=\/root\/\.npm npm ci --prefer-offline --no-audit --no-fund/u);
  assert.match(prismaService, /DB_TLS/u);
  assert.match(prismaService, /DB_ALLOW_PUBLIC_KEY_RETRIEVAL/u);
});

test("客户端保留能力栏、双列商品和完整双语订单输入", () => {
  const home = read("apps/storefront/components/storefront-home.tsx");
  const css = read("apps/storefront/app/globals.css");
  const detail = read("apps/storefront/components/product-detail.tsx");
  const dto = read("apps/api/src/orders/orders.dto.ts");
  const orders = read("apps/api/src/orders/orders.service.ts");

  assert.match(home, /className="capability-rail"/u);
  assert.doesNotMatch(home, /capability-title|capabilityTitle/u);
  assert.doesNotMatch(css, /\.capability-section\s*>\s*p/u);
  assert.doesNotMatch(home, /resultCount/u);
  assert.match(css, /\.product-grid\s*\{[^}]*repeat\(2,/su);
  assert.doesNotMatch(css, /@media \(max-width: 390px\)[\s\S]*?\.product-grid\s*\{\s*grid-template-columns:\s*1fr;/u);
  assert.match(detail, /locale,\s*\n\s*productId:/u);
  assert.match(dto, /@IsIn\(\["zh", "en"\]\)/u);
  assert.match(orders, /input\.locale === "zh" \? "ZH" : "EN"/u);
});

test("后台认证使用密码、可选 TOTP、服务端会话与敏感信息重认证", () => {
  const controller = read("apps/api/src/auth/auth.controller.ts");
  const guard = read("apps/api/src/auth/admin-session.guard.ts");
  const auth = read("apps/api/src/auth/auth.service.ts");
  const ordersAdmin = read("apps/api/src/orders/orders.admin.service.ts");

  assert.match(controller, /httpOnly:\s*true/u);
  assert.match(controller, /sameSite:\s*"strict"/u);
  assert.match(controller, /@Post\("login"\)/u);
  assert.match(controller, /@Post\("login\/totp"\)/u);
  assert.match(controller, /@Post\("totp\/disable"\)/u);
  assert.match(guard, /x-csrf-token/u);
  assert.match(auth, /scrypt\(/u);
  assert.match(auth, /user\.totpEnabled/u);
  assert.match(auth, /localSetupAllowed/u);
  assert.match(auth, /unlockIfExpired/u);
  assert.match(ordersAdmin, /reauthenticatedAt/u);
  assert.doesNotMatch(`${controller}\n${auth}`, /Passkey|WebAuthn|recoveryCode|bootstrapToken/iu);
  assert.doesNotMatch(`${controller}\n${guard}`, /localStorage|sessionStorage/u);
});

test("后台订单金额按币种精度输出，币种表保持严格单行列结构", () => {
  const service = read("apps/api/src/orders/orders.admin.service.ts");
  const admin = read("apps/admin/src/pages/currencies-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(service, /order\.amount\.toFixed\(currencyDigits\.get\(order\.currencyCode\)\s*\?\?\s*2\)/u);
  assert.match(service, /currencyDigits\.get\(order\.referenceCurrencyCode/u);
  assert.match(admin, /className="currency-head"/u);
  assert.match(css, /\.currency-head,\s*\.currency-table article\s*\{[^}]*grid-template-columns:[^}]*white-space:\s*nowrap;/su);
  assert.match(css, /@media \(max-width:\s*760px\)/u);
  assert.match(css, /\.category-list,\s*\.currency-table\s*\{\s*overflow-x:\s*auto;\s*\}/u);
});

test("公开 API 没有订单查询，人工订单不收集支付卡字段", () => {
  const publicOrders = read("apps/api/src/orders/orders.controller.ts");
  const contracts = read("packages/contracts/src/index.ts");
  const dto = read("apps/api/src/orders/orders.dto.ts");

  assert.doesNotMatch(publicOrders, /@Get/u);
  assert.doesNotMatch(`${contracts}\n${dto}`, /cardNumber|creditCard|cvv|cvc|panNumber/iu);
  assert.match(dto, /contactValue/u);
});

test("AWS 模板固定新加坡并保留高可用与部署授权边界", () => {
  const stack = read("infra/lib/cloudbridge-stack.ts");
  const entry = read("infra/bin/cloudbridge.ts");
  const infra = JSON.parse(read("infra/package.json"));

  assert.match(entry, /ap-southeast-1/u);
  assert.match(stack, /natGateways:\s*2/u);
  assert.match(stack, /multiAz:\s*true/u);
  assert.match(stack, /multiAzEnabled:\s*true/u);
  assert.match(stack, /desiredCount:\s*2/u);
  assert.match(stack, /deletionProtection:\s*true/u);
  assert.match(stack, /CfnWebACL/u);
  assert.equal(infra.scripts.deploy, undefined);
});
