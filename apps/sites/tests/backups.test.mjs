import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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
import { handleAdminApi } from "../server/admin-api.ts";
import {
  decodeBase64Url,
  deriveSitesAesKey,
  sitesDataAdditionalData,
  sitesDataAdditionalDataV3,
} from "../server/data-protection.ts";
import {
  prepareRestoreDrill,
  runIsolatedRestoreDrill,
} from "../../../scripts/sites-restore-drill.mjs";

const migrations = [
  "0000_salty_fat_cobra.sql",
  "0001_robust_mole_man.sql",
  "0002_fix_storefront_design_data.sql",
  "0003_chunky_tattoo.sql",
  "0004_sweet_adam_warlock.sql",
  "0005_concerned_war_machine.sql",
  "0006_nice_doctor_faustus.sql",
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
  assert.equal(JSON.parse(r2.firstValue()).version, 3);

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

  const readinessBefore = await getBackupReadiness(env);
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
  assert.equal(restoreValidated.restoreValidation.tableCount, 20);
  assert.equal(restoreValidated.restoreValidation.encryptedContactChecks, 1);
  assert.ok(restoreValidated.restoreValidation.relationshipChecks > 0);

  const readinessAfterLogicalValidation = await getBackupReadiness(env);
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
  const [tokenPayload] = drillTransfer.drillToken.split(".");
  assert.equal(
    JSON.parse(Buffer.from(tokenPayload, "base64url").toString("utf8")).version,
    2,
  );
  assert.equal(drillTransfer.format, "cloudbridge-restore-drill-transfer");
  assert.doesNotMatch(JSON.stringify(drillTransfer), /OpenAI Codex Professional/u);
  assert.equal(
    Number(sqlite.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action = ? AND result = 'SUCCEEDED'",
    ).get("backup.restore-drill.transfer-created")?.count ?? 0),
    1,
  );
  const isolatedDrill = runIsolatedRestoreDrill({
    transfer: drillTransfer,
    privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
  });
  assert.deepEqual(isolatedDrill.summary, {
    target: "NODE_SQLITE_MEMORY",
    tableCount: 20,
    recordCount: restoreValidated.restoreValidation.recordCount,
    foreignKeyViolationCount: 0,
    completedAt: isolatedDrill.summary.completedAt,
  });
  const candidateRoot = mkdtempSync(join(tmpdir(), "cloudbridge-d1-candidate-test-"));
  const candidateDirectory = join(candidateRoot, "candidate");
  try {
    const candidateDrill = runIsolatedRestoreDrill({
      transfer: drillTransfer,
      privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
      d1CandidateDirectory: candidateDirectory,
    });
    const candidate = candidateDrill.summary.d1Candidate;
    assert.equal(candidate.productionD1Modified, false);
    assert.equal(candidate.cutoverCompleted, false);
    assert.equal(candidate.recordCount, restoreValidated.restoreValidation.recordCount);
    assert.equal(statSync(candidateDirectory).mode & 0o777, 0o700);
    for (const path of [
      candidate.manifestPath,
      candidate.restoreSqlPath,
      candidate.verifySqlPath,
      join(candidateDirectory, "RUNBOOK.md"),
    ]) {
      assert.equal(statSync(path).mode & 0o777, 0o600);
    }
    const manifest = JSON.parse(readFileSync(candidate.manifestPath, "utf8"));
    const restoreSql = readFileSync(candidate.restoreSqlPath, "utf8");
    assert.equal(manifest.format, "cloudbridge-d1-import-candidate");
    assert.equal(manifest.target, "CLOUDFLARE_D1_NEW_DATABASE");
    assert.equal(manifest.boundaries.productionD1Modified, false);
    assert.equal(manifest.boundaries.containsPlaintextBusinessData, true);
    assert.equal(manifest.boundaries.r2ObjectsIncluded, false);
    assert.equal(manifest.boundaries.backupHistoryIncluded, false);
    assert.equal(
      manifest.files.restoreSqlSha256,
      createHash("sha256").update(restoreSql).digest("hex"),
    );
    assert.match(restoreSql, /PRAGMA defer_foreign_keys = true;/u);
    assert.doesNotMatch(restoreSql, /^(?:BEGIN|COMMIT)\b/gmu);
    assert.match(restoreSql, /Owner''s review;\nnext/u);
    assert.doesNotMatch(restoreSql, /customer-contact@example\.test/u);
    const restoredCandidate = new DatabaseSync(":memory:");
    try {
      restoredCandidate.exec(restoreSql);
      assert.equal(
        restoredCandidate.prepare("PRAGMA foreign_key_check").all().length,
        0,
      );
      assert.equal(
        Number(restoredCandidate.prepare("SELECT COUNT(*) AS count FROM orders").get()?.count),
        1,
      );
      assert.equal(
        Number(restoredCandidate.prepare("SELECT COUNT(*) AS count FROM products").get()?.count),
        manifest.validation.recordCounts.products,
      );
    } finally {
      restoredCandidate.close();
    }
    const wranglerConfigPath = join(candidateRoot, "wrangler.jsonc");
    const wranglerStatePath = join(candidateRoot, "wrangler-state");
    writeFileSync(wranglerConfigPath, JSON.stringify({
      name: "cloudbridge-d1-candidate-test",
      compatibility_date: "2026-07-29",
      d1_databases: [{
        binding: "DB",
        database_name: "cloudbridge-d1-candidate-test",
        database_id: "00000000-0000-0000-0000-000000000001",
      }],
    }), { flag: "wx", mode: 0o600 });
    const wranglerOutput = execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL("../../../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
        "d1",
        "execute",
        "DB",
        "--local",
        "--config",
        wranglerConfigPath,
        "--persist-to",
        wranglerStatePath,
        "--file",
        candidate.restoreSqlPath,
        "--yes",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      },
    );
    assert.match(wranglerOutput, /executed successfully/u);
    const runbook = readFileSync(join(candidateDirectory, "RUNBOOK.md"), "utf8");
    assert.match(runbook, /Never run `restore\.sql` against the current production D1 binding/u);
    assert.match(runbook, /Rollback means restoring the previous D1 binding/u);
    assert.throws(
      () => runIsolatedRestoreDrill({
        transfer: drillTransfer,
        privateKey: privateKey.export({ format: "pem", type: "pkcs8" }),
        d1CandidateDirectory: candidateDirectory,
      }),
      (error) => error?.code === "EEXIST",
    );
  } finally {
    rmSync(candidateRoot, { recursive: true, force: true });
  }
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
  assert.equal(
    Number(sqlite.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action = ? AND result = 'SUCCEEDED'",
    ).get("backup.restore-drill.completed")?.count ?? 0),
    1,
  );

  const readinessAfterDrill = await getBackupReadiness(env);
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
    state: "MISSING_SECRETS",
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

