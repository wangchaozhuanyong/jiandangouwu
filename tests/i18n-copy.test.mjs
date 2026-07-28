import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  copy,
  currencies,
  heroes,
  merchantChannels,
  productCategories,
  products,
  statusText,
  teamMembers,
} from "../src/data.js";

const languages = ["zh", "en"];

const assertLocalized = (value, label) => {
  assert.equal(typeof value, "object", `${label} must be a localized object`);
  for (const lang of languages) {
    assert.equal(typeof value[lang], "string", `${label}.${lang} must be a string`);
    assert.notEqual(value[lang].trim(), "", `${label}.${lang} must not be empty`);
  }
};

test("shared copy exposes the same complete keys for both languages", () => {
  assert.deepEqual(Object.keys(copy.zh).sort(), Object.keys(copy.en).sort());
  for (const key of Object.keys(copy.zh)) {
    for (const lang of languages) {
      const value = copy[lang][key];
      if (Array.isArray(value)) {
        assert.ok(value.length > 0, `copy.${lang}.${key} must not be empty`);
        value.forEach((item, index) => {
          assert.equal(typeof item, "string", `copy.${lang}.${key}[${index}] must be a string`);
          assert.notEqual(item.trim(), "", `copy.${lang}.${key}[${index}] must not be empty`);
        });
      } else {
        assert.equal(typeof value, "string", `copy.${lang}.${key} must be a string`);
        assert.notEqual(value.trim(), "", `copy.${lang}.${key} must not be empty`);
      }
    }
  }

  assert.equal("curatedServices" in copy.zh, false);
  assert.equal("curatedServices" in copy.en, false);
  assert.equal(copy.zh.secureOrderLookup, "安全订单查询");
  assert.equal(copy.en.brandName, "CloudBridge");
});

test("all content records required by the interface contain both languages", () => {
  currencies.forEach((currency) => assertLocalized(currency.name, `currency ${currency.code} name`));
  heroes.forEach((hero, index) => {
    assertLocalized(hero.eyebrow, `hero ${index} eyebrow`);
    assertLocalized(hero.title, `hero ${index} title`);
    assertLocalized(hero.copy, `hero ${index} copy`);
    assertLocalized(hero.cta, `hero ${index} cta`);
    assert.match(hero.eyebrow.zh, /[\u3400-\u9fff]/, `hero ${index} Chinese eyebrow must contain Chinese`);
  });
  products.forEach((product) => {
    assertLocalized(product.name, `product ${product.id} name`);
    assertLocalized(product.kicker, `product ${product.id} kicker`);
    assertLocalized(product.description, `product ${product.id} description`);
    assert.ok(productCategories.some((category) => category.id === product.categoryId), `product ${product.id} category must exist`);
  });
  productCategories.forEach((category) => assertLocalized(category.name, `category ${category.id} name`));
  merchantChannels.forEach((channel) => assertLocalized(channel.label, `channel ${channel.type} label`));
  teamMembers.forEach((member, index) => {
    assertLocalized(member.name, `team member ${index} name`);
    assertLocalized(member.role, `team member ${index} role`);
    assertLocalized(member.group, `team member ${index} group`);
  });
  Object.entries(statusText).forEach(([status, value]) => assertLocalized(value, `status ${status}`));

  assert.equal(merchantChannels.find((channel) => channel.type === "wechat")?.label.zh, "微信");
});

test("App does not bypass localized copy for the fixed labels covered by this regression", async () => {
  const source = (
    await Promise.all([
      readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
      readFile(new URL("../src/AdminApp.jsx", import.meta.url), "utf8"),
    ])
  ).join("\n");
  const forbiddenFragments = [
    '<p className="eyebrow">HUMAN CONNECTION</p>',
    '<p className="eyebrow">CURATED SERVICES</p>',
    '<p className="eyebrow">SERVICE NOTES</p>',
    'subtitle="CLOUDBRIDGE TOKENS"',
    'subtitle="SUPPORT BRIDGE"',
    'subtitle="ONE-CONTACT CHECKOUT"',
    '<p className="eyebrow">CONNECTION ESTABLISHED</p>',
    '<p className="eyebrow">SECURE ORDER LOOKUP</p>',
    '<p className="eyebrow">BRIDGE NOT FOUND</p>',
    'label="Previous"',
    'label="Next"',
    'label="Collapse"',
    'label="Notifications"',
    'aria-label="Close navigation"',
    '<button>English</button>',
    "14:32 · SYSTEM",
    "<small>NOW</small>",
    'status === "Degraded"',
    'status === "Not connected"',
  ];

  forbiddenFragments.forEach((fragment) => {
    assert.equal(source.includes(fragment), false, `App.jsx contains an untranslated fixed label: ${fragment}`);
  });
  assert.equal(source.includes("curatedServices"), false, "the removed curated services label must not return");
  assert.equal(source.includes("value?.[lang] ?? value?.zh"), false, "localized text must not fall back to another language");
});
