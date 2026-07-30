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
  const copy = read("apps/storefront/lib/copy.ts");

  assert.doesNotMatch(home, /\{product\.kicker\}/u);
  assert.doesNotMatch(home, /<span>\{t\.serviceLabel\}<\/span>/u);
  assert.doesNotMatch(detail, /\{product\.kicker\}/u);
  assert.doesNotMatch(detail, /\{product\.category\.name\}/u);
  assert.match(copy, /available: "现货"/u);
  assert.match(copy, /available: "Available"/u);
  assert.doesNotMatch(copy, /available: "可下单"/u);
  assert.match(home, /STOREFRONT_LOW_STOCK_MAX/u);
  assert.equal(
    home.match(/stockQuantity <= STOREFRONT_LOW_STOCK_MAX/gu)?.length,
    2,
    "商品库存文案与风险样式必须复用共享低库存阈值",
  );
  assert.doesNotMatch(home, /stockQuantity <= 3/u);
});

test("正式客户端商品区标题在所有视口保持左主标题右副标题", () => {
  const home = read("apps/storefront/components/storefront-home.tsx");
  const css = read("apps/storefront/app/globals.css");

  assert.match(
    home,
    /className="catalog-heading"[\s\S]*?<h2>\{t\.catalogTitle\}<\/h2>[\s\S]*?<p>\{t\.catalogSubtitle\}<\/p>/u,
  );
  assert.match(
    css,
    /\.catalog-heading \{ display: grid; grid-template-columns: auto 1px minmax\(300px, 490px\); align-items: stretch;/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.catalog-heading \{\s*grid-template-columns: minmax\(0, 1fr\) 1px minmax\(190px, \.82fr\);\s*align-items: stretch;/u,
  );
  assert.match(
    css,
    /@media \(max-width: 390px\)[\s\S]*?\.catalog-heading \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\s*align-items: stretch;/u,
  );
  assert.doesNotMatch(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.catalog-heading \{ display: block; \}/u,
  );
});

test("正式客户端刷新公开配置、恢复订单冲突并保持移动端卡片节奏", () => {
  const shell = read("apps/storefront/components/site-shell.tsx");
  const detail = read("apps/storefront/components/product-detail.tsx");
  const home = read("apps/storefront/components/storefront-home.tsx");
  const css = read("apps/storefront/app/globals.css");

  assert.match(shell, /getConfig\(locale, controller\.signal\)/u);
  assert.match(shell, /setConfig\(null\)/u);
  assert.match(shell, /settings\?\.transitServiceEnabled === true/u);
  assert.match(shell, /initialConfig=\{config\}/u);
  assert.match(shell, /t\.navServices[\s\S]*?t\.terms[\s\S]*?t\.privacy[\s\S]*?<button[\s\S]*?t\.navSupport/u);
  assert.doesNotMatch(shell, /\{supportEnabled && \([\s\S]*?t\.navSupport/u);
  assert.match(shell, /const isHome = pathname === `\/\$\{locale\}` \|\| pathname === `\/\$\{locale\}\/`/u);
  assert.match(shell, /\{children\}[\s\S]*?\{isHome && transitEnabled && \([\s\S]*?className="transit-service-entry"[\s\S]*?\{!isProductDetail && \(/u);
  assert.match(shell, /if \(!transitEnabled \|\| !isHome\) setTransitNotice\(""\)/u);
  assert.doesNotMatch(shell, /transit-service-entry\$\{isProductDetail/u);
  assert.match(detail, /resolveOrderAvailability\(config\) !== "available"/u);
  assert.match(detail, /error instanceof ApiRequestError && error\.status === 409/u);
  assert.match(detail, /Promise\.all\(\[\s*getConfig\(locale\),\s*getProduct\(slug, locale, currency\)/u);
  assert.match(detail, /contactChannelsUnavailableBody/u);
  assert.match(home, /className="product-purchase"/u);
  assert.match(css, /\.product-copy \{[^}]*grid-template-rows:\s*52px 68px 72px;/u);
  assert.match(css, /@media \(max-width: 390px\)[\s\S]*?\.product-copy \{ grid-template-rows:\s*40px 68px 72px;/u);
  assert.match(css, /\.product-purchase \{[^}]*height:\s*72px;/u);
  assert.match(css, /\.transit-service-entry \{[^}]*position:\s*fixed;/u);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.transit-service-entry \{ right:\s*12px;[^}]*bottom:\s*max\(12px,\s*env\(safe-area-inset-bottom\)\);/u);
  assert.doesNotMatch(css, /\.transit-service-(?:entry|notice)\.is-detail/u);
  assert.doesNotMatch(css, /\.transit-service-entry(?::not\([^)]*\))? \{[^}]*position:\s*relative;/u);
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
  assert.match(storefrontCss, /\.theme-toggle, \.language-picker \{ width: 48px; height: 48px;/u);
  assert.match(storefrontCss, /@media \(max-width: 760px\)[\s\S]*?\.theme-toggle, \.language-picker \{ width: 44px; height: 44px;/u);
  assert.doesNotMatch(storefrontCss, /\.language-picker__trigger/u);
  assert.match(storefrontCss, /\.capability-rail \{[^}]*padding:\s*0;[^}]*border:\s*1px solid var\(--frame-line\);/u);
  assert.doesNotMatch(storefrontCss, /\.capability-rail \{[^}]*padding:\s*1px;/u);
  assert.match(storefrontCss, /@media \(max-width: 760px\)[\s\S]*?\.capability-rail \{[^}]*grid-template-columns:\s*round\(down,\s*calc\(\(100% - 1px\) \/ 2\),\s*1px\)\s+minmax\(0,\s*1fr\);/u);
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
  assert.match(controls, /export function LanguagePicker/u);
  assert.match(controls, /<strong>\{activeCurrency\?\.name \?\? ariaLabel\}<\/strong>/u);
  assert.match(controls, /<span><strong>\{currency\.name\}<\/strong><\/span>/u);
  assert.doesNotMatch(controls, /<strong>\{activeCurrency\?\.code/u);
  assert.doesNotMatch(controls, /<strong>\{currency\.code\}<\/strong>/u);
  assert.match(controls, /event\.key === "Home" \|\| event\.key === "End"/u);
  assert.match(controls, /event\.key === "Escape"/u);
  assert.match(controls, /aria-modal="true"/u);
  assert.match(controls, /document\.body\.style\.overflow = "hidden"/u);
  assert.match(controls, /returnFocusRef\.current\?\.focus\(\)/u);
  assert.match(shell, /aria-label=\{t\.customerSupport\}[\s\S]*?className="support-trigger"/u);
  assert.doesNotMatch(shell, /\{supportEnabled && \(\s*<button[\s\S]*?className="support-trigger"/u);
  assert.doesNotMatch(shell, /\{supportEnabled && \(\s*<SupportDrawer/u);
  assert.match(shell, /<LanguagePicker/u);
  assert.doesNotMatch(shell, /className="language-switch"/u);
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

test("正式后台使用舒适字号层级并让工作区铺满可用宽度", () => {
  const css = read("apps/admin/src/styles.css");

  assert.match(css, /--admin-font-caption:\s*12px;/u);
  assert.match(css, /--admin-font-meta:\s*13px;/u);
  assert.match(css, /--admin-font-body:\s*14px;/u);
  assert.match(css, /--admin-font-nav:\s*14px;/u);
  assert.match(css, /--admin-font-nav-child:\s*13px;/u);
  assert.match(css, /--admin-font-table:\s*13px;/u);
  assert.match(css, /--admin-font-section-title:\s*20px;/u);
  assert.match(css, /--admin-font-page-title:\s*28px;/u);
  assert.match(css, /--admin-font-page-title-mobile:\s*22px;/u);
  assert.doesNotMatch(css, /font-size:\s*(?:[0-9](?:\.\d+)?|1[01](?:\.\d+)?)px;/u);
  assert.match(
    css,
    /\.admin-surface\.admin-surface button,[\s\S]*?\.admin-surface\.admin-surface textarea \{\s*font-size: var\(--admin-font-body\);\s*\}/u,
  );
  assert.match(
    css,
    /\.editor-form input, \.editor-form select, \.editor-form textarea \{[^}]*min-height:\s*44px;/u,
  );
  assert.match(css, /\.admin-surface\.admin-surface h2 \{\s*font-size: var\(--admin-font-section-title\);/u);
  assert.match(
    css,
    /\.admin-surface\.admin-surface table th,[\s\S]*?\.admin-surface\.admin-surface table td \{\s*font-size: var\(--admin-font-table\);/u,
  );
  assert.match(css, /\.admin-shell\s*\{[^}]*grid-template-columns:\s*264px minmax\(0,\s*1fr\);/u);
  assert.match(css, /\.admin-topbar\s*\{[^}]*padding:\s*0 var\(--admin-content-gutter\);/u);
  assert.match(
    css,
    /\.admin-content\s*\{[^}]*width:\s*auto;[^}]*margin:\s*clamp\(24px,\s*3\.5vw,\s*46px\) var\(--admin-content-gutter\) max\(70px,\s*env\(safe-area-inset-bottom\)\);/u,
  );
  assert.doesNotMatch(css, /\.admin-content\s*\{[^}]*min\(1400px/u);
  assert.match(
    css,
    /@media \(max-width: 1500px\)\s*\{\s*\.product-admin-grid \{ grid-template-columns: repeat\(2,1fr\); \}\s*\}/u,
  );
  assert.match(css, /\.order-record-table \{[^}]*min-width:\s*2100px;/u);
  assert.match(css, /\.audit-log-table \{[^}]*min-width:\s*1960px;/u);
  assert.match(css, /\.audit-log-table-wrap \{[^}]*overflow-x:\s*auto;/u);
  assert.match(
    css,
    /\.audit-log-table th:first-child, \.audit-log-table td:first-child \{[^}]*position:\s*sticky;/u,
  );
  assert.match(
    css,
    /\.audit-log-table th:last-child, \.audit-log-table td:last-child \{[^}]*position:\s*sticky;/u,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.admin-surface \{ --admin-content-gutter: 12px; \}[\s\S]*?\.admin-topbar h1 \{ font-size: var\(--admin-font-page-title-mobile\); \}[\s\S]*?\.admin-content \{ width: auto; margin: 18px var\(--admin-content-gutter\) max\(70px,\s*env\(safe-area-inset-bottom\)\); \}/u,
  );
  assert.doesNotMatch(css, /\.admin-topbar h1 \{[^}]*font-size:\s*20px;/u);
});

test("正式后台使用视口壳层、唯一工作区滚动和受控内容边界", () => {
  const app = read("apps/admin/src/App.tsx");
  const telegram = read("apps/admin/src/features/notifications/telegram-new-order-page.tsx");
  const css = read("apps/admin/src/styles.css");
  const agents = read("AGENTS.md");
  const interaction = read("docs/UX_INTERACTION_SYSTEM.md");
  const roadmap = read("docs/ROADMAP.md");

  assert.match(
    css,
    /\.admin-shell \{[^}]*height:\s*100vh;[^}]*height:\s*100dvh;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/u,
  );
  assert.match(
    css,
    /\.admin-shell > aside \{[^}]*min-height:\s*0;[^}]*height:\s*100%;[^}]*position:\s*relative;[^}]*overflow:\s*hidden;/u,
  );
  assert.match(
    css,
    /\.admin-main \{[^}]*min-width:\s*0;[^}]*min-height:\s*0;[^}]*height:\s*100%;[^}]*overflow-x:\s*clip;[^}]*overflow-y:\s*auto;/u,
  );
  assert.match(css, /\.admin-topbar \{[^}]*position:\s*sticky;[^}]*top:\s*0;/u);
  assert.match(css, /\.admin-content > \* \{ min-width: 0; max-width: 100%; \}/u);
  assert.match(css, /\.admin-panel \{ min-width: 0; max-width: 100%;/u);
  assert.match(css, /\.admin-panel > \* \{ min-width: 0; max-width: 100%; \}/u);
  assert.match(app, /const workspaceRef = useRef<HTMLElement>\(null\)/u);
  assert.match(app, /workspaceRef\.current\?\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/u);
  assert.match(app, /<section className="admin-main" ref=\{workspaceRef\}>/u);
  assert.doesNotMatch(app, /window\.scrollTo/u);

  assert.match(telegram, /className="admin-panel telegram-delivery-panel"/u);
  assert.match(telegram, /className="admin-table-shell"[\s\S]*?tabIndex=\{0\}/u);
  assert.match(css, /\.telegram-form-actions input \{[^}]*flex:\s*1 1 320px;/u);
  assert.match(css, /\.admin-table-shell \{[^}]*max-width:\s*100%;[^}]*overflow-x:\s*auto;/u);
  assert.match(css, /\.admin-table-shell table \{[^}]*width:\s*100%;[^}]*min-width:\s*820px;/u);
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.admin-table-shell th:first-child,[\s\S]*?position:\s*sticky;[\s\S]*?\.admin-table-shell th:last-child,[\s\S]*?position:\s*sticky;/u,
  );

  assert.match(agents, /viewport-owned application shell/u);
  assert.match(agents, /No route may create page-level horizontal overflow/u);
  assert.match(interaction, /唯一纵向工作区滚动容器/u);
  assert.match(interaction, /不得产生页面级横向溢出/u);
  assert.match(roadmap, /管理后台采用视口级壳层与唯一工作区滚动/u);
});

test("正式后台页面按路由懒加载并使用三十秒会话缓存", () => {
  const app = read("apps/admin/src/App.tsx");
  const model = read("apps/admin/src/admin-model.ts");
  const experience = read("apps/admin/src/admin-experience.tsx");

  for (const page of ["dashboard", "products", "categories", "orders", "currencies", "security"]) {
    assert.match(app, new RegExp(`lazy\\(\\(\\) => import\\("\\./pages/${page}-page"\\)\\)`, "u"));
  }
  assert.match(app, /lazy\(\(\) => import\("\.\/pages\/audit-page"\)\)/u);
  assert.match(app, /lazy\(\(\) => import\("\.\/features\/sites\/sites-platform-page"\)\)/u);
  assert.doesNotMatch(app, /design-preview-page|DesignPreviewPage/u);
  assert.match(app, /window\.history\[[^\]]+\]\(\{ page: next \}, "", pagePath\(next\)\)/u);
  assert.match(app, /popstate/u);
  assert.match(read("apps/admin/src/styles.css"), /@media \(max-width: 440px\)[\s\S]*?\.dashboard-boundary-panel \.panel-heading,[^}]*\.dashboard-inventory-panel \.panel-heading \{ align-items: stretch; flex-direction: column; \}/u);
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

test("正式后台使用统一的标题问号说明并保留可见状态反馈", () => {
  const app = read("apps/admin/src/App.tsx");
  const ui = read("apps/admin/src/admin-ui.tsx");
  const help = read("apps/admin/src/help-content.ts");
  const settings = read("apps/admin/src/features/settings/settings-page.tsx");
  const contacts = read("apps/admin/src/features/support/contacts-page.tsx");
  const css = read("apps/admin/src/styles.css");

  assert.match(app, /adminPageHelp\[page\]\[locale\]/u);
  assert.match(app, /className="admin-page-title"/u);
  assert.match(ui, /export function HelpTip/u);
  assert.match(ui, /aria-controls=\{panelId\}/u);
  assert.match(ui, /aria-expanded=\{open\}/u);
  assert.match(ui, /role="tooltip"/u);
  assert.match(ui, /document\.addEventListener\("keydown", closeFromKeyboard, true\)/u);
  assert.match(help, /satisfies Record<Page, LocalizedHelp>/u);
  assert.match(settings, /className="admin-section-title"/u);
  assert.match(settings, /className="admin-field-title"/u);
  assert.match(contacts, /mqqwpa:\/\/im\/chat\?chat_type=wpa&uin=/u);
  assert.match(contacts, /aria-invalid=\{Boolean\(targetError\)\}/u);
  assert.match(css, /\.admin-help-trigger \{ width: 44px; height: 44px;/u);
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.admin-help-popover \{[^}]*position: fixed;[^}]*left: 12px;[^}]*right: 12px;/u,
  );
  assert.match(settings, /role="status"/u);
  assert.match(contacts, /role="alert"/u);
});

test("正式后台只使用 Sites 的 ChatGPT 管理身份", () => {
  const app = read("apps/admin/src/App.tsx");
  const api = read("apps/admin/src/api.ts");
  const security = read("apps/admin/src/pages/security-page.tsx");

  assert.match(app, /<SitesAuthScreen/u);
  assert.match(app, /className="auth-brand"[\s\S]*?src="\/assets\/cloudbridge-logo\.png"/u);
  assert.match(app, /\/signin-with-chatgpt\?return_to=%2Fadmin/u);
  assert.match(api, /\/signout-with-chatgpt\?return_to=%2Fadmin/u);
  assert.match(security, /ChatGPT administrator sign-in/u);
  assert.doesNotMatch(
    `${app}\n${api}\n${security}`,
    /loginWithPassword|completeTotpLogin|getFirstAdminSetupStatus|setupFirstAdmin|PasswordSecurityPage|auth\/totp|auth\/sessions/iu,
  );
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

test("正式后台当前路由均为真实或明确受限页面且不再保留独立设计预览", () => {
  const model = read("apps/admin/src/admin-model.ts");
  const app = read("apps/admin/src/App.tsx");
  const pagesBlock = model.match(/export const ADMIN_PAGES:[\s\S]*?= \[([\s\S]*?)\];/u)?.[1] ?? "";
  const pageIds = [...pagesBlock.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);

  assert.equal(pageIds.length, 24);
  assert.equal(new Set(pageIds).size, 24);
  assert.equal(existsSync(new URL("../apps/admin/src/pages/design-preview-page.tsx", import.meta.url)), false);
  assert.doesNotMatch(app, /design-preview-page|DesignPreviewPage/u);
  assert.match(app, /page === "integrations"[\s\S]*?<SitesPlatformPage/u);
  assert.match(app, /const unhandledPage:\s*never = page/u);
});

test("遗留客户端移动端下单弹窗保持水平居中和对称安全边距", () => {
  const css = read("src/styles.css");

  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*?\.buy-dialog\s*\{\s*width:\s*min\(560px,\s*calc\(100vw - 24px\)\);\s*margin-inline:\s*auto;/u,
  );
});
