import assert from "node:assert/strict";
import test from "node:test";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { App } from "../src/App";

test("admin loading shell renders without browser globals during Sites SSR", () => {
  Object.assign(globalThis, { React });
  const html = renderToString(React.createElement(App));
  assert.match(html, /admin-shell-skeleton/u);
});
