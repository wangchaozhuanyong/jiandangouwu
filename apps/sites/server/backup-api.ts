import {
  ApiInputError,
  readJson,
  writeAudit,
  type AdminIdentity,
} from "./http";
import type { D1Database, D1Result, SitesEnv } from "./types";

type BackupMode = "AUTOMATIC" | "MANUAL";
type BackupStatus = "CREATING" | "VERIFIED" | "FAILED";
type RestoreValidationStatus = "NOT_RUN" | "PASSED" | "FAILED";

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
  restoreValidationStatus: RestoreValidationStatus;
  restoreValidationJson: string;
  restoreValidatedAt: string | null;
  restoreValidatedByEmail: string | null;
  restoreValidationReason: string | null;
  restoreValidationErrorCode: string | null;
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

type LogicalRestoreValidationDetails = {
  kind: "LOGICAL_PACKAGE";
  tableCount: number;
  recordCount: number;
  relationshipChecks: number;
  encryptedContactChecks: number;
  jsonDocumentChecks: number;
  activeAdministratorCount: number;
};

type IsolatedRestoreDrillDetails = Omit<LogicalRestoreValidationDetails, "kind"> & {
  kind: "ISOLATED_SQLITE";
  drillId: string;
  target: "NODE_SQLITE_MEMORY";
  payloadSha256: string;
  readbackRecordCount: number;
  foreignKeyViolationCount: 0;
  completedAt: string;
};

type RestoreValidationDetails =
  | LogicalRestoreValidationDetails
  | IsolatedRestoreDrillDetails;

type RestoreDrillTokenPayload = {
  format: "cloudbridge-restore-drill-token";
  version: 1;
  backupId: string;
  drillId: string;
  requestedByEmail: string;
  issuedAt: string;
  expiresAt: string;
  challenge: string;
  payloadSha256: string;
  schemaVersion: number;
  tableCount: number;
  recordCount: number;
};

type RestoreDrillResult = {
  drillId: string;
  payloadSha256: string;
  schemaVersion: number;
  tableCount: number;
  recordCount: number;
  readbackRecordCount: number;
  foreignKeyViolationCount: number;
  target: "NODE_SQLITE_MEMORY";
  completedAt: string;
};

const schemaVersion = 2;
const maximumBackupBytes = 20 * 1024 * 1024;
const recentBackupWindowMs = 26 * 60 * 60_000;
const recentIsolatedRestoreDrillWindowMs = 30 * 24 * 60 * 60_000;
const recentFailureWindowMs = 7 * 24 * 60 * 60_000;
const staleCreatingWindowMs = 15 * 60_000;
const restoreDrillTransferWindowMs = 30 * 60_000;
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
      verified_at AS verifiedAt,
      restore_validation_status AS restoreValidationStatus,
      restore_validation_json AS restoreValidationJson,
      restore_validated_at AS restoreValidatedAt,
      restore_validated_by_email AS restoreValidatedByEmail,
      restore_validation_reason AS restoreValidationReason,
      restore_validation_error_code AS restoreValidationErrorCode
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

