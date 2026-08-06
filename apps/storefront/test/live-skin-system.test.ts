import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const storefrontRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments: string[]) =>
  readFileSync(join(storefrontRoot, ...segments), "utf8");

test("formal live storefront owns a scoped dual-theme semantic skin", () => {
  const css = read("app", "globals.css");

  assert.match(css, /Formal storefront skin system/u);
  assert.match(css, /\.v2-live-shell\s*\{[\s\S]*?--cb-canvas:/u);
  assert.match(css, /\.v2-live-shell\s*\{[\s\S]*?--cb-action-primary:/u);
  assert.match(css, /\.v2-live-shell\s*\{[\s\S]*?--cb-action-secondary:/u);
  assert.match(css, /\.v2-live-shell\s*\{[\s\S]*?--cb-danger:/u);
  assert.match(
    css,
    /:root\[data-theme="light"\] \.v2-live-shell\s*\{[\s\S]*?--cb-canvas: #[a-f0-9]+;/u,
  );
  assert.match(css, /\.v2-live-shell \.v2-action--primary/u);
  assert.match(css, /\.v2-live-shell \.v2-action--secondary/u);
  assert.match(css, /\.v2-live-shell \.v2-action--tertiary/u);
  assert.match(css, /\.v2-live-shell \.v2-action--icon/u);
  assert.match(css, /\.v2-live-shell \.v2-action--danger/u);
  assert.match(css, /Transit remains the sole brand-seal exception/u);
});

test("conversion, utility, and destructive actions use stable visual semantics", () => {
  const shell = read("components", "v2-live", "live-shell.tsx");
  const catalog = read("components", "v2-live", "live-catalog.tsx");
  const commerce = read("components", "v2-live", "live-commerce.tsx");
  const skills = read("components", "v2-live", "live-skills.tsx");
  const detail = read("components", "product-detail.tsx");

  assert.match(shell, /v2-preview-icon-button v2-action v2-action--icon/u);
  assert.match(shell, /className="v2-preview-support-button"/u);
  assert.match(catalog, /v2-action v2-action--primary/u);
  assert.match(commerce, /v2-preview-cart__submit v2-action v2-action--primary/u);
  assert.match(commerce, /v2-action v2-action--danger/u);
  assert.match(skills, /v2-action v2-action--secondary/u);
  assert.match(detail, /order-submit v2-action v2-action--primary/u);
});
