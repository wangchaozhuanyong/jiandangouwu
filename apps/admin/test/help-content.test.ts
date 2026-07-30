import {
  isConfiguredContactChannel,
} from "@cloudbridge/contracts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_PAGES,
} from "../src/admin-model.js";
import {
  adminPageHelp,
  helpTriggerLabel,
} from "../src/help-content.js";

test("every formal admin page has complete bilingual help", () => {
  assert.deepEqual(
    Object.keys(adminPageHelp).sort(),
    [...ADMIN_PAGES].sort(),
  );
  for (const page of ADMIN_PAGES) {
    assert.ok(adminPageHelp[page].zh.trim().length >= 20, `${page} needs Chinese help`);
    assert.ok(adminPageHelp[page].en.trim().length >= 20, `${page} needs English help`);
  }
  assert.equal(helpTriggerLabel("zh", "联系方式"), "查看联系方式说明");
  assert.equal(helpTriggerLabel("en", "Contact channels"), "About Contact channels");
});

test("QQ configuration requires an approved target matching its public account", () => {
  assert.equal(isConfiguredContactChannel({
    type: "QQ",
    mode: "DIRECT_WITH_FALLBACK",
    publicAccount: "3543543345",
    directTarget: "mqqwpa://im/chat?chat_type=wpa&uin=3543543345",
  }), true);
  assert.equal(isConfiguredContactChannel({
    type: "QQ",
    mode: "DIRECT_WITH_FALLBACK",
    publicAccount: "3543543345",
    directTarget: "mqqwpa://im/chat?chat_type=wpa&uin=23523532325",
  }), false);
  assert.equal(isConfiguredContactChannel({
    type: "QQ",
    mode: "DIRECT_WITH_FALLBACK",
    publicAccount: "3543543345",
    directTarget: "https://wpa.qq.com/msgrd?v=3&uin=3543543345",
  }), false);
});