export async function getBackupReadiness(
  db: D1Database,
  now = new Date(),
) {
  const backups = await listBackupSnapshots(db);
  const checkedAt = now.toISOString();
  const latestVerified = backups.find((backup) => backup.status === "VERIFIED") ?? null;
  const latestAutomatic = backups.find(
    (backup) => backup.status === "VERIFIED" && backup.mode === "AUTOMATIC",
  ) ?? null;
  const latestIsolatedRestoreDrill = backups.find(
    (backup) => (
      backup.restoreValidationStatus === "PASSED"
      && backup.restoreValidation?.kind === "ISOLATED_SQLITE"
    ),
  ) ?? null;
  const recentFailureBoundary = new Date(now.getTime() - recentFailureWindowMs).toISOString();
  const staleCreatingBoundary = new Date(now.getTime() - staleCreatingWindowMs).toISOString();
  const [failedRecentRow, staleCreatingRow] = await Promise.all([
    db.prepare(
      "SELECT COUNT(*) AS count FROM backup_snapshots WHERE status = 'FAILED' AND created_at >= ?",
    ).bind(recentFailureBoundary).first<{ count: number }>(),
    db.prepare(
      "SELECT COUNT(*) AS count FROM backup_snapshots WHERE status = 'CREATING' AND created_at <= ?",
    ).bind(staleCreatingBoundary).first<{ count: number }>(),
  ]);
  const failedRecentCount = Number(failedRecentRow?.count ?? 0);
  const staleCreatingCount = Number(staleCreatingRow?.count ?? 0);
  const recentVerified = isRecent(
    latestVerified?.verifiedAt,
    now,
    recentBackupWindowMs,
  );
  const automaticToday = latestAutomatic?.createdAt.slice(0, 10) === checkedAt.slice(0, 10);
  const isolatedRestoreDrillRecent = isRecent(
    latestIsolatedRestoreDrill?.restoreValidatedAt,
    now,
    recentIsolatedRestoreDrillWindowMs,
  );
  const noRecentFailures = failedRecentCount === 0 && staleCreatingCount === 0;
  const externalAlertingConnected = false;
  const gates = [
    {
      code: "RECENT_VERIFIED_BACKUP",
      state: recentVerified ? "PASS" : "FAIL",
      checkedAt: latestVerified?.verifiedAt ?? null,
    },
    {
      code: "TODAY_AUTOMATIC_BACKUP",
      state: automaticToday ? "PASS" : "FAIL",
      checkedAt: latestAutomatic?.createdAt ?? null,
    },
    {
      code: "NO_RECENT_BACKUP_FAILURE",
      state: noRecentFailures ? "PASS" : "FAIL",
      checkedAt,
    },
    {
      code: "RECENT_ISOLATED_RESTORE_DRILL",
      state: isolatedRestoreDrillRecent ? "PASS" : "FAIL",
      checkedAt: latestIsolatedRestoreDrill?.restoreValidatedAt ?? null,
    },
    {
      code: "EXTERNAL_ALERT_DELIVERY",
      state: externalAlertingConnected ? "PASS" : "FAIL",
      checkedAt: null,
    },
  ] as const;
  return {
    state: !recentVerified
      ? "BLOCKED"
      : gates.every((gate) => gate.state === "PASS")
        ? "READY"
        : "ATTENTION",
    checkedAt,
    latestVerifiedAt: latestVerified?.verifiedAt ?? null,
    latestAutomaticAt: latestAutomatic?.createdAt ?? null,
    latestRestoreValidatedAt: latestIsolatedRestoreDrill?.restoreValidatedAt ?? null,
    failedRecentCount,
    staleCreatingCount,
    gates,
    externalAlerting: {
      state: "NOT_CONNECTED",
      configuredChannels: 0,
      lastDeliveryVerifiedAt: null,
    },
  };
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
  await readVerifiedSnapshot(env, row);
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

export async function validateBackupRestorePackage(
  env: SitesEnv,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const reason = backupReason(body.reason);
  const row = await backupById(env.DB, id);
  if (!row || row.status !== "VERIFIED" || !row.checksumSha256) {
    throw new ApiInputError(
      "BACKUP_NOT_RESTORE_VALIDATABLE",
      "The backup is not available for restore-package validation.",
      409,
    );
  }
  try {
    const payload = await readVerifiedSnapshot(env, row);
    const details = await validateRestorePayload(payload, env.CLOUDBRIDGE_DATA_KEY);
    const validatedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE backup_snapshots
       SET restore_validation_status = 'PASSED', restore_validation_json = ?,
         restore_validated_at = ?, restore_validated_by_email = ?,
         restore_validation_reason = ?, restore_validation_error_code = NULL
       WHERE id = ? AND status = 'VERIFIED'`,
    ).bind(
      JSON.stringify(details),
      validatedAt,
      actor.email,
      reason,
      id,
    ).run();
    await writeAudit(env.DB, {
      action: "backup.restore-package.validated",
      result: "SUCCEEDED",
      actor,
      targetType: "BACKUP",
      targetId: id,
      reason,
    });
    const updated = await backupById(env.DB, id);
    if (!updated) throw new ApiInputError("BACKUP_NOT_FOUND", "The backup was not found.", 404);
    return backupItem(updated);
  } catch (error) {
    const errorCode = error instanceof ApiInputError
      ? error.code
      : "BACKUP_RESTORE_VALIDATION_FAILED";
    await env.DB.prepare(
      `UPDATE backup_snapshots
       SET restore_validation_status = 'FAILED', restore_validation_json = '{}',
         restore_validated_at = ?, restore_validated_by_email = ?,
         restore_validation_reason = ?, restore_validation_error_code = ?
       WHERE id = ?`,
    ).bind(
      new Date().toISOString(),
      actor.email,
      reason,
      errorCode,
      id,
    ).run();
    await writeAudit(env.DB, {
      action: "backup.restore-package.validated",
      result: "FAILED",
      actor,
      targetType: "BACKUP",
      targetId: id,
      reason,
    });
    if (error instanceof ApiInputError) throw error;
    throw new ApiInputError(
      "BACKUP_RESTORE_VALIDATION_FAILED",
      "The backup restore package could not be validated.",
      409,
    );
  }
}

export async function createBackupRestoreDrillTransfer(
  env: SitesEnv,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const reason = backupReason(body.reason);
  const publicKey = await importRestoreDrillPublicKey(body.publicKey);
  const row = await backupById(env.DB, id);
  if (!row || row.status !== "VERIFIED" || !row.checksumSha256) {
    throw new ApiInputError(
      "BACKUP_NOT_RESTORE_VALIDATABLE",
      "The backup is not available for an isolated restore drill.",
      409,
    );
  }

  const payload = await readVerifiedSnapshot(env, row);
  const logicalValidation = await validateRestorePayload(
    payload,
    env.CLOUDBRIDGE_DATA_KEY,
  );
  if (logicalValidation.kind !== "LOGICAL_PACKAGE") {
    throw restoreValidationError("BACKUP_RESTORE_STRUCTURE_INVALID");
  }
  const payloadText = JSON.stringify(payload);
  const payloadSha256 = await sha256Hex(payloadText);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + restoreDrillTransferWindowMs);
  const drillId = crypto.randomUUID();
  const challenge = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const proofKey = await deriveRestoreDrillProofKey(
    env.CLOUDBRIDGE_DATA_KEY,
    drillId,
    challenge,
  );
  const tokenPayload: RestoreDrillTokenPayload = {
    format: "cloudbridge-restore-drill-token",
    version: 1,
    backupId: id,
    drillId,
    requestedByEmail: actor.email,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    challenge,
    payloadSha256,
    schemaVersion: payload.schemaVersion,
    tableCount: logicalValidation.tableCount,
    recordCount: logicalValidation.recordCount,
  };
  const drillToken = await createRestoreDrillToken(
    tokenPayload,
    env.CLOUDBRIDGE_DATA_KEY,
  );
  const transferKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"],
  );
  const rawTransferKey = await crypto.subtle.exportKey("raw", transferKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bundle = {
    format: "cloudbridge-restore-drill-bundle",
    version: 1,
    drillId,
    backupId: id,
    issuedAt: tokenPayload.issuedAt,
    expiresAt: tokenPayload.expiresAt,
    challenge,
    proofKey: encodeBase64Url(new Uint8Array(proofKey)),
    payloadSha256,
    logicalValidation,
    payload,
  };
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    transferKey,
    new TextEncoder().encode(JSON.stringify(bundle)),
  );
  const wrappedKey = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    publicKey,
    rawTransferKey,
  );

  await writeAudit(env.DB, {
    action: "backup.restore-drill.transfer-created",
    result: "SUCCEEDED",
    actor,
    targetType: "BACKUP",
    targetId: id,
    reason,
  });
  return {
    format: "cloudbridge-restore-drill-transfer",
    version: 1,
    algorithm: "RSA-OAEP-SHA256+AES-256-GCM",
    createdAt: tokenPayload.issuedAt,
    expiresAt: tokenPayload.expiresAt,
    drillToken,
    iv: encodeBase64Url(iv),
    wrappedKey: encodeBase64Url(new Uint8Array(wrappedKey)),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  };
}

export async function completeBackupRestoreDrill(
  env: SitesEnv,
  request: Request,
  id: string,
  actor: AdminIdentity,
) {
  const body = await readJson<Record<string, unknown>>(request);
  const reason = backupReason(body.reason);
  const token = typeof body.token === "string" ? body.token : "";
  const proof = typeof body.proof === "string" ? body.proof : "";
  const tokenPayload = await verifyRestoreDrillToken(
    token,
    env.CLOUDBRIDGE_DATA_KEY,
  );
  const now = new Date();
  if (
    tokenPayload.backupId !== id
    || tokenPayload.requestedByEmail !== actor.email
    || !isValidDate(tokenPayload.issuedAt)
    || !isValidDate(tokenPayload.expiresAt)
    || new Date(tokenPayload.expiresAt).getTime() < now.getTime()
  ) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_TOKEN_INVALID");
  }
  const result = restoreDrillResult(body.result);
  const completedAt = new Date(result.completedAt);
  if (
    result.drillId !== tokenPayload.drillId
    || result.payloadSha256 !== tokenPayload.payloadSha256
    || result.schemaVersion !== tokenPayload.schemaVersion
    || result.tableCount !== tokenPayload.tableCount
    || result.recordCount !== tokenPayload.recordCount
    || result.readbackRecordCount !== tokenPayload.recordCount
    || result.foreignKeyViolationCount !== 0
    || result.target !== "NODE_SQLITE_MEMORY"
    || completedAt.getTime() < new Date(tokenPayload.issuedAt).getTime()
    || completedAt.getTime() > new Date(tokenPayload.expiresAt).getTime()
    || completedAt.getTime() > now.getTime() + 5 * 60_000
  ) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_RESULT_INVALID");
  }
  const proofKey = await deriveRestoreDrillProofKey(
    env.CLOUDBRIDGE_DATA_KEY,
    tokenPayload.drillId,
    tokenPayload.challenge,
  );
  if (!await verifyRestoreDrillProof(result, proof, proofKey)) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_PROOF_INVALID");
  }

  const row = await backupById(env.DB, id);
  if (!row || row.status !== "VERIFIED" || !row.checksumSha256) {
    throw restoreValidationError("BACKUP_NOT_RESTORE_VALIDATABLE");
  }
  const payload = await readVerifiedSnapshot(env, row);
  const payloadSha256 = await sha256Hex(JSON.stringify(payload));
  if (payloadSha256 !== tokenPayload.payloadSha256) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_PAYLOAD_CHANGED");
  }
  const logicalValidation = await validateRestorePayload(
    payload,
    env.CLOUDBRIDGE_DATA_KEY,
  );
  if (logicalValidation.kind !== "LOGICAL_PACKAGE") {
    throw restoreValidationError("BACKUP_RESTORE_STRUCTURE_INVALID");
  }
  const details: IsolatedRestoreDrillDetails = {
    ...logicalValidation,
    kind: "ISOLATED_SQLITE",
    drillId: tokenPayload.drillId,
    target: result.target,
    payloadSha256: result.payloadSha256,
    readbackRecordCount: result.readbackRecordCount,
    foreignKeyViolationCount: 0,
    completedAt: result.completedAt,
  };
  await env.DB.prepare(
    `UPDATE backup_snapshots
     SET restore_validation_status = 'PASSED', restore_validation_json = ?,
       restore_validated_at = ?, restore_validated_by_email = ?,
       restore_validation_reason = ?, restore_validation_error_code = NULL
     WHERE id = ? AND status = 'VERIFIED'`,
  ).bind(
    JSON.stringify(details),
    result.completedAt,
    actor.email,
    reason,
    id,
  ).run();
  await writeAudit(env.DB, {
    action: "backup.restore-drill.completed",
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

async function readVerifiedSnapshot(
  env: SitesEnv,
  row: BackupRow,
): Promise<SnapshotPayload> {
  const object = await env.MEDIA.get(row.objectKey);
  if (!object) {
    throw new ApiInputError("BACKUP_OBJECT_MISSING", "The backup object is missing.", 409);
  }
  const envelopeText = await new Response(object.body).text();
  const checksum = await sha256Hex(envelopeText);
  if (!row.checksumSha256 || checksum !== row.checksumSha256) {
    throw new ApiInputError("BACKUP_CHECKSUM_MISMATCH", "The backup checksum does not match.", 409);
  }
  const payload = await decryptSnapshot(envelopeText, env.CLOUDBRIDGE_DATA_KEY);
  validateSnapshot(payload, safeRecordCounts(row.recordCountsJson));
  return payload;
}

async function backupById(db: D1Database, id: string): Promise<BackupRow | null> {
  return db.prepare(
    `SELECT id, schedule_key AS scheduleKey, mode, status,
      object_key AS objectKey, schema_version AS schemaVersion,
      record_counts_json AS recordCountsJson, byte_size AS byteSize,
      checksum_sha256 AS checksumSha256, created_by_email AS createdByEmail,
      reason, error_code AS errorCode, created_at AS createdAt,
      verified_at AS verifiedAt,
      restore_validation_status AS restoreValidationStatus,
      restore_validation_json AS restoreValidationJson,
      restore_validated_at AS restoreValidatedAt,
      restore_validated_by_email AS restoreValidatedByEmail,
      restore_validation_reason AS restoreValidationReason,
      restore_validation_error_code AS restoreValidationErrorCode
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
    restoreValidationStatus: row.restoreValidationStatus,
    restoreValidation: safeRestoreValidation(row.restoreValidationJson),
    restoreValidatedAt: row.restoreValidatedAt,
    restoreValidatedByEmail: row.restoreValidatedByEmail,
    restoreValidationReason: row.restoreValidationReason,
    restoreValidationErrorCode: row.restoreValidationErrorCode,
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

async function validateRestorePayload(
  payload: SnapshotPayload,
  encodedKey: string | undefined,
): Promise<RestoreValidationDetails> {
  const rows = Object.fromEntries(snapshotTables.map((table) => [
    table,
    snapshotRows(payload, table),
  ])) as Record<(typeof snapshotTables)[number], ReadonlyArray<Record<string, unknown>>>;

  const administrators = uniqueIndex(rows.admin_members, ["id"]);
  uniqueIndex(rows.audit_events, ["id"]);
  const categories = uniqueIndex(rows.categories, ["id"]);
  uniqueIndex(rows.category_translations, ["category_id", "locale"]);
  const currencies = uniqueIndex(rows.currencies, ["code"]);
  uniqueIndex(rows.exchange_rates, ["id"]);
  uniqueIndex(rows.hero_translations, ["hero_id", "locale"]);
  const heroes = uniqueIndex(rows.heroes, ["id"]);
  uniqueIndex(rows.media_objects, ["key"]);
  uniqueIndex(rows.merchant_channels, ["id"]);
  uniqueIndex(rows.order_status_history, ["id"]);
  const orders = uniqueIndex(rows.orders, ["id"]);
  uniqueIndex(rows.product_translations, ["product_id", "locale"]);
  const products = uniqueIndex(rows.products, ["id"]);
  uniqueIndex(rows.site_settings, ["key"]);

  let relationshipChecks = 0;
  relationshipChecks += assertReferences(
    rows.category_translations,
    "category_id",
    categories,
  );
  relationshipChecks += assertReferences(rows.exchange_rates, "from_code", currencies);
  relationshipChecks += assertReferences(rows.exchange_rates, "to_code", currencies);
  relationshipChecks += assertReferences(rows.hero_translations, "hero_id", heroes);
  relationshipChecks += assertReferences(rows.products, "category_id", categories);
  relationshipChecks += assertReferences(
    rows.product_translations,
    "product_id",
    products,
  );
  relationshipChecks += assertReferences(rows.orders, "product_id", products);
  relationshipChecks += assertReferences(rows.orders, "currency_code", currencies);
  relationshipChecks += assertReferences(
    rows.orders,
    "reference_currency_code",
    currencies,
    true,
  );
  relationshipChecks += assertReferences(
    rows.orders,
    "assigned_to_id",
    administrators,
    true,
  );
  relationshipChecks += assertReferences(
    rows.order_status_history,
    "order_id",
    orders,
  );
  const orderHistory = new Set(rows.order_status_history.map(
    (row) => requiredString(row, "order_id"),
  ));
  for (const order of rows.orders) {
    if (!orderHistory.has(requiredString(order, "id"))) {
      throw restoreValidationError("BACKUP_RESTORE_RELATION_INVALID");
    }
    relationshipChecks += 1;
  }

  let jsonDocumentChecks = 0;
  for (const administrator of rows.admin_members) {
    requireJson(administrator, "permissions_json", "array");
    jsonDocumentChecks += 1;
  }
  for (const setting of rows.site_settings) {
    requireJson(setting, "value_json", "any");
    jsonDocumentChecks += 1;
  }
  for (const translation of rows.product_translations) {
    if (translation.aliases_json !== null && translation.aliases_json !== undefined) {
      requireJson(translation, "aliases_json", "array");
      jsonDocumentChecks += 1;
    }
  }

  let encryptedContactChecks = 0;
  if (rows.orders.length > 0) {
    const contactKey = await importBackupKey(encodedKey, ["decrypt"]);
    for (const order of rows.orders) {
      await validateEncryptedContact(
        requiredString(order, "contact_encrypted"),
        contactKey,
      );
      encryptedContactChecks += 1;
    }
  }

  return {
    kind: "LOGICAL_PACKAGE",
    tableCount: snapshotTables.length,
    recordCount: Object.values(rows).reduce((sum, tableRows) => sum + tableRows.length, 0),
    relationshipChecks,
    encryptedContactChecks,
    jsonDocumentChecks,
    activeAdministratorCount: rows.admin_members.filter(
      (administrator) => administrator.status === "ACTIVE",
    ).length,
  };
}

function snapshotRows(
  payload: SnapshotPayload,
  table: (typeof snapshotTables)[number],
): ReadonlyArray<Record<string, unknown>> {
  const rows = payload.tables[table];
  if (!Array.isArray(rows)) throw restoreValidationError("BACKUP_RESTORE_STRUCTURE_INVALID");
  return rows;
}

function uniqueIndex(
  rows: ReadonlyArray<Record<string, unknown>>,
  fields: readonly string[],
): Set<string> {
  const values = new Set<string>();
  for (const row of rows) {
    const key = JSON.stringify(fields.map((field) => requiredString(row, field)));
    if (values.has(key)) throw restoreValidationError("BACKUP_RESTORE_DUPLICATE_KEY");
    values.add(key);
  }
  if (fields.length !== 1) return values;
  return new Set(rows.map((row) => requiredString(row, fields[0])));
}

function assertReferences(
  rows: ReadonlyArray<Record<string, unknown>>,
  field: string,
  parentValues: ReadonlySet<string>,
  optional = false,
): number {
  let checked = 0;
  for (const row of rows) {
    const value = row[field];
    if (optional && (value === null || value === undefined || value === "")) continue;
    if (typeof value !== "string" || !value || !parentValues.has(value)) {
      throw restoreValidationError("BACKUP_RESTORE_RELATION_INVALID");
    }
    checked += 1;
  }
  return checked;
}

function requiredString(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string" || value.length === 0) {
    throw restoreValidationError("BACKUP_RESTORE_STRUCTURE_INVALID");
  }
  return value;
}

function requireJson(
  row: Record<string, unknown>,
  field: string,
  shape: "array" | "object" | "any",
): void {
  const value = requiredString(row, field);
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      (shape === "array" && !Array.isArray(parsed))
      || (
        shape === "object"
        && (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      )
    ) {
      throw new Error("invalid JSON shape");
    }
  } catch {
    throw restoreValidationError("BACKUP_RESTORE_JSON_INVALID");
  }
}

async function validateEncryptedContact(
  value: string,
  key: CryptoKey,
): Promise<void> {
  const [version, ivValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !encryptedValue) {
    throw restoreValidationError("BACKUP_RESTORE_CONTACT_INVALID");
  }
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64Url(ivValue) },
      key,
      decodeBase64Url(encryptedValue),
    );
    if (new TextDecoder().decode(decrypted).trim().length === 0) {
      throw new Error("empty contact");
    }
  } catch {
    throw restoreValidationError("BACKUP_RESTORE_CONTACT_INVALID");
  }
}

