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

  assert.match(shell, /className="support-trigger"/u);
  assert.doesNotMatch(
    shell,
    /\{supportEnabled && \(\s*<button[\s\S]*?className="support-trigger"/u,
  );
  assert.doesNotMatch(
    shell,
    /\{supportEnabled && \(\s*<SupportDrawer/u,
  );
  assert.equal(copy.zh.customerSupport, "客户服务");
  assert.equal(copy.en.customerSupport, "Customer Support");
  assert.equal(copy.zh.supportUnavailableTitle, "客服暂未开放");
  assert.equal(
    copy.en.supportUnavailableTitle,
    "Customer support is not available yet",
  );
});

test("the language picker exposes only the current native-language label", () => {
  const controls = read("components/storefront-controls.tsx");
  const shell = read("components/site-shell.tsx");
  const styles = read("app/globals.css");

  assert.match(controls, /value:\s*"zh",\s*label:\s*"中文"/u);
  assert.match(controls, /value:\s*"en",\s*label:\s*"English"/u);
  assert.match(controls, /export function LanguagePicker/u);
  assert.match(shell, /<LanguagePicker/u);
  assert.match(shell, /window\.location\.assign\(target\)/u);
  assert.match(shell, /searchParams\.toString\(\)/u);
  assert.doesNotMatch(shell, /router\.replace\(/u);
  assert.doesNotMatch(shell, /className="language-switch"/u);
  assert.match(
    styles,
    /@media \(max-width: 760px\)[\s\S]*?\.language-picker \{ width: 128px; height: 44px; \}/u,
  );
  assert.match(
    styles,
    /@media \(max-width: 390px\)[\s\S]*?\.language-picker \{ width: 94px; \}[\s\S]*?\.language-picker__trigger > svg:first-child \{ display: none; \}/u,
  );
  assert.doesNotMatch(
    styles,
    /\.language-picker__trigger strong \{[^}]*text-overflow:\s*ellipsis;/u,
  );
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
