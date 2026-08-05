import assert from "node:assert/strict";
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  PREVIEW_HEROES,
  PREVIEW_NOTICE,
  PREVIEW_ORDER_LOOKUP,
  PREVIEW_PRIMARY_CATEGORIES,
  PREVIEW_PRODUCTS,
  PREVIEW_SECONDARY_CATEGORIES,
  PREVIEW_SKILL_CATEGORIES,
  PREVIEW_SKILLS,
} from "../lib/v2-preview-data";

const storefrontRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const routeRoot = join(storefrontRoot, "app", "preview", "v2", "[locale]");
const componentRoot = join(storefrontRoot, "components", "v2-preview");
const fixtureFile = join(storefrontRoot, "lib", "v2-preview-data.ts");

type SourceFile = {
  path: string;
  source: string;
};

const listSourceFiles = (directory: string): SourceFile[] => {
  assert.equal(
    existsSync(directory),
    true,
    `missing agreed V2 preview directory: ${relative(storefrontRoot, directory)}`,
  );

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    if (!/\.(?:ts|tsx|js|jsx)$/u.test(entry.name)) return [];
    return [{ path, source: readFileSync(path, "utf8") }];
  });
};

const readPreviewSources = () => {
  const files = [
    ...listSourceFiles(routeRoot),
    ...listSourceFiles(componentRoot),
  ];
  assert.equal(existsSync(fixtureFile), true, "missing lib/v2-preview-data.ts");
  files.push({ path: fixtureFile, source: readFileSync(fixtureFile, "utf8") });
  return files;
};

const combinedSource = (files: SourceFile[]) => files
  .map((file) => `// ${relative(storefrontRoot, file.path)}\n${file.source}`)
  .join("\n");

