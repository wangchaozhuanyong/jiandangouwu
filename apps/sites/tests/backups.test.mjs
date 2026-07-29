import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  downloadBackupSnapshot,
  ensureDailyBackup,
  listBackupSnapshots,
  verifyBackupSnapshot,
} from "../server/backup-api.ts";

const migrations = [
  "0000_salty_fat_cobra.sql",
  "0001_robust_mole_man.sql",
].map((name) => readFileSync(
  new URL(`../drizzle/${name}`, import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "")).join("\n");

test("daily D1 backups are encrypted, stored in R2, verified, and not duplicated", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrations);
  const r2 = memoryR2();
  const env = {
    DB: d1Adapter(sqlite),
    MEDIA: r2,
    CLOUDBRIDGE_DATA_KEY: base64Url(new Uint8Array(32).fill(7)),
  };

  await ensureDailyBackup(env);
  await ensureDailyBackup(env);

  const backups = await listBackupSnapshots(env.DB);
  assert.equal(backups.length, 1);
  assert.equal(backups[0].mode, "AUTOMATIC");
  assert.equal(backups[0].status, "VERIFIED");
  assert.equal(backups[0].downloadable, true);
  assert.ok(backups[0].recordCount > 0);
  assert.ok(Number(backups[0].byteSize) > 0);
  assert.match(backups[0].checksumSha256, /^[a-f0-9]{64}$/u);
  assert.equal(r2.size(), 1);
  assert.doesNotMatch(r2.firstValue(), /OpenAI Codex Professional/u);

  const verified = await verifyBackupSnapshot(
    env,
    new Request("https://example.test/v1/admin/backups/verify", {
      method: "POST",
      body: JSON.stringify({ reason: "Verify before public launch" }),
    }),
    backups[0].id,
    {
      id: "admin-test",
      email: "owner@example.test",
      displayName: "Owner",
      permissions: ["settings.write"],
    },
  );
  assert.equal(verified.status, "VERIFIED");
  assert.ok(verified.verifiedAt);

  const download = await downloadBackupSnapshot(env, backups[0].id);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition") ?? "", /attachment/u);
  assert.equal(download.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(await download.text(), /OpenAI Codex Professional/u);
});

function memoryR2() {
  const objects = new Map();
  return {
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: new Response(object.value).body,
        httpEtag: object.etag,
        writeHttpMetadata(headers) {
          headers.set("content-type", object.contentType);
        },
      };
    },
    async put(key, value, options) {
      const text = typeof value === "string"
        ? value
        : await new Response(value).text();
      objects.set(key, {
        value: text,
        etag: `"${key.length}-${text.length}"`,
        contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
      });
    },
    async delete(key) {
      objects.delete(key);
    },
    size() {
      return objects.size;
    },
    firstValue() {
      return objects.values().next().value?.value ?? "";
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
      return { success: true, results: statement.all(...values), meta: { changes: 0 } };
    },
    async run() {
      const result = statement.run(...values);
      return { success: true, results: [], meta: { changes: Number(result.changes) } };
    },
    async batchResult() {
      if (/^\s*SELECT\b/iu.test(query)) return this.all();
      return this.run();
    },
  };
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}
