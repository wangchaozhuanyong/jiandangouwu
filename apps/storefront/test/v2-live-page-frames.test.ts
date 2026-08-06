import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const storefrontRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (...segments: string[]) =>
  readFileSync(join(storefrontRoot, ...segments), "utf8");

test("formal live storefront surfaces share named page frames", () => {
  const frame = read("components", "v2-live", "page-frame.tsx");
  const shell = read("components", "v2-live", "live-shell.tsx");
  const catalog = read("components", "v2-live", "live-catalog.tsx");
  const commerce = read("components", "v2-live", "live-commerce.tsx");
  const skills = read("components", "v2-live", "live-skills.tsx");
  const policy = read("app", "[locale]", "policies", "[policy]", "page.tsx");
  const css = read("app", "globals.css");

  assert.match(frame, /export function V2HeroFrame/u);
  assert.match(frame, /"commerce"\s*\|\s*"operation"\s*\|\s*"reading"/u);
  assert.match(shell, /v2-preview-header v2-shell-frame/u);
  assert.match(shell, /v2-preview-footer v2-shell-frame/u);
  assert.match(shell, /v2-preview-stage v2-page-stage/u);
  assert.match(catalog, /<V2ContentFrame layout="commerce">/u);
  assert.match(catalog, /<V2HeroFrame>[\s\S]*?<LiveHero/u);
  assert.match(skills, /<V2ContentFrame layout="commerce">/u);
  assert.match(skills, /<V2HeroFrame>[\s\S]*?v2-preview-skills-intro/u);
  assert.match(skills, /<V2PageFrame className="v2-preview-skill-detail" layout="reading">/u);
  assert.match(
    commerce,
    /<V2PageFrame\s+className="v2-preview-cart-page(?:\s+v2-live-cart-page)?"\s+layout="commerce"\s*>/u,
  );
  assert.match(commerce, /<V2PageFrame className="v2-preview-lookup-page" layout="operation">/u);
  assert.match(policy, /v2-page-frame--reading/u);
  assert.match(css, /--v2-commerce-frame:\s*1280px/u);
  assert.match(css, /--v2-operation-frame:\s*1200px/u);
  assert.match(css, /--v2-reading-frame:\s*1040px/u);
  assert.match(
    css,
    /\.v2-live-shell \.v2-hero-frame\s*\{[\s\S]*?width:\s*min\(var\(--v2-commerce-frame\), calc\(100% - 48px\)\)/u,
  );
  assert.match(css, /\.v2-live-shell \.v2-shell-frame\s*\{[\s\S]*?width:\s*min\(1232px/u);
  assert.match(css, /@media \(max-width: 760px\)\s*\{[\s\S]*?--v2-page-gutter:\s*12px/u);
  assert.match(
    css,
    /\.v2-preview-shell:not\(\.v2-live-shell\) \.v2-preview-stage > \.v2-preview-page/u,
  );
});
