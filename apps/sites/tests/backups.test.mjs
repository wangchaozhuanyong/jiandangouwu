import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  completeBackupRestoreDrill,
  createBackupRestoreDrillTransfer,
  downloadBackupSnapshot,
  ensureDailyBackup,
  getBackupReadiness,
  listBackupSnapshots,
  validateBackupRestorePackage,
  verifyBackupSnapshot,
} from "../server/backup-api.ts";
import {
  prepareRestoreDrill,
  runIsolatedRestoreDrill,
} from "../../../scripts/sites-restore-drill.mjs";

const migrations = [
  "0000_salty_fat_cobra.sql",
  "0001_robust_mole_man.sql",
  "0002_fix_storefront_design_data.sql",
  "0003_chunky_tattoo.sql",
].map((name) => readFileSync(
  new URL(`../drizzle/${name}`, import.meta.url),
  "utf8",
).replaceAll("--> statement-breakpoint", "")).join("\n");

test("daily D1 backups are encrypted, stored in R2, verified, and not duplicated", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrations);
  const r2 = memoryR2();
  const dataKey = base64Url(new Uint8Array(32).fill(7));
  const env = {
    DB: d1Adapter(sqlite),
    MEDIA: r2,
    CLOUDBRIDGE_DATA_KEY: dataKey,
  };
  await seedRecoverableOrder(sqlite, dataKey);

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

  const readinessBefore = await getBackupReadiness(env.DB);
  assert.equal(readinessBefore.state, "ATTENTION");
  assert.equal(
    readinessBefore.gates.find((gate) => gate.code === "RECENT_ISOLATED_RESTORE_DRILL")?.state,
    "FAIL",
  );

  const restoreValidated = await validateBackupRestorePackage(
    env,
    new Request("https://example.test/v1/admin/backups/restore-validation", {
      method: "POST",
      body: JSON.stringify({ reason: "Validate restore package before public launch" }),
    }),
    backups[0].id,
    {
      id: "admin-test",
      email: "owner@example.test",
      displayName: "Owner",
      permissions: ["settings.write"],
    },
  );
  assert.equal(restoreValidated.restoreValidationStatus, "PASSED");
  assert.equal(restoreValidated.restoreValidation.kind, "LOGICAL_PACKAGE");
  assert.equal(restoreValidated.restoreValidation.tableCount, 15);
  assert.equal(restoreValidated.restoreValidation.encryptedContactChecks, 1);
  assert.ok(restoreValidated.restoreValidation.relationshipChecks > 0);

  const readinessAfterLogicalValidation = await getBackupReadiness(env.DB);
  assert.equal(readinessAfterLogicalValidation.state, "ATTENTION");
  assert.equal(
    readinessAfterLogicalValidation.gates.find(
      (gate) => gate.code === "RECENT_ISOLATED_RESTORE_DRILL",
    )?.state,
    "FAIL",
  );

  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const drillTransfer = await createBackupRestoreDrillTransfer(
    env,
    new Request("https://example.test/v1/admin/backups/restore-drill-transfer", {
      method: "POST",
      body: JSON.stringify({
        reason: "Create an encrypted isolated restore drill transfer",
        publicKey: publicKey.export({ format: "jwk" }),
      }),
    }),
    backups[0].id,
    {
      id: "admin-test",
      email: "owner@example.test",
      displayName: "Owner",
      permissions: ["settings.write"],
    },
  );
  assert.equal(drillTransfer.format, "cloudbridge-restore-drill-transfer");
  assert.doesNotMatch(JSON.stringify(drillTransfer), /OpenAI Codex Professional/u);
  const isolatedDrill = runIsolatedRestoreDrill({
    transfer: drillTransfer,
    privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
  });
  assert.deepEqual(isolatedDrill.summary, {
    target: "NODE_SQLITE_MEMORY",
    tableCount: 15,
    recordCount: restoreValidated.restoreValidation.recordCount,
    foreignKeyViolationCount: 0,
    completedAt: isolatedDrill.summary.completedAt,
  });
  const tamperedCompletion = structuredClone(isolatedDrill.completion);
  tamperedCompletion.result.readbackRecordCount += 1;
  await assert.rejects(
    completeBackupRestoreDrill(
      env,
      new Request("https://example.test/v1/admin/backups/restore-drill-complete", {
        method: "POST",
        body: JSON.stringify({
          ...tamperedCompletion,
          reason: "Reject a forged isolated restore drill result",
        }),
      }),
      backups[0].id,
      {
        id: "admin-test",
        email: "owner@example.test",
        displayName: "Owner",
        permissions: ["settings.write"],
      },
    ),
    (error) => error?.code === "BACKUP_RESTORE_DRILL_RESULT_INVALID",
  );
  const drillCompleted = await completeBackupRestoreDrill(
    env,
    new Request("https://example.test/v1/admin/backups/restore-drill-complete", {
      method: "POST",
      body: JSON.stringify({
        ...isolatedDrill.completion,
        reason: "Record the successful isolated SQLite restore drill",
      }),
    }),
    backups[0].id,
    {
      id: "admin-test",
      email: "owner@example.test",
      displayName: "Owner",
      permissions: ["settings.write"],
    },
  );
  assert.equal(drillCompleted.restoreValidationStatus, "PASSED");
  assert.equal(drillCompleted.restoreValidation.kind, "ISOLATED_SQLITE");
  assert.equal(drillCompleted.restoreValidation.foreignKeyViolationCount, 0);
  assert.equal(
    drillCompleted.restoreValidation.readbackRecordCount,
    drillCompleted.restoreValidation.recordCount,
  );

  const readinessAfterDrill = await getBackupReadiness(env.DB);
  assert.equal(readinessAfterDrill.state, "ATTENTION");
  assert.equal(
    readinessAfterDrill.gates.find(
      (gate) => gate.code === "RECENT_ISOLATED_RESTORE_DRILL",
    )?.state,
    "PASS",
  );
  assert.equal(
    readinessAfterDrill.gates.find(
      (gate) => gate.code === "EXTERNAL_ALERT_DELIVERY",
    )?.state,
    "FAIL",
  );
  assert.deepEqual(readinessAfterDrill.externalAlerting, {
    state: "NOT_CONNECTED",
    configuredChannels: 0,
    lastDeliveryVerifiedAt: null,
  });

  const download = await downloadBackupSnapshot(env, backups[0].id);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition") ?? "", /attachment/u);
  assert.equal(download.headers.get("cache-control"), "private, no-store");
  assert.doesNotMatch(await download.text(), /OpenAI Codex Professional/u);
});

