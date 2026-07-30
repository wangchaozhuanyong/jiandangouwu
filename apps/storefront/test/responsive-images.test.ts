import assert from "node:assert/strict";
import test from "node:test";
import { storefrontResponsiveImage } from "../lib/responsive-images";

test("static storefront artwork exposes bounded WebP variants", () => {
  assert.deepEqual(
    storefrontResponsiveImage("/assets/hero-main.webp", "hero"),
    {
      srcSet:
        "/assets/responsive/hero-main-640.webp 640w, /assets/responsive/hero-main-1280.webp 1280w, /assets/hero-main.webp 2048w",
      sizes: "(max-width: 760px) calc(100vw - 24px), calc(100vw - 48px)",
    },
  );
  assert.match(
    storefrontResponsiveImage(
      "/assets/product-codex.webp",
      "product",
    ).srcSet ?? "",
    /product-codex-480\.webp 480w/u,
  );
});

test("dynamic media keeps its original URL when no variant exists", () => {
  assert.deepEqual(
    storefrontResponsiveImage("/v1/media/product/example.webp", "product"),
    {},
  );
});
