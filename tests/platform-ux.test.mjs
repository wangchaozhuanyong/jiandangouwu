import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("正式客户端使用持续壳层和路由级加载错误边界", () => {
  const localeLayout = read("apps/storefront/app/[locale]/layout.tsx");
  const home = read("apps/storefront/components/storefront-home.tsx");
  const detail = read("apps/storefront/components/product-detail.tsx");
  const policy = read("apps/storefront/app/[locale]/policies/[policy]/page.tsx");

  assert.match(
    localeLayout,
    /<SiteShell locale=\{locale\} initialConfig=\{config\}>\{children\}<\/SiteShell>/u,
  );
  assert.doesNotMatch(home, /<SiteShell/u);
  assert.doesNotMatch(detail, /<SiteShell/u);
  assert.doesNotMatch(policy, /<SiteShell/u);
  assert.match(localeLayout, /title:\s*\{\s*absolute:/u);
  for (const file of [
    "apps/storefront/app/[locale]/loading.tsx",
    "apps/storefront/app/[locale]/error.tsx",
    "apps/storefront/app/[locale]/template.tsx",
    "apps/storefront/app/global-error.tsx",
  ]) {
    assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true, `${file} should exist`);
  }
});

test("正式客户端保留筛选上下文并让订单重试复用幂等键", () => {
  const home = read("apps/storefront/components/storefront-home.tsx");
  const detail = read("apps/storefront/components/product-detail.tsx");
  const provider = read("apps/storefront/components/experience-provider.tsx");

  assert.match(home, /window\.history\.replaceState/u);
  assert.match(home, /rememberListing/u);
  assert.match(home, /prefetch=\{false\}/u);
  assert.match(home, /const inFlightKey = useRef\(""\)/u);
  assert.match(home, /if \(lastLoadedKey\.current === key \|\| inFlightKey\.current === key\)/u);
  assert.match(home, /if \(!controller\.signal\.aborted\) lastLoadedKey\.current = key/u);
  assert.match(detail, /draft\.idempotencyKey \?\? crypto\.randomUUID\(\)/u);
  assert.match(detail, /updateOrderDraft\(slug, \{ idempotencyKey \}\)/u);
  assert.doesNotMatch(provider, /sessionStorage\.(?:setItem|getItem)\([^)]*contact/iu);
  assert.match(provider, /cloudbridge-storefront-currency/u);
});

test("正式客户端商品卡片与详情标题不显示分类或 kicker 微标签", () => {
  const home = read("apps/storefront/components/storefront-home.tsx");
  const detail = read("apps/storefront/components/product-detail.tsx");

  assert.doesNotMatch(home, /\{product\.kicker\}/u);
  assert.doesNotMatch(home, /<span>\{t\.serviceLabel\}<\/span>/u);
  assert.doesNotMatch(detail, /\{product\.kicker\}/u);
  assert.doesNotMatch(detail, /\{product\.category\.name\}/u);
});

