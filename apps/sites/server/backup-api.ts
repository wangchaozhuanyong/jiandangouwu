import {
  ApiInputError,
  readJson,
  writeAudit,
  type AdminIdentity,
} from "./http";
import type { D1Database, D1Result, SitesEnv } from "./types";

type BackupMode = "AUTOMATIC" | "MANUAL";
type BackupStatus = "CREATING" | "VERIFIED" | "FAILED";

type BackupRow = {
  id: string;
  scheduleKey: string;
  mode: BackupMode;
  status: BackupStatus;
  objectKey: string;
  schemaVersion: number;
  recordCountsJson: string;
  byteSize: number | null;
  checksumSha256: string | null;
  createdByEmail: string | null;
  reason: string;
  errorCode: string | null;
  createdAt: string;
  verifiedAt: string | null;
};

type SnapshotPayload = {
  format: "cloudbridge-d1-snapshot";
  schemaVersion: number;
  createdAt: string;
  tables: Record<string, ReadonlyArray<Record<string, unknown>>>;
};

type BackupEnvelope = {
  format: "cloudbridge-encrypted-backup";
  version: 1;
  algorithm: "AES-256-GCM";
  createdAt: string;
  iv: string;
  ciphertext: string;
};

const schemaVersion = 2;
const maximumBackupBytes = 20 * 1024 * 1024;
const snapshotTables = [
  "admin_members",
  "audit_events",
  "categories",
  "category_translations",
  "currencies",
  "exchange_rates",
  "hero_translations",
  "heroes",
  "media_objects",
  "merchant_channels",
  "order_status_history",
  "orders",
  "product_translations",
  "products",
  "site_settings",
] as const;

export async function listBackupSnapshots(db: D1Database) {
  const rows = (await db.prepare(
    `SELECT id, schedule_key AS scheduleKey, mode, status,
      object_key AS objectKey, schema_version AS schemaVersion,
      record_counts_json AS recordCountsJson, byte_size AS byteSize,
      checksum_sha256 AS checksumSha256, created_by_email AS createdByEmail,
      reason, error_code AS errorCode, created_at AS createdAt,
      verified_at AS verifiedAt
     FROM backup_snapshots
     ORDER BY created_at DESC, id DESC
     LIMIT 100`,
  ).all<BackupRow>()).results ?? [];
  return rows.map(backupItem);
}

export async function createManualBackup(
  env: SitesEnv,
  request: Request,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const reason = backupReason(body.reason);
  const backup = await createBackup(env, {
    mode: "MANUAL",
    scheduleKey: `manual:${crypto.randomUUID()}`,
    actor,
    reason,
  });
  if (!backup) {
    throw new ApiInputError("BACKUP_CREATE_CONFLICT", "The backup could not be started.", 409);
  }
  return backup;
}

export async function ensureDailyBackup(env: SitesEnv): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const scheduleKey = `daily:${date}`;
  const existing = await env.DB.prepare(
    "SELECT id FROM backup_snapshots WHERE schedule_key = ? LIMIT 1",
  ).bind(scheduleKey).first<{ id: string }>();
  if (existing) return;
  await createBackup(env, {
    mode: "AUTOMATIC",
    scheduleKey,
    actor: null,
    reason: "Automatic daily Sites D1 snapshot",
  });
}

export async function verifyBackupSnapshot(
  env: SitesEnv,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const reason = backupReason(body.reason);
  const row = await backupById(env.DB, id);
  if (!row || row.status !== "VERIFIED" || !row.checksumSha256) {
    throw new ApiInputError("BACKUP_NOT_VERIFIABLE", "The backup is not available for verification.", 409);
  }
  const object = await env.MEDIA.get(row.objectKey);
  if (!object) {
    throw new ApiInputError("BACKUP_OBJECT_MISSING", "The backup object is missing.", 409);
  }
  const envelopeText = await new Response(object.body).text();
  const checksum = await sha256Hex(envelopeText);
  if (checksum !== row.checksumSha256) {
    throw new ApiInputError("BACKUP_CHECKSUM_MISMATCH", "The backup checksum does not match.", 409);
  }
  const payload = await decryptSnapshot(envelopeText, env.CLOUDBRIDGE_DATA_KEY);
  validateSnapshot(payload, safeRecordCounts(row.recordCountsJson));
  const verifiedAt = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE backup_snapshots SET verified_at = ?, error_code = NULL WHERE id = ?",
  ).bind(verifiedAt, id).run();
  await writeAudit(env.DB, {
    action: "backup.snapshot.verified",
    result: "SUCCEEDED",
    actor,
    targetType: "BACKUP",
    targetId: id,
    reason,
  });
  const updated = await backupById(env.DB, id);
  if (!updated) throw new ApiInputError("BACKUP_NOT_FOUND", "The backup was not found.", 404);
  return backupItem(updated);
}