test("legacy v1 backup envelopes remain readable after purpose-separated v2 writes", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrations);
  const r2 = memoryR2();
  const dataKey = base64Url(new Uint8Array(32).fill(11));
  const env = {
    DB: d1Adapter(sqlite),
    MEDIA: r2,
    CLOUDBRIDGE_DATA_KEY: dataKey,
  };

  try {
    await ensureDailyBackup(env);
    const [backup] = await listBackupSnapshots(env.DB);
    const legacyEnvelope = await convertBackupToLegacyV1(r2.firstValue(), dataKey);
    r2.replaceFirstValue(legacyEnvelope);
    sqlite.prepare(
      "UPDATE backup_snapshots SET checksum_sha256 = ?, byte_size = ? WHERE id = ?",
    ).run(
      createHash("sha256").update(legacyEnvelope).digest("hex"),
      Buffer.byteLength(legacyEnvelope),
      backup.id,
    );

    const verified = await verifyBackupSnapshot(
      env,
      new Request("https://example.test/v1/admin/backups/verify", {
        method: "POST",
        body: JSON.stringify({ reason: "Verify a legacy compatible backup" }),
      }),
      backup.id,
      {
        id: "admin-test",
        email: "owner@example.test",
        displayName: "Owner",
        permissions: ["settings.write"],
      },
    );

    assert.equal(verified.status, "VERIFIED");
    assert.equal(JSON.parse(r2.firstValue()).version, 1);
  } finally {
    sqlite.close();
  }
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

