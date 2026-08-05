import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copy } from "../lib/copy.js";

const read = (file: string) => readFileSync(
  new URL(`../${file}`, import.meta.url),
  "utf8",
);

test("the header always exposes truthful customer support", () => {
  const shell = read("components/site-shell.tsx");
  const provider = read("components/experience-provider.tsx");

  assert.match(shell, /className="support-trigger"/u);
  assert.match(
    shell,
    /<div className="header-utilities">[\s\S]*?className="theme-toggle"[\s\S]*?<LanguagePicker[\s\S]*?\/>\s*<button[\s\S]*?className="support-trigger"/u,
  );
  assert.doesNotMatch(
    shell,
    /\{supportEnabled && \(\s*<button[\s\S]*?className="support-trigger"/u,
  );
  assert.doesNotMatch(
    shell,
    /\{supportEnabled && \(\s*<SupportDrawer/u,
  );
  assert.match(provider, /supportOpen: boolean/u);
  assert.match(provider, /openSupport: \(\) => void/u);
  assert.match(provider, /closeSupport: \(\) => void/u);
  assert.match(shell, /const \{ closeSupport, openSupport, supportOpen \} = useExperience\(\)/u);
  assert.match(shell, /className="support-trigger"[\s\S]*?onClick=\{openSupport\}/u);
  assert.match(shell, /<SupportDrawer[\s\S]*?onClose=\{closeSupport\}[\s\S]*?open=\{supportOpen\}/u);
  assert.equal(copy.zh.customerSupport, "客户服务");
  assert.equal(copy.en.customerSupport, "Customer Support");
  assert.equal(copy.zh.supportUnavailableTitle, "客服暂未开放");
  assert.equal(
    copy.en.supportUnavailableTitle,
    "Customer support is not available yet",
  );
});

test("the header exposes only real destinations and a manual-order catalog action", () => {
  const shell = read("components/site-shell.tsx");
  const header = shell.slice(
    shell.indexOf('<header className="site-header">'),
    shell.indexOf("</header>"),
  );

  assert.match(
    header,
    /t\.navHome[\s\S]*?t\.navCatalog[\s\S]*?policies\/terms[\s\S]*?t\.navTerms[\s\S]*?policies\/privacy[\s\S]*?t\.navPrivacy/u,
  );
  assert.match(header, /aria-current=\{isHome \? "page" : undefined\}/u);
  assert.match(header, /className="header-order-link"[\s\S]*?t\.manualOrder/u);
  assert.doesNotMatch(header, /cart|basket|购物车|购物篮/iu);
  assert.doesNotMatch(header, /brandSecondary/u);
  assert.equal(copy.zh.navHome, "首页");
  assert.equal(copy.zh.navCatalog, "服务目录");
  assert.equal(copy.zh.navTerms, "条款");
  assert.equal(copy.zh.navPrivacy, "隐私");
  assert.equal(copy.zh.manualOrder, "人工下单");
  assert.equal(copy.en.manualOrder, "Order with support");
});

test("QQ support uses a best-effort app handoff with a visible copy fallback", () => {
  const controls = read("components/storefront-controls.tsx");

  assert.match(
    controls,
    /onClick=\{channel\.type === "QQ" \? handleQqLaunch : undefined\}/u,
  );
  assert.match(controls, /尝试打开 QQ/u);
  assert.match(controls, /Try to open QQ/u);
  assert.match(controls, /如果 QQ 没有打开/u);
  assert.match(controls, /If QQ did not open/u);
  assert.match(controls, /setQqFallbackVisible\(true\)/u);
  assert.match(controls, /copyAccount\(channel\)/u);
  assert.doesNotMatch(controls, /QQ (?:已打开|opened successfully)/u);
});

test("the footer keeps four stable entries and opens truthful contact support last", () => {
  const shell = read("components/site-shell.tsx");
  const footer = shell.slice(
    shell.indexOf('className="footer-links"'),
    shell.indexOf("</nav>", shell.indexOf('className="footer-links"')),
  );

  assert.match(
    footer,
    /t\.navServices[\s\S]*?policies\/terms[\s\S]*?t\.terms[\s\S]*?policies\/privacy[\s\S]*?t\.privacy[\s\S]*?<button[\s\S]*?t\.navSupport/u,
  );
  assert.doesNotMatch(footer, /\{supportEnabled &&/u);
  assert.equal(copy.zh.navSupport, "联系我们");
  assert.equal(copy.en.navSupport, "Contact us");
});

test("the language control is one compact direct toggle", () => {
  const controls = read("components/storefront-controls.tsx");
  const shell = read("components/site-shell.tsx");
  const styles = read("app/globals.css");

  assert.match(controls, /export function LanguagePicker/u);
  assert.match(controls, /visibleLabel = value === "zh" \? "中" : "EN"/u);
  assert.match(controls, /nextLocale: Locale = value === "zh" \? "en" : "zh"/u);
  assert.match(controls, /className="language-picker"/u);
  assert.doesNotMatch(controls, /languageOptions/u);
  assert.doesNotMatch(controls, /language-picker__menu/u);
  assert.match(shell, /<LanguagePicker/u);
  assert.match(shell, /window\.location\.assign\(target\)/u);
  assert.match(shell, /searchParams\.toString\(\)/u);
  assert.doesNotMatch(shell, /router\.replace\(/u);
  assert.doesNotMatch(shell, /className="language-switch"/u);
  assert.match(
    styles,
    /\.theme-toggle, \.language-picker \{ width: 48px; height: 48px;[\s\S]*?@media \(max-width: 760px\)[\s\S]*?\.theme-toggle, \.language-picker \{ width: 44px; height: 44px;/u,
  );
  assert.doesNotMatch(styles, /\.language-picker__trigger/u);
});

test("the storefront theme is persistent, prepaint-safe, and fully localized", () => {
  const layout = read("app/layout.tsx");
  const shell = read("components/site-shell.tsx");
  const styles = read("app/globals.css");
  const theme = read("lib/theme.ts");

  assert.match(theme, /cloudbridge-storefront-theme/u);
  assert.match(theme, /DEFAULT_STOREFRONT_THEME: StorefrontTheme = "dark"/u);
  assert.match(layout, /data-theme=\{DEFAULT_STOREFRONT_THEME\}/u);
  assert.match(layout, /suppressHydrationWarning/u);
  assert.match(layout, /window\.localStorage\.getItem/u);
  assert.match(layout, /document\.documentElement\.dataset\.theme=theme/u);
  assert.match(shell, /className="theme-toggle"/u);
  assert.match(shell, /window\.localStorage\.setItem\(STOREFRONT_THEME_STORAGE_KEY, nextTheme\)/u);
  assert.match(shell, /document\.documentElement\.style\.colorScheme = nextTheme/u);
  assert.match(styles, /:root\[data-theme="light"\]/u);
  assert.match(styles, /html\[data-theme="light"\] \.product-card/u);
  assert.match(styles, /html\[data-theme="light"\] \.order-action-dock/u);
  assert.match(styles, /html\[data-theme="light"\] \.support-drawer/u);
  assert.equal(copy.zh.switchToLightTheme, "切换到浅色模式");
  assert.equal(copy.en.switchToDarkTheme, "Switch to dark theme");
});

test("currency controls render only the locale-specific currency name", () => {
  const controls = read("components/storefront-controls.tsx");

  assert.match(
    controls,
    /<strong>\{activeCurrency\?\.name \?\? ariaLabel\}<\/strong>/u,
  );
  assert.match(
    controls,
    /<span><strong>\{currency\.name\}<\/strong><\/span>/u,
  );
  assert.doesNotMatch(
    controls,
    /<strong>\{activeCurrency\?\.code/u,
  );
  assert.doesNotMatch(
    controls,
    /<strong>\{currency\.code\}<\/strong>/u,
  );
});

test("rounded storefront frames use real borders without simulated padding", () => {
  const styles = read("app/globals.css");

  assert.match(styles, /--frame-line:\s*rgba\(128,\s*218,\s*239,\s*0\.42\);/u);
  assert.match(styles, /--frame-line-soft:\s*rgba\(157,\s*201,\s*228,\s*0\.24\);/u);
  assert.match(
    styles,
    /\.capability-rail \{[^}]*gap:\s*1px;[^}]*padding:\s*0;[^}]*border:\s*1px solid var\(--frame-line\);[^}]*border-radius:\s*18px;[^}]*background:\s*var\(--line-strong\);[^}]*background-clip:\s*padding-box;/u,
  );
  assert.doesNotMatch(
    styles,
    /\.capability-rail \{[^}]*padding:\s*1px;/u,
  );
  assert.match(
    styles,
    /@media \(max-width: 760px\)[\s\S]*?\.capability-rail \{[^}]*grid-template-columns:\s*round\(down,\s*calc\(\(100% - 1px\) \/ 2\),\s*1px\)\s+minmax\(0,\s*1fr\);/u,
  );

  for (const selector of [
    ".hero-card, .hero-skeleton",
    ".search-frame",
    ".currency-picker__trigger",
    ".product-card",
    ".detail-visual",
    ".order-panel, .order-success",
    ".policy-grid",
    ".support-channel-list article",
  ]) {
    assert.match(
      styles,
      new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")} \\{[^}]*background-clip:\\s*padding-box;`, "u"),
    );
  }
});
