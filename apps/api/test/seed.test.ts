import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  storefrontSettingsSeed,
  storefrontSettingsSeedForPolicy,
} from "../prisma/seed-data.js";

test("new storefront settings inherit an existing valid policy version", () => {
  assert.equal(
    storefrontSettingsSeedForPolicy(" 2026-09-15 ").policyVersion,
    "2026-09-15",
  );
  for (const value of [null, "", "invalid policy version", 20260915]) {
    assert.equal(
      storefrontSettingsSeedForPolicy(value).policyVersion,
      storefrontSettingsSeed.policyVersion,
    );
  }
});

test("seed source passes the persisted policy row into storefront settings creation", () => {
  const source = readFileSync(new URL("../prisma/seed.ts", import.meta.url), "utf8");
  assert.match(
    source,
    /const policySetting = await prisma\.siteSetting\.upsert\(/u,
  );
  assert.match(
    source,
    /value: storefrontSettingsSeedForPolicy\(policySetting\.value\)/u,
  );
});
