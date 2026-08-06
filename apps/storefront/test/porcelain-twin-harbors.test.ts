import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readStorefront = (file: string) => readFileSync(
  new URL(`../${file}`, import.meta.url),
  "utf8",
);

const readRoot = (file: string) => readFileSync(
  new URL(`../../../${file}`, import.meta.url),
  "utf8",
);

const escapePattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const ruleBodies = (source: string, selector: string) => [
  ...source.matchAll(new RegExp(`${escapePattern(selector)}\\s*\\{([^}]*)\\}`, "gu")),
].map((match) => match[1] ?? "");

const declaration = (body: string, property: string) => {
  const match = new RegExp(`${escapePattern(property)}\\s*:\\s*([^;}]+)`, "u").exec(body);
  return match?.[1]?.replace(/\\s+/gu, " ").trim() ?? "";
};

const maxWidth760Blocks = (source: string) => {
  const blocks: string[] = [];
  const matcher = /@media\s*\(\s*max-width\s*:\s*760px\s*\)\s*\{/gu;
  let match = matcher.exec(source);

  while (match) {
    const openingBrace = source.indexOf("{", match.index);
    let depth = 0;

    for (let index = openingBrace; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(openingBrace + 1, index));
        matcher.lastIndex = index + 1;
        break;
      }
    }

    match = matcher.exec(source);
  }

  return blocks;
};

const isTwoColumnTrack = (value: string) => {
  const compact = value.replace(/\s+/gu, "");
  return /repeat\(2,/u.test(compact)
    || compact === "1fr1fr"
    || (compact.includes("/2") && compact.includes("minmax(0,1fr)"));
};

test("option 2 is recorded as the formal UI-only storefront direction", () => {
  const agents = readRoot("AGENTS.md");

  assert.match(
    agents,
    /selected formal storefront visual direction is option 2, "瓷白双港"/u,
  );
  assert.match(agents, /option-2 implementation remains a UI-only visual mapping/u);
  assert.match(agents, /Phase one may now preview an in-memory cart/u);
  assert.match(agents, /must not create a server order, persist cart state, add quantity controls/u);
});

test("the home keeps hero, capability rail, and catalog in that order without invented commerce", () => {
  const home = readStorefront("components/storefront-home.tsx");
  const hero = home.indexOf('className="hero-stage"');
  const capability = home.indexOf('className="capability-section"');
  const catalog = home.indexOf('className="catalog-section"');

  assert.ok(hero >= 0, "the home must render the hero first");
  assert.ok(capability > hero, "the capability rail must follow the hero");
  assert.ok(catalog > capability, "the catalog must follow the capability rail");
  assert.doesNotMatch(home, /\b(?:cart|basket|quantity)\b/iu);
  assert.doesNotMatch(
    home,
    /(?:transit-subscription|skill-(?:catalog|section)|\/(?:cart|checkout|skills?)(?:[/'"`}]|$))/iu,
  );
});

test("the split hero keeps a real story and routes its service panel to support", () => {
  const home = readStorefront("components/storefront-home.tsx");
  const story = home.indexOf('className="hero-story"');
  const panelStart = home.indexOf('className="hero-service-panel"');
  const panelEnd = home.indexOf("</aside>", panelStart);
  const panel = home.slice(panelStart, panelEnd);

  assert.ok(story >= 0, "the image-led hero story must remain present");
  assert.ok(panelStart > story, "the service panel must accompany the hero story");
  assert.match(panel, /<button[\s\S]*?onClick=\{openSupport\}[\s\S]*?>/u);
  assert.match(panel, /t\.heroServiceAction/u);
});

test("product cards are horizontal on desktop and return to a two-column vertical mobile grid", () => {
  const home = readStorefront("components/storefront-home.tsx");
  const styles = readStorefront("app/globals.css");
  const cardStart = home.indexOf('className="product-card');
  const cardEnd = home.indexOf("</Link>", cardStart);
  const card = home.slice(cardStart, cardEnd);
  const cardClassNames = /className="([^"]*\bproduct-card\b[^"]*)"/u
    .exec(card)?.[1]?.split(/\s+/u).filter(Boolean) ?? [];
  const cardSelectors = cardClassNames.map((className) => `.${className}`);
  const desktopCardRules = cardSelectors.flatMap((selector) => ruleBodies(styles, selector));
  const mobile = maxWidth760Blocks(styles);
  const mobileCardRules = mobile.flatMap((block) => cardSelectors
    .flatMap((selector) => ruleBodies(block, selector)));
  const mobileGridRules = mobile.flatMap((block) => ruleBodies(block, ".product-grid"));

  assert.ok(cardStart >= 0, "the catalog must keep the product-card component");
  assert.ok(
    card.indexOf('className="product-image"') < card.indexOf('className="product-copy"'),
    "the product image must precede its product content",
  );
  assert.ok(
    desktopCardRules.some((body) => {
      const columns = declaration(body, "grid-template-columns");
      return /display\s*:\s*grid/u.test(body)
        && Boolean(columns)
        && !/^(?:1fr|minmax\(0,\s*1fr\))$/u.test(columns);
    }),
    "desktop product cards must use more than one horizontal track",
  );
  assert.ok(
    mobileGridRules.some((body) => isTwoColumnTrack(declaration(body, "grid-template-columns"))),
    "the product grid must remain two columns at 760px and below",
  );
  assert.ok(
    mobileCardRules.some((body) => /^(?:1fr|minmax\(0,\s*1fr\))$/u.test(
      declaration(body, "grid-template-columns"),
    )),
    "each mobile product card must return to a vertical single-column layout",
  );
});

test("the mobile capability rail remains a symmetric two-by-two grid", () => {
  const styles = readStorefront("app/globals.css");
  const mobileCapabilityRules = maxWidth760Blocks(styles)
    .flatMap((block) => ruleBodies(block, ".capability-rail"));

  assert.ok(
    mobileCapabilityRules.some((body) => isTwoColumnTrack(
      declaration(body, "grid-template-columns"),
    )),
    "the four capabilities must resolve to two columns on mobile",
  );
});

test("the editorial footer and product-detail purchase boundaries remain intact", () => {
  const shell = readStorefront("components/site-shell.tsx");
  const detail = readStorefront("components/product-detail.tsx");
  const styles = readStorefront("app/globals.css");
  const footerStart = shell.indexOf('className="footer-links"');
  const footerEnd = shell.indexOf("</nav>", footerStart);
  const footer = shell.slice(footerStart, footerEnd);
  const footerEntries = ["t.navServices", "t.terms", "t.privacy", "t.navSupport"];

  assert.match(shell, /const isProductDetail = pathname\.startsWith/u);
  assert.match(shell, /\{!isProductDetail && \(\s*<footer id="support" className="site-footer">/u);
  assert.ok(footerStart >= 0, "the editorial footer navigation must remain present");
  footerEntries.reduce((previousIndex, entry) => {
    const index = footer.indexOf(entry);
    assert.ok(index > previousIndex, `${entry} must retain its footer position`);
    return index;
  }, -1);

  assert.match(detail, /<main className="detail-page">/u);
  assert.match(detail, /className="order-action-dock"/u);
  assert.match(ruleBodies(styles, ".detail-page")[0] ?? "", /padding-bottom\s*:/u);
  assert.match(ruleBodies(styles, ".order-action-dock")[0] ?? "", /position\s*:\s*fixed/u);
});
