import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { ApiInputError } from "../server/http.ts";
import {
  deleteManagedMedia,
  isPublicMediaObjectKey,
  listManagedMedia,
  removeWechatQr,
  replaceMediaReferences,
  uploadManagedMedia,
  uploadWechatQr,
} from "../server/media-api.ts";

const migration = readFileSync(
  new URL("../drizzle/0000_salty_fat_cobra.sql", import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "");

const actor = {
  id: "admin-test",
  email: "owner@example.test",
  displayName: "Owner",
  permissions: [
    "catalog.read",
    "catalog.write",
    "content.read",
    "content.write",
    "support.write",
  ],
};

const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZSPcAAAAASUVORK5CYII=",
  "base64",
);

test("public media keys expose only versioned uploads and never backup objects", () => {
  assert.equal(
    isPublicMediaObjectKey(
      "uploads/2026/07/123e4567-e89b-12d3-a456-426614174000-hero.webp",
    ),
    true,
  );
  assert.equal(isPublicMediaObjectKey("backups/production.enc"), false);
  assert.equal(isPublicMediaObjectKey("uploads/2026/07/../backup.png"), false);
  assert.equal(isPublicMediaObjectKey("uploads/2026/07/script.svg"), false);
});

test("media upload, reference replacement, inventory, and safe deletion use real D1 and R2 state", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  seedReferences(sqlite);
  const r2 = memoryR2();
  const env = {
    DB: d1Adapter(sqlite),
    MEDIA: r2,
  };

  const standalone = await uploadManagedMedia(
    env,
    uploadRequest("standalone.png", "Upload a reusable product image"),
    actor,
  );
  assert.match(standalone.path, /^\/media\/uploads\/\d{4}\/\d{2}\//u);
  assert.equal(standalone.contentType, "image/png");
  assert.equal(standalone.storageStatus, "AVAILABLE");
  assert.equal(r2.has(standalone.key), true);

  const inventory = await listManagedMedia(env);
  assert.equal(inventory.length, 1);
  assert.equal(inventory[0].productReferences, 0);
  assert.equal(inventory[0].heroReferences, 0);
  assert.equal(inventory[0].supportReferences, 0);
  assert.equal(inventory[0].storageStatus, "AVAILABLE");

  const replacement = await replaceMediaReferences(
    env,
    replaceRequest(
      "/assets/shared.webp",
      "replacement.png",
      "Replace the shared live storefront artwork",
    ),
    actor,
  );
  assert.deepEqual(replacement.replacedReferences, {
    products: 1,
    heroes: 1,
  });
  assert.equal(
    sqlite.prepare("SELECT image_key FROM products WHERE id = 'product-test'").get().image_key,
    replacement.media.path,
  );
  assert.equal(
    sqlite.prepare("SELECT image_key FROM heroes WHERE id = 'hero-test'").get().image_key,
    replacement.media.path,
  );
  assert.equal(r2.has(replacement.media.key), true);

  await assert.rejects(
    deleteManagedMedia(
      env,
      deleteRequest("Delete an image that remains in use"),
      replacement.media.key,
      actor,
    ),
    (error) => error instanceof ApiInputError && error.code === "MEDIA_OBJECT_IN_USE",
  );
  assert.equal(r2.has(replacement.media.key), true);

  await deleteManagedMedia(
    env,
    deleteRequest("Remove an unused media upload"),
    standalone.key,
    actor,
  );
  assert.equal(r2.has(standalone.key), false);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM media_objects WHERE key = ?")
      .get(standalone.key).count,
    0,
  );

  const actions = sqlite.prepare(
    "SELECT action FROM audit_events ORDER BY created_at ASC",
  ).all().map((row) => row.action);
  assert.deepEqual(actions, [
    "media.object.uploaded",
    "media.references.replaced",
    "media.object.deleted",
  ]);
});

