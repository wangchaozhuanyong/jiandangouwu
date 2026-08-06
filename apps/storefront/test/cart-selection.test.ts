import assert from "node:assert/strict";
import test from "node:test";

import {
  reconcileSelectedItemIds,
  toggleSelectedItemId,
} from "../lib/cart-selection";

test("cart entries are selected by default and deselections survive new additions", () => {
  const firstRender = reconcileSelectedItemIds(
    ["transit", "ai", "skill"],
    new Set(),
    new Set(),
  );
  const afterDeselectingAi = toggleSelectedItemId(firstRender, "ai");
  const afterRecommendationAdd = reconcileSelectedItemIds(
    ["transit", "ai", "skill", "recharge"],
    new Set(["transit", "ai", "skill"]),
    afterDeselectingAi,
  );

  assert.deepEqual([...afterRecommendationAdd].sort(), [
    "recharge",
    "skill",
    "transit",
  ]);
});

test("selection drops only removed cart entries", () => {
  const selected = reconcileSelectedItemIds(
    ["transit", "skill"],
    new Set(["transit", "ai", "skill"]),
    new Set(["transit", "ai", "skill"]),
  );

  assert.deepEqual([...selected].sort(), ["skill", "transit"]);
});