function restoreValidationError(code: string): ApiInputError {
  return new ApiInputError(
    code,
    "The backup restore package failed structural validation.",
    409,
  );
}

async function importRestoreDrillPublicKey(value: unknown): Promise<CryptoKey> {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
  ) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_PUBLIC_KEY_INVALID");
  }
  const jwk = value as JsonWebKey;
  if (
    jwk.kty !== "RSA"
    || typeof jwk.n !== "string"
    || typeof jwk.e !== "string"
    || decodeBase64Url(jwk.n).byteLength < 256
  ) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_PUBLIC_KEY_INVALID");
  }
  try {
    return await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );
  } catch {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_PUBLIC_KEY_INVALID");
  }
}

async function createRestoreDrillToken(
  payload: RestoreDrillTokenPayload,
  encodedKey: string | undefined,
): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const signature = await signHmac(payloadBytes, requireBackupKey(encodedKey));
  return `${encodeBase64Url(payloadBytes)}.${encodeBase64Url(new Uint8Array(signature))}`;
}

async function verifyRestoreDrillToken(
  token: string,
  encodedKey: string | undefined,
): Promise<RestoreDrillTokenPayload> {
  try {
    const [payloadValue, signatureValue, extra] = token.split(".");
    if (!payloadValue || !signatureValue || extra) {
      throw new Error("invalid token shape");
    }
    const payloadBytes = decodeBase64Url(payloadValue);
    const signature = decodeBase64Url(signatureValue);
    const key = await importHmacKey(requireBackupKey(encodedKey), ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, signature, payloadBytes);
    if (!valid) throw new Error("invalid token signature");
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as RestoreDrillTokenPayload;
    if (
      payload.format !== "cloudbridge-restore-drill-token"
      || payload.version !== 1
      || typeof payload.backupId !== "string"
      || typeof payload.drillId !== "string"
      || typeof payload.requestedByEmail !== "string"
      || typeof payload.challenge !== "string"
      || typeof payload.payloadSha256 !== "string"
      || !Number.isSafeInteger(payload.schemaVersion)
      || !Number.isSafeInteger(payload.tableCount)
      || !Number.isSafeInteger(payload.recordCount)
    ) {
      throw new Error("invalid token payload");
    }
    return payload;
  } catch (error) {
    if (
      error instanceof ApiInputError
      && error.code.startsWith("BACKUP_ENCRYPTION_")
    ) {
      throw error;
    }
    throw restoreValidationError("BACKUP_RESTORE_DRILL_TOKEN_INVALID");
  }
}