test("backup overview stays readable when automatic creation fails before a snapshot row exists", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(migrations);
  const now = "2026-07-30T05:30:00.000Z";
  sqlite.prepare(
    `INSERT INTO admin_members
      (id, email, display_name, status, permissions_json, last_login_at, created_at, updated_at)
     VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?)`,
  ).run(
    "admin-backup-read",
    "owner@example.test",
    "Owner",
    JSON.stringify(["settings.read"]),
    now,
    now,
    now,
  );
  const env = {
    DB: d1Adapter(sqlite),
    MEDIA: memoryR2(),
  };
  const request = () => new Request("https://example.test/v1/admin/backups", {
    headers: {
      "oai-authenticated-user-email": "owner@example.test",
    },
  });

  const firstResponse = await handleAdminApi(
    request(),
    env,
    "/v1/admin/backups",
  );
  assert.equal(firstResponse.status, 200);
  const firstBody = await firstResponse.json();
  assert.deepEqual(firstBody.data.items, []);
  assert.equal(firstBody.data.readiness.state, "BLOCKED");
  assert.equal(firstBody.data.readiness.externalAlerting.state, "MISSING_SECRETS");

  const secondResponse = await handleAdminApi(
    request(),
    env,
    "/v1/admin/backups",
  );
  assert.equal(secondResponse.status, 200);
  assert.equal(
    Number(sqlite.prepare(
      "SELECT COUNT(*) AS count FROM system_alert_deliveries WHERE source = 'BACKUP'",
    ).get()?.count ?? 0),
    1,
  );
  assert.equal(
    Number(sqlite.prepare(
      "SELECT COUNT(*) AS count FROM audit_events WHERE action = 'backup.snapshot.created' AND result = 'FAILED'",
    ).get()?.count ?? 0),
    1,
  );
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
  sqlite.prepare(
    `INSERT INTO audit_events
      (id, trace_id, action, result, actor_email, actor_display_name,
       target_type, target_id, reason, created_at)
     VALUES (?, ?, ?, 'SUCCEEDED', ?, ?, 'BACKUP', ?, ?, ?)`,
  ).run(
    "audit-test",
    "trace-test",
    "backup.restore.candidate",
    "owner@example.test",
    "Owner",
    "backup-test",
    "Owner's review;\nnext",
    now,
  );
  const encryptedContact = await encryptContact("customer-contact@example.test", dataKey);
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

async function convertBackupToLegacyV1(envelopeText, dataKey) {
  const envelope = JSON.parse(envelopeText);
  assert.equal(envelope.version, 3);
  const currentKey = await deriveSitesAesKey(
    dataKey,
    "BACKUP_SNAPSHOT",
    "BACKUP",
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(envelope.iv),
      additionalData: sitesDataAdditionalDataV3("BACKUP_SNAPSHOT", envelope.keyId),
    },
    currentKey,
    decodeBase64Url(envelope.ciphertext),
  );
  const legacyKey = await crypto.subtle.importKey(
    "raw",
    Buffer.from(dataKey, "base64url"),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = new Uint8Array(12).fill(5);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    legacyKey,
    plaintext,
  );
  return JSON.stringify({
    format: envelope.format,
    version: 1,
    algorithm: envelope.algorithm,
    createdAt: envelope.createdAt,
    iv: Buffer.from(iv).toString("base64url"),
    ciphertext: Buffer.from(ciphertext).toString("base64url"),
  });
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
    replaceFirstValue(value) {
      const first = objects.entries().next().value;
      if (!first) throw new Error("No R2 object is available.");
      const [key, object] = first;
      objects.set(key, {
        ...object,
        value,
        etag: `"${key.length}-${value.length}"`,
      });
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