export async function downloadBackupSnapshot(
  env: SitesEnv,
  id: string,
): Promise<Response> {
  const row = await backupById(env.DB, id);
  if (!row || row.status !== "VERIFIED") {
    throw new ApiInputError("BACKUP_NOT_FOUND", "The backup was not found.", 404);
  }
  const object = await env.MEDIA.get(row.objectKey);
  if (!object) {
    throw new ApiInputError("BACKUP_OBJECT_MISSING", "The backup object is missing.", 409);
  }
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", "application/vnd.cloudbridge.backup+json");
  headers.set(
    "content-disposition",
    `attachment; filename="cloudbridge-backup-${row.createdAt.slice(0, 10)}-${row.id.slice(0, 8)}.cbk"`,
  );
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function createBackup(
  env: SitesEnv,
  input: {
    mode: BackupMode;
    scheduleKey: string;
    actor: AdminIdentity | null;
    reason: string;
  },
) {
  requireBackupKey(env.CLOUDBRIDGE_DATA_KEY);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const objectKey = `backups/${createdAt.slice(0, 10)}/${id}.cbk`;
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO backup_snapshots
      (id, schedule_key, mode, status, object_key, schema_version,
       record_counts_json, byte_size, checksum_sha256, created_by_email,
       reason, error_code, created_at, verified_at)
     VALUES (?, ?, ?, 'CREATING', ?, ?, '{}', NULL, NULL, ?, ?, NULL, ?, NULL)`,
  ).bind(
    id,
    input.scheduleKey,
    input.mode,
    objectKey,
    schemaVersion,
    input.actor?.email ?? null,
    input.reason,
    createdAt,
  ).run();
  if (changes(inserted) !== 1) return null;

  let objectWritten = false;
  try {
    const exported = await env.DB.batch<Record<string, unknown>>(
      snapshotTables.map((table) => env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid ASC`)),
    );
    const tables = Object.fromEntries(snapshotTables.map((table, index) => [
      table,
      exported[index]?.results ?? [],
    ])) as SnapshotPayload["tables"];
    const recordCounts = Object.fromEntries(
      Object.entries(tables).map(([table, rows]) => [table, rows.length]),
    );
    const payload: SnapshotPayload = {
      format: "cloudbridge-d1-snapshot",
      schemaVersion,
      createdAt,
      tables,
    };
    const envelopeText = await encryptSnapshot(payload, env.CLOUDBRIDGE_DATA_KEY);
    const byteSize = new TextEncoder().encode(envelopeText).byteLength;
    if (byteSize > maximumBackupBytes) {
      throw new ApiInputError("BACKUP_TOO_LARGE", "The backup exceeds the safe worker limit.", 413);
    }
    const checksum = await sha256Hex(envelopeText);
    await env.MEDIA.put(objectKey, envelopeText, {
      httpMetadata: { contentType: "application/vnd.cloudbridge.backup+json" },
    });
    objectWritten = true;
    const stored = await env.MEDIA.get(objectKey);
    if (!stored) throw new Error("R2 verification read failed");
    const storedText = await new Response(stored.body).text();
    if (await sha256Hex(storedText) !== checksum) {
      throw new Error("R2 verification checksum failed");
    }
    validateSnapshot(
      await decryptSnapshot(storedText, env.CLOUDBRIDGE_DATA_KEY),
      recordCounts,
    );
    const verifiedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE backup_snapshots
       SET status = 'VERIFIED', record_counts_json = ?, byte_size = ?,
         checksum_sha256 = ?, error_code = NULL, verified_at = ?
       WHERE id = ? AND status = 'CREATING'`,
    ).bind(
      JSON.stringify(recordCounts),
      byteSize,
      checksum,
      verifiedAt,
      id,
    ).run();
    await writeAudit(env.DB, {
      action: "backup.snapshot.created",
      result: "SUCCEEDED",
      actor: input.actor,
      targetType: "BACKUP",
      targetId: id,
      reason: input.reason,
    });
    const row = await backupById(env.DB, id);
    return row ? backupItem(row) : null;
  } catch (error) {
    if (objectWritten) await env.MEDIA.delete(objectKey).catch(() => undefined);
    const errorCode = error instanceof ApiInputError ? error.code : "BACKUP_CREATE_FAILED";
    await env.DB.prepare(
      "UPDATE backup_snapshots SET status = 'FAILED', error_code = ? WHERE id = ?",
    ).bind(errorCode, id).run();
    await writeAudit(env.DB, {
      action: "backup.snapshot.created",
      result: "FAILED",
      actor: input.actor,
      targetType: "BACKUP",
      targetId: id,
      reason: input.reason,
    });
    if (error instanceof ApiInputError) throw error;
    throw new ApiInputError("BACKUP_CREATE_FAILED", "The encrypted backup could not be created.", 500);
  }
}

async function backupById(db: D1Database, id: string): Promise<BackupRow | null> {
  return db.prepare(
    `SELECT id, schedule_key AS scheduleKey, mode, status,
      object_key AS objectKey, schema_version AS schemaVersion,
      record_counts_json AS recordCountsJson, byte_size AS byteSize,
      checksum_sha256 AS checksumSha256, created_by_email AS createdByEmail,
      reason, error_code AS errorCode, created_at AS createdAt,
      verified_at AS verifiedAt
     FROM backup_snapshots WHERE id = ? LIMIT 1`,
  ).bind(id).first<BackupRow>();
}

function backupItem(row: BackupRow) {
  const recordCounts = safeRecordCounts(row.recordCountsJson);
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    schemaVersion: row.schemaVersion,
    recordCounts,
    recordCount: Object.values(recordCounts).reduce((sum, count) => sum + count, 0),
    byteSize: row.byteSize,
    checksumSha256: row.checksumSha256,
    createdByEmail: row.createdByEmail,
    reason: row.reason,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt,
    downloadable: row.status === "VERIFIED",
  };
}

async function encryptSnapshot(
  payload: SnapshotPayload,
  encodedKey: string | undefined,
): Promise<string> {
  const key = await importBackupKey(encodedKey, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const envelope: BackupEnvelope = {
    format: "cloudbridge-encrypted-backup",
    version: 1,
    algorithm: "AES-256-GCM",
    createdAt: payload.createdAt,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
}

async function decryptSnapshot(
  envelopeText: string,
  encodedKey: string | undefined,
): Promise<SnapshotPayload> {
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(envelopeText) as BackupEnvelope;
  } catch {
    throw new ApiInputError("BACKUP_FORMAT_INVALID", "The backup envelope is invalid.", 409);
  }
  if (
    envelope.format !== "cloudbridge-encrypted-backup"
    || envelope.version !== 1
    || envelope.algorithm !== "AES-256-GCM"
    || !envelope.iv
    || !envelope.ciphertext
  ) {
    throw new ApiInputError("BACKUP_FORMAT_INVALID", "The backup envelope is invalid.", 409);
  }
  const key = await importBackupKey(encodedKey, ["decrypt"]);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64Url(envelope.iv) },
      key,
      decodeBase64Url(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(decrypted)) as SnapshotPayload;
  } catch {
    throw new ApiInputError("BACKUP_DECRYPTION_FAILED", "The backup could not be decrypted.", 409);
  }
}

function validateSnapshot(
  payload: SnapshotPayload,
  expectedCounts: Record<string, number>,
): void {
  if (
    payload.format !== "cloudbridge-d1-snapshot"
    || payload.schemaVersion !== schemaVersion
    || !payload.tables
  ) {
    throw new ApiInputError("BACKUP_PAYLOAD_INVALID", "The backup payload is invalid.", 409);
  }
  for (const table of snapshotTables) {
    const rows = payload.tables[table];
    if (!Array.isArray(rows) || rows.length !== expectedCounts[table]) {
      throw new ApiInputError("BACKUP_RECORD_COUNT_MISMATCH", "The backup record counts do not match.", 409);
    }
  }
}

async function importBackupKey(
  encodedKey: string | undefined,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  const keyBytes = requireBackupKey(encodedKey);
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, usages);
}

function requireBackupKey(encodedKey: string | undefined): ArrayBuffer {
  if (!encodedKey) {
    throw new ApiInputError("BACKUP_ENCRYPTION_NOT_CONFIGURED", "Backup encryption is not configured.", 503);
  }
  const keyBytes = decodeBase64Url(encodedKey);
  if (keyBytes.byteLength !== 32) {
    throw new ApiInputError("BACKUP_ENCRYPTION_INVALID", "Backup encryption is unavailable.", 503);
  }
  return keyBytes;
}

function backupReason(value: unknown): string {
  if (typeof value !== "string") throw invalidReason();
  const reason = value.trim();
  if (reason.length < 8 || reason.length > 500) throw invalidReason();
  return reason;
}

function invalidReason(): ApiInputError {
  return new ApiInputError(
    "VALIDATION_FAILED",
    "A backup reason between 8 and 500 characters is required.",
    422,
    [{ field: "reason", code: "INVALID", message: "reason is invalid." }],
  );
}

function safeRecordCounts(value: string): Record<string, number> {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, count]) => [
        key,
        Number.isSafeInteger(count) && Number(count) >= 0 ? Number(count) : 0,
      ]),
    );
  } catch {
    return {};
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function decodeBase64Url(value: string): ArrayBuffer {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function changes(result: D1Result<unknown>): number {
  return Number(result.meta?.changes ?? result.meta?.rows_written ?? 0);
}
