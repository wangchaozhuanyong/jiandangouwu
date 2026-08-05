import assert from "node:assert/strict";
import test from "node:test";
import { handleCloudBridgeRequest } from "../server/router.ts";
import { createTestDatabase, memoryR2 } from "./test-helpers.mjs";

test("V2 admin categories enforce two levels and preserve an omitted parent on legacy edits", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = { DB: db, MEDIA: memoryR2() };
  try {
    await bootstrap(env);
    const categories = await call(env, "/v1/admin/categories");
    const primary = categories.body.data.find((item) => item.level === "PRIMARY");
    const secondary = categories.body.data.find((item) => item.level === "SECONDARY");
    assert.ok(primary);
    assert.ok(secondary);

    const legacyEdit = await call(env, `/v1/admin/categories/${secondary.id}`, {
      method: "PATCH",
      body: {
        version: secondary.version,
        slug: secondary.slug,
        nameZh: secondary.name.zh,
        nameEn: secondary.name.en,
        status: secondary.status,
        sortOrder: secondary.sortOrder,
      },
    });
    assert.equal(legacyEdit.response.status, 200);
    assert.equal(legacyEdit.body.data.parentId, primary.id);

    const childOfSecondary = await call(env, "/v1/admin/categories", {
      method: "POST",
      body: {
        slug: "unsupported-third-level",
        parentId: secondary.id,
        nameZh: "不支持三级",
        nameEn: "Unsupported third level",
        status: "DRAFT",
        sortOrder: 99,
      },
    });
    assert.equal(childOfSecondary.response.status, 422);
    assert.equal(childOfSecondary.body.error.code, "CATEGORY_MAX_DEPTH");
  } finally {
    sqlite.close();
  }
});

test("V2 admin products require a secondary category and preserve formal fields on legacy edits", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = { DB: db, MEDIA: memoryR2() };
  try {
    await bootstrap(env);
    const categories = (await call(env, "/v1/admin/categories")).body.data;
    const primary = categories.find((item) => item.level === "PRIMARY");
    const secondary = categories.find((item) => item.level === "SECONDARY");
    const base = productInput(primary.id);
    const rejected = await call(env, "/v1/admin/products", { method: "POST", body: base });
    assert.equal(rejected.response.status, 422);
    assert.equal(rejected.body.error.code, "PRODUCT_SECONDARY_CATEGORY_REQUIRED");

    const created = await call(env, "/v1/admin/products", {
      method: "POST",
      body: {
        ...productInput(secondary.id),
        platformKey: "OPENAI",
        surfaces: ["HOME", "AI_RECHARGE"],
      },
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.platformKey, "OPENAI");
    assert.deepEqual(created.body.data.surfaces, ["HOME", "AI_RECHARGE"]);

    const item = created.body.data;
    const legacyEdit = await call(env, `/v1/admin/products/${item.id}`, {
      method: "PATCH",
      body: {
        version: item.version,
        slug: item.slug,
        categoryId: item.category.id,
        imageKey: item.imageKey,
        basePrice: item.basePrice,
        compareAtPrice: item.compareAtPrice,
        stockMode: item.stockMode,
        stockQuantity: item.stockQuantity,
        status: item.status,
        sortOrder: item.sortOrder,
        nameZh: item.translations.zh.name,
        nameEn: item.translations.en.name,
        kickerZh: item.translations.zh.kicker,
        kickerEn: item.translations.en.kicker,
        descriptionZh: item.translations.zh.description,
        descriptionEn: item.translations.en.description,
      },
    });
    assert.equal(legacyEdit.response.status, 200);
    assert.equal(legacyEdit.body.data.platformKey, "OPENAI");
    assert.deepEqual(legacyEdit.body.data.surfaces, ["HOME", "AI_RECHARGE"]);
  } finally {
    sqlite.close();
  }
});