test("storefront V2 preview is development-only and resolves to a production 404", () => {
  const routeFiles = listSourceFiles(routeRoot);
  const source = combinedSource(routeFiles);

  assert.match(source, /process\.env\.NODE_ENV/u);
  assert.match(
    source,
    /NODE_ENV\s*!==\s*["']development["']|NODE_ENV\s*===\s*["']production["']/u,
  );
  assert.match(source, /from\s+["']next\/navigation["']/u);
  assert.match(source, /notFound\s*\(\s*\)/u);
});

test("storefront V2 preview never imports order or admin mutations", () => {
  const source = combinedSource(readPreviewSources());

  assert.match(source, /import\s*\{\s*getConfig\s*\}\s*from\s*["'][^"']*\/lib\/api["']/u);
  for (const disallowedRead of ["getCategories", "getProducts", "getProduct", "getStorefrontHomeData"]) {
    assert.doesNotMatch(source, new RegExp(`\\b${disallowedRead}\\b`, "u"));
  }

  for (const forbidden of [
    /\bcreateOrder\b/u,
    /\bsubmitOrder\b/u,
    /\bupdateOrderStatus\b/u,
    /\buseMutation\b/u,
    /from\s+["'][^"']*\/product-detail["']/iu,
    /admin-api/iu,
    /["'`]\/v1\/(?:admin|orders)(?:[/?"'`]|$)/iu,
    /method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/iu,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test("storefront preview fixtures are unmistakably DEMO data with bilingual truth copy", () => {
  const files = readPreviewSources();
  const source = combinedSource(files);
  const fixtures = readFileSync(fixtureFile, "utf8");
  const ids = [...fixtures.matchAll(/\bid\s*:\s*["'`]([^"'`]+)["'`]/gu)]
    .map((match) => match[1] ?? "");

  assert.ok(ids.length > 0, "V2 storefront fixtures must declare stable IDs");
  assert.equal(
    ids.every((id) => id.startsWith("DEMO-")),
    true,
    `fixture IDs must start with DEMO-: ${ids.filter((id) => !id.startsWith("DEMO-")).join(", ")}`,
  );
  assert.match(source, /界面设计预览/u);
  assert.match(source, /Interface design preview/u);
});

test("preview fixtures keep complete bilingual copy and unique product surfaces", () => {
  const localizedValues = [
    PREVIEW_NOTICE,
    ...PREVIEW_HEROES.flatMap((item) => [item.title, item.eyebrow, item.body, item.action, item.imageAlt]),
    ...PREVIEW_PRODUCTS.flatMap((item) => [
      item.name,
      item.description,
      item.category,
      item.imageAlt,
      item.responseTime,
      ...item.notes.flatMap((note) => [note.title, note.body]),
    ]),
    ...PREVIEW_SKILLS.flatMap((item) => [
      item.summary,
      item.category,
      item.installHint,
      ...item.bestFor,
      ...item.notFor,
    ]),
    PREVIEW_ORDER_LOOKUP.productName,
    PREVIEW_ORDER_LOOKUP.status,
    PREVIEW_ORDER_LOOKUP.channel,
    PREVIEW_ORDER_LOOKUP.createdAt,
    PREVIEW_ORDER_LOOKUP.updatedAt,
  ];

  for (const value of localizedValues) {
    assert.ok(value.zh.trim(), "preview fixture is missing Chinese copy");
    assert.ok(value.en.trim(), "preview fixture is missing English copy");
  }
  for (const product of PREVIEW_PRODUCTS) {
    assert.equal(
      new Set(product.surfaces).size,
      product.surfaces.length,
      `${product.id} repeats a preview surface`,
    );
  }
});

test("storefront preview exposes the approved channel and order-lookup pages", () => {
  const source = combinedSource(readPreviewSources());
  const pageDirectories = [
    "",
    "transit-subscriptions",
    "ai-recharge",
    "skills",
    "cart",
    join("orders", "lookup"),
  ];

  for (const pageDirectory of pageDirectories) {
    const page = join(routeRoot, pageDirectory, "page.tsx");
    assert.equal(
      existsSync(page),
      true,
      `missing preview page: ${relative(storefrontRoot, page)}`,
    );
  }

  for (const route of ["transit-subscriptions", "ai-recharge", "skills", "cart", "orders/lookup"]) {
    assert.match(source, new RegExp(route, "u"));
  }
  for (const label of ["首页", "中转站订阅", "AI 软件代充", "Skill 推荐", "订单查询", "Home", "Order lookup"]) {
    assert.ok(source.includes(label), `missing bilingual preview navigation label: ${label}`);
  }
  assert.match(source, /Transit (?:Plans|subscriptions)/iu);
  assert.match(source, /AI (?:Software Recharge|recharge)/iu);
  assert.match(source, /Skill Picks/iu);
});

test("site navigation, product categories, and the DEMO cart stay separate", () => {
  const pages = readFileSync(join(componentRoot, "preview-pages.tsx"), "utf8");
  const shell = readFileSync(join(componentRoot, "preview-shell.tsx"), "utf8");
  const styles = readFileSync(join(storefrontRoot, "app", "globals.css"), "utf8");

  assert.match(pages, /className="v2-preview-catalog__toolbar"/u);
  assert.match(pages, /className="v2-preview-primary-categories"/u);
  assert.match(pages, /className="v2-preview-secondary-categories"/u);
  assert.match(pages, /className=\{`v2-preview-catalog__main\$\{catalogLocked \? " is-scroll-locked" : ""\}`\}/u);
  assert.match(pages, /controlsTop <= 68\.5/u);
  assert.match(pages, /className="v2-preview-scenario"[\s\S]*?<details>[\s\S]*?<summary>/u);
  assert.match(pages, /setSecondary\("all"\)[\s\S]*?secondary: ""/u);
  assert.match(pages, /primaryCategoryKey/u);
  assert.match(pages, /secondaryCategoryKey/u);
  assert.doesNotMatch(pages, /className="v2-preview-catalog__heading"/u);
  assert.doesNotMatch(pages, />\s*(?:浏览方式|服务分类|人工确认服务|精选服务)\s*</u);

  assert.match(shell, /className="v2-preview-header__nav"/u);
  assert.doesNotMatch(shell, /className="v2-preview-product-nav"/u);
  assert.doesNotMatch(shell, /className=\{`v2-preview-workspace/u);
  assert.match(shell, /className="v2-preview-mobile-bottom-nav"/u);
  assert.match(shell, /<PreviewCart/u);
  assert.ok(shell.includes('href: `${base}/cart`'));
  assert.match(shell, /window\.location\.assign\(`\$\{base\}\/cart`\)/u);
  assert.match(shell, /orders\/lookup/u);
  assert.doesNotMatch(shell, /<small>CloudBridge V2<\/small>|>\{locale === "zh" \? "浏览频道" : "Explore channels"\}</u);
  assert.doesNotMatch(shell, /0\{index \+ 1\}/u);
  assert.match(shell, /const showTransitFloat = pathname === base \|\| pathname === `\$\{base\}\/`/u);
  assert.match(shell, /<span>\{locale === "zh" \? "中转站" : "Transit"\}<\/span>/u);
  assert.match(shell, /!isProductDetail && !isCartPage && !isHome && footer/u);

  assert.match(styles, /\.v2-preview-footer \{[^}]*grid-template-rows:\s*128px 52px;/u);
  assert.match(styles, /\.v2-preview-footer__brand > span \{[^}]*width:\s*48px;[^}]*height:\s*34px;/u);
  assert.match(styles, /\.v2-preview-product-grid \{[^}]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/u);
  assert.match(styles, /\.v2-preview-cart-layer \{[^}]*position:\s*fixed;/u);
  assert.match(styles, /\.v2-preview-mobile-bottom-nav \{[^}]*display:\s*none;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-catalog__main \{[^}]*grid-template-columns:\s*76px minmax\(0,1fr\)/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-secondary-categories \{[^}]*width:\s*76px;[^}]*height:\s*max-content;[^}]*overflow-y:\s*hidden;/u);
  assert.match(styles, /@media \(max-width: 330px\)[\s\S]*?\.v2-preview-catalog__main \{[^}]*grid-template-columns:\s*72px minmax\(0,1fr\)/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-product-card \{[^}]*height:\s*104px;[^}]*grid-template-columns:\s*clamp\(84px,24vw,92px\)/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-product-card__image \{[^}]*aspect-ratio:\s*1\s*\/\s*1;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-product-card__image > img \{[^}]*object-fit:\s*contain;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-product-card__body \{[^}]*height:\s*92px;[^}]*grid-template-rows:\s*28px 20px 44px;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-mobile-bottom-nav \{[^}]*grid-template-columns:\s*repeat\(4,minmax\(0,1fr\)\)/u);
  assert.match(styles, /\.v2-preview-transit-float \{[^}]*width:\s*56px;[^}]*min-width:\s*56px;[^}]*height:\s*56px;[^}]*border-radius:\s*50%;/u);
  assert.match(styles, /\.v2-preview-transit-float::before \{[^}]*border-radius:\s*inherit;/u);
  assert.match(styles, /\.v2-preview-transit-float > span \{[^}]*display:\s*block;[^}]*white-space:\s*nowrap;/u);
  assert.doesNotMatch(styles, /\.v2-preview-transit-float \{[^}]*min-width:\s*(?:108|124)px;/u);
  assert.match(styles, /\.v2-preview-brand > span \{[^}]*overflow:\s*visible;[^}]*border:\s*0;[^}]*background:\s*transparent;/u);
  assert.match(styles, /\.v2-preview-product-card__hit \{[^}]*position:\s*absolute;[^}]*inset:\s*0;/u);
  assert.match(styles, /\.v2-preview-detail-visual \{[^}]*aspect-ratio:\s*1\s*\/\s*1;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-header__actions > \.v2-preview-cart-button \{[^}]*display:\s*none;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-header__actions > \.v2-preview-support-button \{[^}]*display:\s*inline-flex;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-header__actions > \.v2-preview-icon-button,[\s\S]*?\.v2-preview-header__actions > \.language-picker,[\s\S]*?\.v2-preview-header__actions > \.v2-preview-support-button \{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*border-radius:\s*12px;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-catalog__toolbar \{[^}]*grid-template-columns:\s*minmax\(0,1fr\) minmax\(104px,116px\);[^}]*grid-template-rows:\s*50px;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-catalog__search \{[^}]*grid-column:\s*1;[^}]*grid-row:\s*1;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-catalog__toolbar \.currency-picker \{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-header \{[^}]*position:\s*sticky;[^}]*z-index:\s*230;[^}]*top:\s*0;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-catalog__main \{[^}]*height:\s*calc\(100dvh - 134px - env\(safe-area-inset-bottom\)\);/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-catalog__controls \{[^}]*position:\s*sticky;[^}]*top:\s*68px;/u);
  assert.match(styles, /\.v2-preview-catalog__main\.is-scroll-locked > \.v2-preview-secondary-categories,[\s\S]*?\.v2-preview-catalog__results \{ overflow-y:\s*auto;/u);
});