async function deriveRestoreDrillProofKey(
  encodedKey: string | undefined,
  drillId: string,
  challenge: string,
): Promise<ArrayBuffer> {
  return signHmac(
    new TextEncoder().encode(`restore-drill-proof:${drillId}:${challenge}`),
    requireBackupKey(encodedKey),
  );
}

async function signHmac(
  value: BufferSource,
  rawKey: BufferSource,
): Promise<ArrayBuffer> {
  const key = await importHmacKey(rawKey, ["sign"]);
  return crypto.subtle.sign("HMAC", key, value);
}

async function importHmacKey(
  rawKey: BufferSource,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    usages,
  );
}

async function verifyRestoreDrillProof(
  result: RestoreDrillResult,
  proof: string,
  proofKey: ArrayBuffer,
): Promise<boolean> {
  try {
    const key = await importHmacKey(proofKey, ["verify"]);
    return crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(proof),
      new TextEncoder().encode(restoreDrillProofMessage(result)),
    );
  } catch {
    return false;
  }
}

function restoreDrillProofMessage(result: RestoreDrillResult): string {
  return [
    result.drillId,
    result.payloadSha256,
    String(result.schemaVersion),
    String(result.tableCount),
    String(result.recordCount),
    String(result.readbackRecordCount),
    String(result.foreignKeyViolationCount),
    result.target,
    result.completedAt,
  ].join("\n");
}