test("V2 Skill admin validates GitHub sources and applies optimistic version checks", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = { DB: db, MEDIA: memoryR2() };
  try {
    await bootstrap(env);
    const category = await call(env, "/v1/admin/skill-categories", {
      method: "POST",
      body: {
        slug: "development-tools",
        nameZh: "开发工具",
        nameEn: "Development tools",
        status: "ACTIVE",
        sortOrder: 1,
      },
    });
    assert.equal(category.response.status, 201);

    const unsafe = await call(env, "/v1/admin/skills", {
      method: "POST",
      body: skillInput(category.body.data.id, "https://github.com.evil.test/openai/codex"),
    });
    assert.equal(unsafe.response.status, 422);

    const created = await call(env, "/v1/admin/skills", {
      method: "POST",
      body: skillInput(category.body.data.id, "https://github.com/openai/codex"),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.data.githubUrl, "https://github.com/openai/codex");

    const firstUpdate = await call(env, `/v1/admin/skills/${created.body.data.id}`, {
      method: "PATCH",
      body: { ...skillInput(category.body.data.id, "https://github.com/openai/codex"), version: 1 },
    });
    assert.equal(firstUpdate.response.status, 200);
    const staleUpdate = await call(env, `/v1/admin/skills/${created.body.data.id}`, {
      method: "PATCH",
      body: { ...skillInput(category.body.data.id, "https://github.com/openai/codex"), version: 1 },
    });
    assert.equal(staleUpdate.response.status, 409);
    assert.equal(staleUpdate.body.error.code, "VERSION_CONFLICT");
  } finally {
    sqlite.close();
  }
});

test("V2 banner extensions survive an edit from the existing banner form", async () => {
  const { sqlite, db } = createTestDatabase();
  const env = { DB: db, MEDIA: memoryR2() };
  try {
    await bootstrap(env);
    sqlite.prepare(
      `UPDATE heroes SET placement = 'AI_RECHARGE', mobile_image_key = image_key,
        target_type = 'CATEGORY', target_value = 'ai-services',
        secondary_cta_zh = '查看说明', secondary_cta_en = 'Read more',
        secondary_target_type = 'EXTERNAL_URL',
        secondary_target_value = 'https://example.test/guide'
       WHERE id = (SELECT id FROM heroes ORDER BY sort_order LIMIT 1)`,
    ).run();
    const hero = (await call(env, "/v1/admin/heroes")).body.data[0];
    const updated = await call(env, `/v1/admin/heroes/${hero.id}`, {
      method: "PATCH",
      body: {
        version: hero.version,
        key: hero.key,
        imageKey: hero.imageKey,
        targetSlug: hero.targetSlug,
        tone: hero.tone,
        status: hero.status,
        sortOrder: hero.sortOrder,
        translations: hero.translations,
      },
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.body.data.placement, "AI_RECHARGE");
    assert.equal(updated.body.data.mobileImageKey, hero.imageKey);
    assert.equal(updated.body.data.targetType, "CATEGORY");
    assert.equal(updated.body.data.secondaryTargetValue, "https://example.test/guide");
  } finally {
    sqlite.close();
  }
});

async function bootstrap(env) {
  const result = await call(env, "/v1/admin/auth/me");
  assert.equal(result.response.status, 200);
}

async function call(env, path, { method = "GET", body } = {}) {
  const headers = new Headers({
    "oai-authenticated-user-email": "owner@example.test",
    "oai-authenticated-user-full-name": "Owner",
  });
  if (method !== "GET") {
    headers.set("content-type", "application/json");
    headers.set("x-csrf-token", "sites-siwc");
  }
  const response = await handleCloudBridgeRequest(new Request(`https://example.test${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env);
  assert.ok(response);
  return { response, body: await response.json() };
}

function productInput(categoryId) {
  return {
    slug: "v2-admin-product",
    categoryId,
    imageKey: "/assets/products/chatgpt.webp",
    basePrice: "99.00",
    compareAtPrice: null,
    stockMode: "UNLIMITED",
    stockQuantity: null,
    status: "DRAFT",
    sortOrder: 90,
    nameZh: "V2 管理商品",
    nameEn: "V2 admin product",
    kickerZh: "人工服务",
    kickerEn: "Assisted service",
    descriptionZh: "用于验证正式后台接口。",
    descriptionEn: "Used to verify the formal admin API.",
  };
}

function skillInput(categoryId, githubUrl) {
  return {
    slug: "codex-cli",
    categoryId,
    resourceType: "SKILL",
    sourceLevel: "OFFICIAL",
    maintainer: "OpenAI",
    githubUrl,
    documentationUrl: "https://developers.openai.com/codex/",
    license: "Apache-2.0",
    compatibleEnvironments: ["Codex"],
    verifiedAt: "2026-08-04",
    status: "ACTIVE",
    sortOrder: 1,
    translations: {
      zh: {
        name: "Codex CLI",
        summary: "命令行开发助手",
        description: "用于真实的软件开发工作流。",
        suitableFor: ["代码开发"],
        unsuitableFor: ["自动付款"],
        installHint: "安装前阅读官方文档。",
      },
      en: {
        name: "Codex CLI",
        summary: "Command-line development assistant",
        description: "For real software development workflows.",
        suitableFor: ["Code development"],
        unsuitableFor: ["Automatic payments"],
        installHint: "Read the official documentation before installation.",
      },
    },
  };
}