test("home removes the rejected content blocks while other pages retain the editorial footer", () => {
  const pages = readFileSync(join(componentRoot, "preview-pages.tsx"), "utf8");
  const shell = readFileSync(join(componentRoot, "preview-shell.tsx"), "utf8");
  const homeStart = pages.indexOf("export function V2PreviewHome");
  const homeEnd = pages.indexOf("export function V2PreviewMarket", homeStart);
  const homeSource = pages.slice(homeStart, homeEnd);

  assert.doesNotMatch(homeSource, /PreviewChannelCards|PreviewAssurance|PreviewProcessAndFaq/u);
  assert.match(homeSource, /<PreviewCatalog/u);
  assert.match(pages, /className="v2-preview-lookup-heading"/u);
  assert.doesNotMatch(pages, /className="v2-preview-lookup-hero"/u);
  assert.match(shell, /const isCartPage = pathname === `\$\{base\}\/cart`/u);
  assert.match(shell, /!isProductDetail && !isCartPage && !isHome && footer/u);
});

test("DEMO cart is in-memory, deduplicates products, and never creates a server order", () => {
  const source = combinedSource(readPreviewSources());
  const styles = readFileSync(join(storefrontRoot, "app", "globals.css"), "utf8");

  assert.match(source, /current\.includes\(product\.id\) \? current : \[\.\.\.current, product\.id\]/u);
  assert.match(source, /提交人工订单/u);
  assert.match(source, /Submit manual order/u);
  assert.match(source, /PREVIEW_VALIDATION_NOTICE/u);
  assert.match(source, /人工确认，不含在线支付/u);
  assert.match(source, /export function PreviewCartPage/u);
  assert.match(source, /className="v2-preview-page v2-preview-cart-page"/u);
  assert.match(source, /v2-preview-cart__dock/u);
  assert.match(source, /您可能喜欢/u);
  assert.match(source, /You may also like/u);
  assert.match(source, /PREVIEW_PRODUCTS\.filter\(\(product\) => !cartItemIds\.includes\(product\.id\)\)\.slice\(0, 6\)/u);
  assert.match(styles, /\.v2-preview-cart\.is-page \.v2-preview-cart__dock \{[^}]*position:\s*fixed;[^}]*bottom:\s*20px;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-cart\.is-page \.v2-preview-cart__dock \{[^}]*bottom:\s*calc\(74px \+ env\(safe-area-inset-bottom\)\);/u);
  assert.match(source, /className="v2-preview-cart-recommendations__list"/u);
  assert.match(styles, /\.v2-preview-cart-recommendations__list \{[^}]*grid-template-columns:\s*minmax\(0,1fr\);/u);
  assert.doesNotMatch(styles, /\.v2-preview-cart-recommendations__(?:list|rail) \{[^}]*overflow-x:\s*auto;/u);
  assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)\([^)]*cart/iu);
  assert.doesNotMatch(source, /fetch\([\s\S]{0,160}(?:cart|checkout|orders)/iu);
});