test("WeChat QR upload validates, versions, audits, protects references, and removes reversibly", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  const r2 = memoryR2();
  const env = { DB: d1Adapter(sqlite), MEDIA: r2 };
  const channel = sqlite.prepare(
    "SELECT id, version FROM merchant_channels WHERE type = 'WECHAT' LIMIT 1",
  ).get();

  await uploadWechatQr(
    env,
    qrUploadRequest(channel.version, "wechat-qr.png", pngBytes, "Publish the confirmed WeChat support QR"),
    channel.id,
    actor,
  );
  const updated = sqlite.prepare(
    "SELECT direct_target AS directTarget, version FROM merchant_channels WHERE id = ?",
  ).get(channel.id);
  assert.match(updated.directTarget, /^\/media\/uploads\/\d{4}\/\d{2}\//u);
  assert.equal(updated.version, channel.version + 1);
  assert.equal(r2.size(), 1);

  const [managed] = await listManagedMedia(env);
  assert.equal(managed.path, updated.directTarget);
  assert.equal(managed.supportReferences, 1);
  await assert.rejects(
    deleteManagedMedia(
      env,
      deleteRequest("Verify an active support QR cannot be deleted"),
      managed.key,
      actor,
    ),
    (error) => error instanceof ApiInputError && error.code === "MEDIA_OBJECT_IN_USE",
  );

  await removeWechatQr(
    env,
    jsonRequest("DELETE", {
      version: updated.version,
      reason: "Retire the current WeChat QR after channel review",
    }),
    channel.id,
    actor,
  );
  assert.equal(
    sqlite.prepare("SELECT direct_target AS directTarget FROM merchant_channels WHERE id = ?")
      .get(channel.id).directTarget,
    null,
  );
  const unreferenced = (await listManagedMedia(env))[0];
  assert.equal(unreferenced.supportReferences, 0);
  await deleteManagedMedia(
    env,
    deleteRequest("Remove the retired unreferenced WeChat QR"),
    managed.key,
    actor,
  );
  assert.equal(r2.size(), 0);
  const actions = sqlite.prepare(
    "SELECT action FROM audit_events WHERE action LIKE 'support.channel.qr.%' ORDER BY created_at ASC",
  ).all().map((row) => row.action);
  assert.deepEqual(actions, [
    "support.channel.qr.uploaded",
    "support.channel.qr.removed",
  ]);
});

test("WeChat QR rejects stale, spoofed, and oversized files and compensates a failed D1 write", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  const baseDb = d1Adapter(sqlite);
  const channel = sqlite.prepare(
    "SELECT id, version FROM merchant_channels WHERE type = 'WECHAT' LIMIT 1",
  ).get();

  for (const [request, code] of [
    [
      qrUploadRequest(channel.version + 1, "stale.png", pngBytes, "Reject a stale QR update version"),
      "VERSION_CONFLICT",
    ],
    [
      qrUploadRequest(channel.version, "spoofed.png", Buffer.from("not an image"), "Reject a spoofed QR image upload"),
      "MEDIA_FILE_TYPE_INVALID",
    ],
    [
      qrUploadRequest(channel.version, "large.png", new Uint8Array(5_000_001), "Reject an oversized QR image upload"),
      "MEDIA_FILE_TOO_LARGE",
    ],
  ]) {
    const r2 = memoryR2();
    await assert.rejects(
      uploadWechatQr({ DB: baseDb, MEDIA: r2 }, request, channel.id, actor),
      (error) => error instanceof ApiInputError && error.code === code,
    );
    assert.equal(r2.size(), 0);
  }

  const r2 = memoryR2();
  const failingDb = {
    ...baseDb,
    async batch() {
      throw new Error("D1 batch failed for compensation test");
    },
  };
  await assert.rejects(
    uploadWechatQr(
      { DB: failingDb, MEDIA: r2 },
      qrUploadRequest(channel.version, "compensated.png", pngBytes, "Compensate the new R2 QR after D1 failure"),
      channel.id,
      actor,
    ),
    /D1 batch failed/u,
  );
  assert.equal(r2.size(), 0);
  assert.equal(sqlite.prepare("SELECT COUNT(*) AS count FROM media_objects").get().count, 0);
  assert.equal(
    sqlite.prepare("SELECT direct_target AS directTarget FROM merchant_channels WHERE id = ?")
      .get(channel.id).directTarget,
    null,
  );
});

