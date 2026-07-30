import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { copy } from "../lib/copy.js";
import {
  isValidOrderContact,
  MIN_ORDER_CONTACT_LENGTH,
} from "../lib/order-validation.js";

test("order contacts require at least four characters after trimming", () => {
  assert.equal(MIN_ORDER_CONTACT_LENGTH, 4);
  assert.equal(isValidOrderContact(""), false);
  assert.equal(isValidOrderContact("    "), false);
  assert.equal(isValidOrderContact("123"), false);
  assert.equal(isValidOrderContact(" 123 "), false);
  assert.equal(isValidOrderContact("1234"), true);
  assert.equal(isValidOrderContact(" 1234 "), true);
});

test("the order form and localized guidance use the shared minimum", () => {
  const detail = readFileSync(
    new URL("../components/product-detail.tsx", import.meta.url),
    "utf8",
  );
  assert.match(detail, /isValidOrderContact\(draft\.contact\)/u);
  assert.match(detail, /minLength=\{MIN_ORDER_CONTACT_LENGTH\}/u);
  assert.match(copy.zh.contactError, /至少 4 个字符/u);
  assert.match(copy.en.contactError, /at least 4 characters/u);
});

test("the order form does not require a policy acceptance checkbox", () => {
  const detail = readFileSync(
    new URL("../components/product-detail.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(detail, /type="checkbox"/u);
  assert.doesNotMatch(detail, /draft\.accepted/u);
  assert.doesNotMatch(detail, /policyError|policyAccept/u);
});
