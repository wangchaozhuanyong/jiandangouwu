import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("订单查询在同一标签页恢复安全摘要，不缓存原始联系方式", () => {
  const provider = read("../components/experience-provider.tsx");

  assert.match(provider, /ORDER_RECEIPTS_KEY = "cloudbridge-storefront-order-receipts"/u);
  assert.match(provider, /window\.sessionStorage\.getItem\(ORDER_RECEIPTS_KEY\)/u);
  assert.match(provider, /window\.sessionStorage\.setItem\(ORDER_RECEIPTS_KEY/u);
  assert.match(provider, /window\.sessionStorage\.removeItem\(ORDER_RECEIPTS_KEY\)/u);
  assert.match(provider, /isSafeOrderReceipt/u);
  assert.match(provider, /MAX_ORDER_RECEIPTS = 20/u);
  assert.doesNotMatch(provider, /sessionStorage\.(?:setItem|getItem)\([^)]*contact/iu);
});

test("联系方式查询要求渠道、账号和完整订单号，并复用无障碍渠道选择器", () => {
  const commerce = read("../components/v2-live/live-commerce.tsx");
  const picker = read("../components/contact-channel-picker.tsx");

  assert.match(commerce, /mode: lookupMode === "contact" \? "CONTACT" : "ORDER_NUMBER"/u);
  assert.match(commerce, /contactChannel: contactChannel as ContactChannelType/u);
  assert.match(commerce, /contactValue: contactValue\.trim\(\)/u);
  assert.match(commerce, /isValidOrderContact\(contactValue\)/u);
  assert.match(commerce, /<ContactChannelPicker[\s\S]*?menuTitle=\{t\.contactMenuTitle\}/u);
  assert.match(commerce, /clearOrderReceipts/u);
  assert.doesNotMatch(commerce, /Contact lookup is not open yet/u);
  assert.match(picker, /menuTitle\?: string/u);
  assert.match(picker, /invalid\?: boolean/u);
});
