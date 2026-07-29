import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLegacyLineBreaks } from "../server/text.ts";

test("legacy escaped line breaks become real line breaks", () => {
  assert.equal(
    normalizeLegacyLineBreaks("文字、图像与思考，\\n汇入多模态空间"),
    "文字、图像与思考，\n汇入多模态空间",
  );
});

test("existing real line breaks remain unchanged", () => {
  assert.equal(
    normalizeLegacyLineBreaks("Global AI tools,\nconnected by one bridge"),
    "Global AI tools,\nconnected by one bridge",
  );
});