function restoreDrillResult(value: unknown): RestoreDrillResult {
  if (
    typeof value !== "object"
    || value === null
    || Array.isArray(value)
  ) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_RESULT_INVALID");
  }
  const result = value as Partial<RestoreDrillResult>;
  if (
    typeof result.drillId !== "string"
    || typeof result.payloadSha256 !== "string"
    || !/^[a-f0-9]{64}$/u.test(result.payloadSha256)
    || !Number.isSafeInteger(result.schemaVersion)
    || !Number.isSafeInteger(result.tableCount)
    || !Number.isSafeInteger(result.recordCount)
    || !Number.isSafeInteger(result.readbackRecordCount)
    || !Number.isSafeInteger(result.foreignKeyViolationCount)
    || Number(result.tableCount) < 1
    || Number(result.recordCount) < 0
    || Number(result.readbackRecordCount) < 0
    || Number(result.foreignKeyViolationCount) < 0
    || result.target !== "NODE_SQLITE_MEMORY"
    || typeof result.completedAt !== "string"
    || !isValidDate(result.completedAt)
  ) {
    throw restoreValidationError("BACKUP_RESTORE_DRILL_RESULT_INVALID");
  }
  return result as RestoreDrillResult;
}

function isValidDate(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
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

function safeRestoreValidation(value: string): RestoreValidationDetails | null {
  try {
    const parsed = JSON.parse(value) as Partial<RestoreValidationDetails>;
    if (
      (parsed.kind !== "LOGICAL_PACKAGE" && parsed.kind !== "ISOLATED_SQLITE")
      || !Number.isSafeInteger(parsed.tableCount)
      || !Number.isSafeInteger(parsed.recordCount)
      || !Number.isSafeInteger(parsed.relationshipChecks)
      || !Number.isSafeInteger(parsed.encryptedContactChecks)
      || !Number.isSafeInteger(parsed.jsonDocumentChecks)
      || !Number.isSafeInteger(parsed.activeAdministratorCount)
    ) {
      return null;
    }
    if (
      parsed.kind === "ISOLATED_SQLITE"
      && (
        typeof parsed.drillId !== "string"
        || parsed.target !== "NODE_SQLITE_MEMORY"
        || typeof parsed.payloadSha256 !== "string"
        || !Number.isSafeInteger(parsed.readbackRecordCount)
        || parsed.foreignKeyViolationCount !== 0
        || typeof parsed.completedAt !== "string"
        || !isValidDate(parsed.completedAt)
      )
    ) {
      return null;
    }
    return parsed as RestoreValidationDetails;
  } catch {
    return null;
  }
}

function isRecent(
  value: string | null | undefined,
  now: Date,
  windowMs: number,
): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    && timestamp <= now.getTime()
    && timestamp >= now.getTime() - windowMs;
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