test("restore-package validation fails closed on broken table relationships", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrations);
  sqlite.exec("PRAGMA foreign_keys = OFF");
  sqlite.prepare(
    `INSERT INTO products
      (id, slug, category_id, image_key, base_price, compare_at_price,
       stock_mode, stock_quantity, status, sort_order, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, 'UNLIMITED', NULL, 'DRAFT', 99, 1, ?, ?)`,
  ).run(
    "product-orphan",
    "orphan",
    "category-missing",
    "/assets/product-codex.webp",
    "1.00",
    "2026-07-29T00:00:00.000Z",
    "2026-07-29T00:00:00.000Z",
  );
  const env = {
    DB: d1Adapter(sqlite),
    MEDIA: memoryR2(),
    CLOUDBRIDGE_DATA_KEY: base64Url(new Uint8Array(32).fill(9)),
  };
  await ensureDailyBackup(env);
  const [backup] = await listBackupSnapshots(env.DB);

  await assert.rejects(
    validateBackupRestorePackage(
      env,
      new Request("https://example.test/v1/admin/backups/restore-validation", {
        method: "POST",
        body: JSON.stringify({ reason: "Detect an invalid restore relationship" }),
      }),
      backup.id,
      {
        id: "admin-test",
        email: "owner@example.test",
        displayName: "Owner",
        permissions: ["settings.write"],
      },
    ),
    (error) => error?.code === "BACKUP_RESTORE_RELATION_INVALID",
  );
  const [failed] = await listBackupSnapshots(env.DB);
  assert.equal(failed.restoreValidationStatus, "FAILED");
  assert.equal(failed.restoreValidationErrorCode, "BACKUP_RESTORE_RELATION_INVALID");
});

test("restore drill runner protects ephemeral private-key state from overwrite", () => {
  const stateDirectory = mkdtempSync(join(tmpdir(), "cloudbridge-restore-test-"));
  try {
    const prepared = prepareRestoreDrill(stateDirectory);
    assert.equal(statSync(prepared.privateKeyPath).mode & 0o777, 0o600);
    assert.equal(statSync(prepared.requestPath).mode & 0o777, 0o600);
    assert.throws(
      () => prepareRestoreDrill(stateDirectory),
      (error) => error?.code === "EEXIST",
    );
  } finally {
    rmSync(stateDirectory, { recursive: true, force: true });
  }
});

async function seedRecoverableOrder(sqlite, dataKey) {
  const now = "2026-07-29T00:15:00.000Z";
  sqlite.prepare(
    `INSERT INTO admin_members
      (id, email, display_name, status, permissions_json, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
  ).run(
    "admin-test",
    "owner@example.test",
    "Owner",
    JSON.stringify(["settings.read", "settings.write"]),
    now,
    now,
    now,
  );
  const encryptedContact = await encryptContact("owner@example.test", dataKey);
  sqlite.prepare(
    `INSERT INTO orders
      (id, order_number, idempotency_key, product_id, product_name_snapshot,
       currency_code, amount, reference_currency_code, reference_amount,
       exchange_rate_snapshot, product_version, contact_channel, contact_encrypted,
       contact_hash, masked_contact, accepted_policy_version, status, payment_mode,
       reserved_until, inventory_reserved, inventory_released_at, assigned_to_id,
       created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'MANUAL_PENDING',
       'MANUAL', ?, 1, NULL, ?, ?, ?)`,
  ).run(
    "order-test",
    "CB20260729TEST0001",
    "idempotency-test",
    "product-codex",
    "OpenAI Codex Professional",
    "MYR",
    "89.00",
    "USDT",
    "20.00",
    "1.00000000",
    1,
    "EMAIL",
    encryptedContact,
    "a".repeat(64),
    "ow***@example.test",
    "2026-07-29",
    "2026-07-29T00:45:00.000Z",
    "admin-test",
    now,
    now,
  );
  sqlite.prepare(
    `INSERT INTO order_status_history
      (id, order_id, from_status, to_status, reason, actor_email, created_at)
     VALUES (?, ?, NULL, 'MANUAL_PENDING', ?, NULL, ?)`,
  ).run("history-test", "order-test", "Storefront order created", now);
}

async function encryptContact(value, dataKey) {
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(dataKey, "base64url"),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = new Uint8Array(12).fill(3);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(encrypted).toString("base64url")}`;
}

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
