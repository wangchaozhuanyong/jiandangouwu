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

  assert.match(controls, /value:\s*"zh",\s*label:\s*"中文"/u);
  assert.match(controls, /value:\s*"en",\s*label:\s*"English"/u);
  assert.match(controls, /export function LanguagePicker/u);
  assert.match(shell, /<LanguagePicker/u);
  assert.match(shell, /window\.location\.assign\(target\)/u);
  assert.match(shell, /searchParams\.toString\(\)/u);
  assert.doesNotMatch(shell, /router\.replace\(/u);
  assert.doesNotMatch(shell, /className="language-switch"/u);
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