test("正式客户端刷新公开配置、恢复订单冲突并保持移动端卡片节奏", () => {
  const shell = read("apps/storefront/components/site-shell.tsx");
  const detail = read("apps/storefront/components/product-detail.tsx");
  const home = read("apps/storefront/components/storefront-home.tsx");
  const css = read("apps/storefront/app/globals.css");

  assert.match(shell, /getConfig\(locale, controller\.signal\)/u);
  assert.match(shell, /setConfig\(null\)/u);
  assert.match(shell, /settings\?\.supportEnabled === true/u);
  assert.match(shell, /settings\?\.transitServiceEnabled === true/u);
  assert.match(shell, /initialConfig=\{config\}/u);
  assert.match(shell, /transit-service-notice\$\{isProductDetail \? " is-detail"/u);
  assert.match(shell, /\{children\}[\s\S]*?transit-service-entry[\s\S]*?\{!isProductDetail && \(/u);
  assert.match(detail, /resolveOrderAvailability\(config\) !== "available"/u);
  assert.match(detail, /error instanceof ApiRequestError && error\.status === 409/u);
  assert.match(detail, /Promise\.all\(\[\s*getConfig\(locale\),\s*getProduct\(slug, locale, currency\)/u);
  assert.match(detail, /contactChannelsUnavailableBody/u);
  assert.match(home, /className="product-purchase"/u);
  assert.match(css, /\.product-copy \{[^}]*grid-template-rows:\s*52px 68px 72px;/u);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?\.product-copy \{ grid-template-rows:\s*40px 68px 72px;/u);
  assert.match(css, /\.product-purchase \{[^}]*height:\s*72px;/u);
  assert.match(css, /\.transit-service-notice\.is-detail/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.transit-service-entry:not\(\.is-detail\) \{ position: relative;[^}]*right: auto;[^}]*bottom: auto;/u);
  assert.match(css, /\.brand \{[^}]*min-width:\s*0;/u);
  assert.match(css, /\.brand strong \{[^}]*text-overflow:\s*ellipsis;/u);
});

test("遗留后台登录入口首屏直接挂载且关键控制具备 44px 点击目标", () => {
  const app = read("src/App.jsx");
  const home = read("apps/storefront/components/storefront-home.tsx");
  const legacyCss = read("src/styles.css");
  const storefrontCss = read("apps/storefront/app/globals.css");
  const adminCss = read("apps/admin/src/styles.css");

  assert.match(app, /import AdminAuthFlow from "\.\/AdminAuthFlow\.jsx"/u);
  assert.doesNotMatch(app, /lazy\(\(\) => import\("\.\/AdminAuthFlow\.jsx"\)\)/u);
  assert.match(app, /className="hero-mobile-dots"/u);
  assert.match(app, /heroes\.map\(\(item, dotIndex\)/u);
  assert.match(legacyCss, /\.hero-arrows \.icon-button\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
  assert.match(legacyCss, /@media \(max-width: 760px\)[\s\S]*?\.hero-controls \{ display: none; \}[\s\S]*?\.hero-mobile-dots\s*\{/u);
  assert.match(legacyCss, /\.hero-mobile-dots i\.is-active\s*\{/u);
  assert.match(legacyCss, /\.admin-workspace-tab__sort-handle,\s*\.admin-workspace-tab__close\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
  assert.match(home, /className="hero-dots"/u);
  assert.doesNotMatch(home, /className="hero-controls"/u);
  assert.match(home, /onTouchStart=/u);
  assert.match(home, /onPointerDown=/u);
  assert.match(storefrontCss, /\.hero-dots button \{ width: 44px; height: 44px;/u);
  assert.match(storefrontCss, /\.hero-dots button::before/u);
  assert.match(storefrontCss, /@media \(max-width: 390px\)[\s\S]*?\.language-switch button \{ min-width: 44px;/u);
  assert.doesNotMatch(storefrontCss, /\.hero-controls/u);
  assert.match(storefrontCss, /\.footer-links > a,\s*\.footer-links > button \{[^}]*min-height:\s*44px;/u);
  assert.match(adminCss, /\.auth-links button \{ min-height: 44px;/u);
  assert.match(adminCss, /\.admin-toast button\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
});

test("正式客户端恢复可访问币种菜单、客服抽屉、旧版编辑式页脚和固定订单操作栏", () => {
  const controls = read("apps/storefront/components/storefront-controls.tsx");
  const shell = read("apps/storefront/components/site-shell.tsx");
  const detail = read("apps/storefront/components/product-detail.tsx");
  const storefrontCss = read("apps/storefront/app/globals.css");

  assert.match(controls, /role="combobox"/u);
  assert.match(controls, /role="listbox"/u);
  assert.match(controls, /event\.key === "Home" \|\| event\.key === "End"/u);
  assert.match(controls, /event\.key === "Escape"/u);
  assert.match(controls, /aria-modal="true"/u);
  assert.match(controls, /document\.body\.style\.overflow = "hidden"/u);
  assert.match(controls, /returnFocusRef\.current\?\.focus\(\)/u);
  assert.match(shell, /aria-label=\{t\.navSupport\}[\s\S]*?className="support-trigger"/u);
  assert.match(shell, /<SupportDrawer[\s\S]*?initialConfig=\{config\}[\s\S]*?locale=\{locale\}/u);
  assert.match(shell, /const isProductDetail = pathname\.startsWith\(`\/\$\{locale\}\/products\/`\)/u);
  assert.match(shell, /\{!isProductDetail && \(/u);
  assert.match(shell, /className="footer-links"/u);
  assert.match(shell, /className="footer-legal"/u);
  assert.match(detail, /className="order-action-dock"/u);
  assert.match(storefrontCss, /\.currency-picker__menu > button \{[^}]*min-height:\s*54px;/u);
  assert.match(storefrontCss, /@media \(max-width: 760px\)[\s\S]*\.site-footer \{ min-height: 0; grid-template-columns: 1fr; grid-template-rows: auto; \}/u);
  assert.match(storefrontCss, /\.order-action-dock \{ position: fixed;/u);
  assert.doesNotMatch(storefrontCss, /\.order-action-dock \{ position: sticky;/u);
  assert.match(storefrontCss, /\.detail-page \{[^}]*padding-bottom:\s*calc\(118px \+ env\(safe-area-inset-bottom\)\);/u);
  assert.match(storefrontCss, /\.route-frame \{ animation: route-enter 180ms cubic-bezier\(\.2,0,0,1\); \}/u);
});

test("正式后台页面按路由懒加载并使用三十秒会话缓存", () => {
  const app = read("apps/admin/src/App.tsx");
  const model = read("apps/admin/src/admin-model.ts");
  const experience = read("apps/admin/src/admin-experience.tsx");

  for (const page of ["dashboard", "products", "categories", "orders", "currencies", "security"]) {
    assert.match(app, new RegExp(`lazy\\(\\(\\) => import\\("\\./pages/${page}-page"\\)\\)`, "u"));
  }
  assert.match(app, /lazy\(\(\) => import\("\.\/pages\/audit-page"\)\)/u);
  assert.match(app, /lazy\(\(\) => import\("\.\/features\/integrations\/integration-readiness-page"\)\)/u);
  assert.doesNotMatch(app, /design-preview-page|DesignPreviewPage/u);
  assert.match(app, /window\.history\[[^\]]+\]\(\{ page: next \}, "", pagePath\(next\)\)/u);
  assert.match(app, /popstate/u);
  assert.match(read("apps/admin/src/styles.css"), /@media \(max-width: 440px\)[\s\S]*?\.dashboard-boundary-panel \.panel-heading \{ align-items: stretch; flex-direction: column; \}/u);
  assert.match(model, /if \(candidate === "audit"\) return "logs"/u);
  assert.match(model, /cacheTtlMs:\s*30_000/u);
  assert.match(experience, /resourceCache/u);
  assert.match(experience, /return \{ data, state, error, reload:/u);
});

test("正式后台弹窗具备焦点锁定、Escape 和焦点返回", () => {
  const ui = read("apps/admin/src/admin-ui.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(ui, /event\.key === "Escape"/u);
  assert.match(ui, /event\.key !== "Tab"/u);
  assert.match(ui, /previousFocus\?\.focus\(\)/u);
  assert.match(ui, /document\.body\.style\.overflow = "hidden"/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /\.row-action\s*\{\s*width:\s*44px;\s*height:\s*44px;/u);
});

test("正式后台只保留密码登录和可开关的 TOTP 双重验证", () => {
  const app = read("apps/admin/src/App.tsx");
  const api = read("apps/admin/src/api.ts");
  const security = read("apps/admin/src/pages/security-page.tsx");

  assert.match(app, /loginWithPassword\(email, password\)/u);
  assert.match(app, /completeTotpLogin\(flowId, token\)/u);
  assert.match(app, /"current-password"/u);
  assert.match(app, /className="auth-brand"[\s\S]*?src="\/assets\/cloudbridge-logo\.png"/u);
  assert.match(api, /\/admin\/auth\/totp\/disable/u);
  assert.match(security, /user\.totpEnabled/u);
  assert.match(security, /disableTotp\(password\)/u);
  assert.doesNotMatch(`${app}\n${api}\n${security}`, /Passkey|Fingerprint|WebAuthn|recoveryCodes|bootstrapToken/iu);
});

test("正式后台使用可展开的任务分组并自动定位当前二级入口", () => {
  const app = read("apps/admin/src/App.tsx");
  const model = read("apps/admin/src/admin-model.ts");
  const css = read("apps/admin/src/styles.css");

  assert.match(model, /kind:\s*"link",\s*id:\s*"dashboard"/u);
  assert.match(model, /id:\s*"catalog-management"[\s\S]*?items:\s*\["products",\s*"categories"\]/u);
  assert.match(model, /id:\s*"content-storefront"[\s\S]*?items:\s*\["banners",\s*"media",\s*"translations"\]/u);
  assert.match(model, /id:\s*"systems-operations"[\s\S]*?items:\s*\["logs",\s*"backups",\s*"integrations",\s*"settings"\]/u);
  assert.match(model, /findAdminNavigationGroup\(page/u);
  assert.match(model, /currentGroupId === nextGroupId \? null : nextGroupId/u);
  assert.match(app, /aria-expanded=\{isExpanded\}/u);
  assert.match(app, /setExpandedGroup\(findAdminNavigationGroup\(page\)\?\.id \?\? null\)/u);
  assert.match(app, /className="admin-nav-children"/u);
  assert.match(css, /\.admin-nav-group\.is-expanded \.admin-nav-caret/u);
  assert.match(css, /\.admin-nav-child\s*\{\s*min-height:\s*44px;/u);
});

test("正式后台24个页面均为真实或明确受限页面且不再保留独立设计预览", () => {
  const model = read("apps/admin/src/admin-model.ts");
  const app = read("apps/admin/src/App.tsx");
  const pagesBlock = model.match(/export const ADMIN_PAGES:[\s\S]*?= \[([\s\S]*?)\];/u)?.[1] ?? "";
  const pageIds = [...pagesBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);

  assert.equal(pageIds.length, 24);
  assert.equal(new Set(pageIds).size, 24);
  assert.equal(existsSync(new URL("../apps/admin/src/pages/design-preview-page.tsx", import.meta.url)), false);
  assert.doesNotMatch(app, /design-preview-page|DesignPreviewPage/u);
  assert.match(app, /page === "integrations"[\s\S]*?<IntegrationReadinessPage/u);
  assert.match(app, /const unhandledPage:\s*never = page/u);
});

test("遗留客户端移动端下单弹窗保持水平居中和对称安全边距", () => {
  const css = read("src/styles.css");

  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.buy-dialog\s*\{\s*width:\s*min\(560px,\s*calc\(100vw - 24px\)\);\s*margin-inline:\s*auto;/u,
  );
});