test("media upload rejects a spoofed image before writing R2 or D1", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migration);
  const r2 = memoryR2();
  const env = {
    DB: d1Adapter(sqlite),
    MEDIA: r2,
  };
  const form = new FormData();
  form.set(
    "file",
    new File(["not an image"], "spoofed.png", { type: "image/png" }),
  );
  form.set("reason", "Reject a spoofed upload during validation");

  await assert.rejects(
    uploadManagedMedia(
      env,
      new Request("https://example.test/v1/admin/media", {
        method: "POST",
        body: form,
      }),
      actor,
    ),
    (error) => error instanceof ApiInputError && error.code === "MEDIA_FILE_TYPE_INVALID",
  );
  assert.equal(r2.size(), 0);
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM media_objects").get().count,
    0,
  );
});

function uploadRequest(name, reason) {
  const form = new FormData();
  form.set("file", new File([pngBytes], name, { type: "image/png" }));
  form.set("reason", reason);
  return new Request("https://example.test/v1/admin/media", {
    method: "POST",
    body: form,
  });
}

function replaceRequest(sourcePath, name, reason) {
  const form = new FormData();
  form.set("sourcePath", sourcePath);
  form.set("file", new File([pngBytes], name, { type: "image/png" }));
  form.set("reason", reason);
  return new Request("https://example.test/v1/admin/media/replace", {
    method: "POST",
    body: form,
  });
}

function deleteRequest(reason) {
  return new Request("https://example.test/v1/admin/media/object", {
    method: "DELETE",
    body: JSON.stringify({ reason }),
    headers: { "content-type": "application/json" },
  });
}

function qrUploadRequest(version, name, bytes, reason) {
  const form = new FormData();
  form.set("file", new File([bytes], name, { type: "image/png" }));
  form.set("version", String(version));
  form.set("reason", reason);
  return new Request("https://example.test/v1/admin/contact-channels/wechat/qr", {
    method: "POST",
    body: form,
  });
}

function jsonRequest(method, body) {
  return new Request("https://example.test/v1/admin/contact-channels/wechat/qr", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function seedReferences(sqlite) {
  const now = "2026-07-29T00:00:00.000Z";
  sqlite.prepare(
    "INSERT INTO categories (id, slug, status, sort_order, version, created_at, updated_at) VALUES (?, ?, 'ACTIVE', 1, 1, ?, ?)",
  ).run("category-test", "test", now, now);
  sqlite.prepare(
    `INSERT INTO products
      (id, slug, category_id, image_key, base_price, compare_at_price,
       stock_mode, stock_quantity, status, sort_order, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, '89.00', NULL, 'FINITE', 8, 'ACTIVE', 1, 1, ?, ?)`,
  ).run(
    "product-test",
    "product-test",
    "category-test",
    "/assets/shared.webp",
    now,
    now,
  );
  sqlite.prepare(
    `INSERT INTO heroes
      (id, key, image_key, target_slug, tone, status, sort_order, version, created_at, updated_at)
     VALUES (?, ?, ?, NULL, 'cyan', 'ACTIVE', 1, 1, ?, ?)`,
  ).run(
    "hero-test",
    "hero-test",
    "/assets/shared.webp",
    now,
    now,
  );
}

function memoryR2() {
  const objects = new Map();
  return {
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: new Response(object.bytes).body,
        httpEtag: object.etag,
        httpMetadata: { contentType: object.contentType },
        writeHttpMetadata(headers) {
          headers.set("content-type", object.contentType);
        },
      };
    },
    async put(key, value, options) {
      const bytes = new Uint8Array(await new Response(value).arrayBuffer());
      objects.set(key, {
        bytes,
        etag: `"${key.length}-${bytes.byteLength}"`,
        contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
      });
    },
    async delete(key) {
      objects.delete(key);
    },
    has(key) {
      return objects.has(key);
    },
    size() {
      return objects.size;
    },
  };
}

function d1Adapter(sqlite) {
  return {
    prepare(query) {
      return statementAdapter(sqlite.prepare(query), query);
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.batchResult());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

function statementAdapter(statement, query) {
  let values = [];
  return {
    bind(...nextValues) {
      values = nextValues;
      return this;
    },
    async first() {
      return statement.get(...values) ?? null;
    },
    async all() {
      return {
        success: true,
        results: statement.all(...values),
        meta: { changes: 0 },
      };
    },
    async run() {
      const result = statement.run(...values);
      return {
        success: true,
        results: [],
        meta: { changes: Number(result.changes) },
      };
    },
    async batchResult() {
      if (/^\s*SELECT\b/iu.test(query)) return this.all();
      return this.run();
    },
  };
}