test("order lookup preview offers three safe DEMO-only methods", () => {
  const source = combinedSource(readPreviewSources());
  const fixtures = readFileSync(fixtureFile, "utf8");

  assert.match(source, /PREVIEW_ORDER_LOOKUP/u);
  assert.match(source, /PREVIEW_ORDER_LOOKUPS/u);
  assert.match(source, /DEMO-CB/u);
  assert.match(source, /本机订单/u);
  assert.match(source, /联系方式/u);
  assert.match(source, /订单号/u);
  assert.match(source, /On this device/u);
  assert.match(source, /Purchase contact/u);
  assert.match(source, /Order number/u);
  assert.match(source, /role="tablist"/u);
  assert.match(source, /role="tab"/u);
  assert.match(source, /PREVIEW_CONTACT_VERIFICATION_CODE/u);
  assert.match(source, /Unknown contacts, invalid codes, and unknown order numbers share the same message/u);
  assert.match(source, /"checking" \| "not-found" \| "rate-limited" \| "unavailable"/u);
  assert.match(fixtures, /DEMO-ORDER-LOOKUP-02/u);
  assert.doesNotMatch(source, /v2-preview-lookup-back|返回服务目录|Back to services/u);
  assert.doesNotMatch(source, /localStorage\.(?:setItem|getItem)\([^)]*(?:order|lookup)/iu);
  assert.doesNotMatch(source, /fetch\([\s\S]{0,120}orders\/lookup/iu);
});

test("Skill preview links only to secure GitHub repositories", () => {
  const files = readPreviewSources();
  const source = combinedSource(files);
  const fixtures = readFileSync(fixtureFile, "utf8");
  const githubUrls = [...fixtures.matchAll(/\bgithubUrl\s*:\s*["'`]([^"'`]+)["'`]/gu)]
    .map((match) => match[1] ?? "")
    .filter((url) => !url.includes("${"));
  const githubAnchors = [...source.matchAll(/<a\b[\s\S]*?>/gu)]
    .map((match) => match[0])
    .filter((anchor) => /githubUrl/u.test(anchor));

  assert.ok(githubUrls.length > 0, "Skill fixtures must include a verified GitHub URL");
  assert.equal(
    githubUrls.every((url) => /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\/[^\s]*)?$/u.test(url)),
    true,
    `Skill links must be HTTPS GitHub URLs: ${githubUrls.join(", ")}`,
  );
  assert.ok(githubAnchors.length > 0, "Skill cards or details must render a GitHub anchor");
  for (const anchor of githubAnchors) {
    assert.match(anchor, /target=["']_blank["']/u);
    assert.match(anchor, /rel=["']noopener noreferrer["']/u);
  }
});

test("Skill directory uses one populated taxonomy beside compact result cards", () => {
  const pages = readFileSync(join(componentRoot, "preview-pages.tsx"), "utf8");
  const styles = readFileSync(join(storefrontRoot, "app", "globals.css"), "utf8");
  const populatedCategories = PREVIEW_SKILL_CATEGORIES.filter((category) => (
    category.key === "all" || PREVIEW_SKILLS.some((skill) => skill.categoryKey === category.key)
  ));

  assert.deepEqual(
    populatedCategories.map((category) => category.label.zh),
    ["全部", "Agent 开发", "连接器", "浏览器自动化", "开发工具", "网站开发"],
  );
  assert.match(pages, /item\.key === "all" \|\| PREVIEW_SKILLS\.some\(\(skill\) => skill\.categoryKey === item\.key\)/u);
  assert.match(pages, /className="v2-preview-skill-categories"/u);
  assert.match(pages, /className=\{`v2-preview-skills-catalog__main\$\{skillCatalogLocked/u);
  assert.match(pages, /requestedCategory === "all" \|\| availableCategories\.some/u);
  assert.match(pages, /replacePreviewQuery\(\{ q: query\.trim\(\), filter:/u);
  assert.doesNotMatch(pages, /v2-preview-skill-discovery[\s\S]{0,900}v2-preview-mobile-filters/u);
  assert.doesNotMatch(pages, /阅读详情|Read details/u);

  assert.match(styles, /\.v2-preview-skills-catalog__main \{[\s\S]{0,220}grid-template-columns:\s*clamp\(160px,12vw,176px\) minmax\(0,1fr\);/u);
  assert.match(styles, /\.v2-preview-skill-grid \{[^}]*grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\);/u);
  assert.match(styles, /@media \(max-width: 1279px\) and \(min-width: 761px\)[\s\S]*?\.v2-preview-skill-grid \{[^}]*repeat\(2,minmax\(0,1fr\)\)/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-skills-catalog__main \{[\s\S]{0,220}grid-template-columns:\s*76px minmax\(0,1fr\);/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-skill-card,[\s\S]{0,180}height:\s*116px;/u);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*?\.v2-preview-skill-discovery \{[^}]*padding:\s*8px 0 16px;/u);
  assert.match(styles, /@media \(max-width: 330px\)[\s\S]*?\.v2-preview-skills-catalog__main \{[^}]*grid-template-columns:\s*72px minmax\(0,1fr\);/u);
  assert.match(styles, /\.v2-preview-skill-card__actions a \{[^}]*min-height:\s*44px;/u);
  assert.match(styles, /\.v2-preview-skill-results \{[^}]*overflow-y:\s*auto;/u);
  assert.match(styles, /\.v2-preview-skill-categories \{[^}]*height:\s*max-content;/u);
});

test("catalog preview restores category and search state through the URL", () => {
  const source = combinedSource(readPreviewSources());

  assert.match(source, /(?:new URLSearchParams|useSearchParams)/u);
  assert.match(source, /\.get\(["']primary["']\)/u);
  assert.match(source, /\.get\(["']secondary["']\)/u);
  assert.match(source, /\.get\(["']q["']\)/u);
  assert.match(source, /(?:history\.replaceState|router\.replace)/u);
});

test("two-level catalog fixtures keep products on secondary categories only", () => {
  const primaryKeys = new Set(PREVIEW_PRIMARY_CATEGORIES.map((category) => category.key));
  const secondaryByKey = new Map(PREVIEW_SECONDARY_CATEGORIES.map((category) => [category.key, category]));

  assert.deepEqual(PREVIEW_PRIMARY_CATEGORIES.map((category) => category.label.zh), ["AI 软件服务", "中转站服务"]);
  assert.equal(PREVIEW_SECONDARY_CATEGORIES.length, 6);
  for (const secondary of PREVIEW_SECONDARY_CATEGORIES) {
    assert.equal(primaryKeys.has(secondary.primaryKey), true, `${secondary.id} must reference a primary category`);
  }
  for (const product of PREVIEW_PRODUCTS) {
    const secondary = secondaryByKey.get(product.secondaryCategoryKey);
    assert.ok(secondary, `${product.id} must reference a secondary category`);
    assert.equal(secondary.primaryKey, product.primaryCategoryKey, `${product.id} category ancestry must agree`);
  }
});

test("Hero preview covers off, single, and multiple states", () => {
  const source = combinedSource(readPreviewSources());

  assert.match(source, /["']off["']/u);
  assert.match(source, /["']single["']/u);
  assert.match(source, /["']multiple["']/u);
  assert.match(source, /hero(?:Mode|Scenario)|(?:hero|heroes)\.length/iu);
});
