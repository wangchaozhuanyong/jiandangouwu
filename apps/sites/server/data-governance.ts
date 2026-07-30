import {
  privacyRequestStatuses,
  privacyRequestTypes,
  type AdminDataGovernanceOverview,
  type DataCleanupPreview,
  type DataKeyRotationStatus,
  type PrivacyRequestItem,
  type PrivacyRequestStatus,
  type PrivacyRequestType,
} from "@cloudbridge/contracts";
import { createPreRotationBackup, reencryptVerifiedBackupsForRotation } from "./backup-api";
import {
  decryptOrderContact,
  encryptOrderContact,
  hashOrderContact,
  sitesDataKeyId,
} from "./data-protection";
import { ApiInputError, writeAudit, type AdminIdentity } from "./http";
import type { D1Database, D1Result, SitesEnv } from "./types";

const retentionSettingKey = "data-governance.retention";
const retentionDefaults = {
  enabled: false as const,
  contactAnonymizeAfterDays: 180 as const,
  orderRetentionDays: 730 as const,
  auditRetentionDays: 365 as const,
  telegramRetentionDays: 90 as const,
  backupRetentionDays: 30 as const,
};

type RetentionRow = {
  valueJson: string;
  version: number;
  updatedAt: string;
};

type PrivacyRow = {
  id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  requesterReference: string;
  requesterLookupHash: string;
  resultJson: string | null;
  identityVerifiedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getDataGovernanceOverview(
  env: SitesEnv,
): Promise<AdminDataGovernanceOverview> {
  const retentionRow = await env.DB.prepare(
    "SELECT value_json AS valueJson, version, updated_at AS updatedAt FROM site_settings WHERE key = ? LIMIT 1",
  ).bind(retentionSettingKey).first<RetentionRow>();
  return {
    retention: {
      ...retentionDefaults,
      version: retentionRow?.version ?? 1,
      updatedAt: retentionRow?.updatedAt ?? new Date(0).toISOString(),
    },
    cleanupPreview: await getCleanupPreview(env.DB),
    privacyRequests: await listPrivacyRequests(env),
    keyRotation: await getDataKeyRotationStatus(env),
  };
}

export async function getCleanupPreview(
  db: D1Database,
  now = new Date(),
): Promise<DataCleanupPreview> {
  const contactsCutoff = cutoff(now, retentionDefaults.contactAnonymizeAfterDays);
  const ordersCutoff = cutoff(now, retentionDefaults.orderRetentionDays);
  const auditCutoff = cutoff(now, retentionDefaults.auditRetentionDays);
  const telegramCutoff = cutoff(now, retentionDefaults.telegramRetentionDays);
  const backupCutoff = cutoff(now, retentionDefaults.backupRetentionDays);
  const [contactsEligible, ordersEligible, auditEventsEligible, telegramDeliveriesEligible, backupsEligible] =
    await Promise.all([
      count(db, `SELECT COUNT(*) AS count FROM orders
        WHERE contact_erased_at IS NULL AND status IN ('COMPLETED','CANCELLED','REFUNDED')
          AND updated_at <= ?`, contactsCutoff),
      count(db, `SELECT COUNT(*) AS count FROM orders
        WHERE status IN ('COMPLETED','CANCELLED','REFUNDED') AND updated_at <= ?`, ordersCutoff),
      count(db, "SELECT COUNT(*) AS count FROM audit_events WHERE created_at <= ?", auditCutoff),
      count(db, "SELECT COUNT(*) AS count FROM telegram_deliveries WHERE created_at <= ?", telegramCutoff),
      count(db, "SELECT COUNT(*) AS count FROM backup_snapshots WHERE created_at <= ?", backupCutoff),
    ]);
  const oldest = await db.prepare(
    `SELECT MIN(value) AS oldest FROM (
      SELECT MIN(updated_at) AS value FROM orders
      UNION ALL SELECT MIN(created_at) FROM audit_events
      UNION ALL SELECT MIN(created_at) FROM telegram_deliveries
      UNION ALL SELECT MIN(created_at) FROM backup_snapshots
    )`,
  ).first<{ oldest: string | null }>();
  return {
    generatedAt: now.toISOString(),
    writesPerformed: false,
    contactsEligible,
    ordersEligible,
    auditEventsEligible,
    telegramDeliveriesEligible,
    backupsEligible,
    oldestEligibleAt: oldest?.oldest ?? null,
  };
}

export async function listPrivacyRequests(env: SitesEnv): Promise<PrivacyRequestItem[]> {
  const rows = await env.DB.prepare(
    `SELECT id, type, status, requester_reference AS requesterReference,
      requester_lookup_hash AS requesterLookupHash,
      result_json AS resultJson,
      identity_verified_at AS identityVerifiedAt, completed_at AS completedAt,
      created_at AS createdAt, updated_at AS updatedAt
     FROM privacy_requests ORDER BY created_at DESC, id DESC LIMIT 100`,
  ).all<PrivacyRow>();
  const items: PrivacyRequestItem[] = [];
  for (const row of rows.results ?? []) {
    let requesterReference = "••••";
    try {
      requesterReference = maskReference(await decryptOrderContact(
        row.requesterReference,
        env.CLOUDBRIDGE_DATA_KEY,
        "ORDER",
        env.CLOUDBRIDGE_DATA_KEY_NEXT,
      ));
    } catch {
      requesterReference = "不可读取 / Unavailable";
    }
    items.push({
      id: row.id,
      type: row.type,
      status: row.status,
      requesterReference,
      result: privacyResult(row.resultJson),
      identityVerifiedAt: row.identityVerifiedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
  return items;
}

export async function createPrivacyRequest(
  env: SitesEnv,
  input: { type: string; requesterReference: string; reason: string },
  actor: AdminIdentity,
): Promise<PrivacyRequestItem> {
  const type = input.type.toUpperCase();
  if (!privacyRequestTypes.includes(type as PrivacyRequestType)) {
    throw new ApiInputError("PRIVACY_REQUEST_TYPE_INVALID", "The privacy request type is invalid.", 422);
  }
  const reference = input.requesterReference.normalize("NFKC").trim();
  if (reference.length < 3 || reference.length > 240) {
    throw new ApiInputError("PRIVACY_REQUEST_REFERENCE_INVALID", "The requester reference is invalid.", 422);
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO privacy_requests
      (id, type, status, requester_reference, requester_lookup_hash, reason,
       identity_verified_at, completed_at, created_by_email, created_at, updated_at)
     VALUES (?, ?, 'RECEIVED', ?, ?, ?, NULL, NULL, ?, ?, ?)`,
  ).bind(
    id,
    type,
    await encryptOrderContact(
      reference,
      env.CLOUDBRIDGE_DATA_KEY,
      env.CLOUDBRIDGE_DATA_KEY_NEXT,
    ),
    await hashOrderContact(
      reference,
      env.CLOUDBRIDGE_DATA_KEY,
      env.CLOUDBRIDGE_DATA_KEY_NEXT,
    ),
    input.reason,
    actor.email,
    now,
    now,
  ).run();
  await writeAudit(env.DB, {
    action: "privacy.request.created",
    result: "SUCCEEDED",
    actor,
    targetType: "PRIVACY_REQUEST",
    targetId: id,
    reason: input.reason,
  });
  const item = (await listPrivacyRequests(env)).find((request) => request.id === id);
  if (!item) throw new ApiInputError("PRIVACY_REQUEST_NOT_FOUND", "The privacy request is unavailable.", 500);
  return item;
}

export async function updatePrivacyRequest(
  env: SitesEnv,
  id: string,
  input: { status: string; reason: string; confirmation?: string; correctedReference?: string },
  actor: AdminIdentity,
): Promise<PrivacyRequestItem> {
  const status = input.status.toUpperCase();
  if (!privacyRequestStatuses.includes(status as PrivacyRequestStatus)) {
    throw new ApiInputError("PRIVACY_REQUEST_STATUS_INVALID", "The privacy request status is invalid.", 422);
  }
  const row = await env.DB.prepare(
    `SELECT id, type, status, requester_reference AS requesterReference,
      requester_lookup_hash AS requesterLookupHash,
      result_json AS resultJson,
      identity_verified_at AS identityVerifiedAt, completed_at AS completedAt,
      created_at AS createdAt, updated_at AS updatedAt
     FROM privacy_requests WHERE id = ? LIMIT 1`,
  ).bind(id).first<PrivacyRow>();
  if (!row) throw new ApiInputError("PRIVACY_REQUEST_NOT_FOUND", "The privacy request was not found.", 404);
  if (status === "COMPLETED" && !row.identityVerifiedAt) {
    throw new ApiInputError("PRIVACY_IDENTITY_NOT_VERIFIED", "Verify the requester's identity before completion.", 409);
  }
  let result = privacyResult(row.resultJson);
  if (status === "COMPLETED") {
    if (row.type === "ACCESS") {
      if (input.confirmation !== "EXPORT VERIFIED DATA") {
        throw new ApiInputError("PRIVACY_ACCESS_CONFIRMATION_REQUIRED", "The access-export confirmation is invalid.", 422);
      }
      result = await buildAccessResult(env, row);
    } else if (row.type === "CORRECTION") {
      if (input.confirmation !== "CORRECT VERIFIED CONTACT") {
        throw new ApiInputError("PRIVACY_CORRECTION_CONFIRMATION_REQUIRED", "The correction confirmation is invalid.", 422);
      }
      result = await correctMatchingOrders(env, row, input.correctedReference);
    } else {
      if (input.confirmation !== "ANONYMIZE VERIFIED CONTACT") {
        throw new ApiInputError("PRIVACY_ERASURE_CONFIRMATION_REQUIRED", "The erasure confirmation is invalid.", 422);
      }
      result = {
        action: "ANONYMIZED",
        affectedOrders: await anonymizeMatchingOrders(env, row, id),
      };
    }
  }
  const now = new Date().toISOString();
  const identityVerifiedAt = status === "IDENTITY_VERIFIED"
    ? now
    : row.identityVerifiedAt;
  const completedAt = status === "COMPLETED" ? now : null;
  await env.DB.prepare(
    `UPDATE privacy_requests SET status = ?, reason = ?, result_json = ?,
      identity_verified_at = ?, completed_at = ?, updated_at = ?
     WHERE id = ?`,
  ).bind(
    status,
    input.reason,
    result ? JSON.stringify(result) : null,
    identityVerifiedAt,
    completedAt,
    now,
    id,
  ).run();
  await writeAudit(env.DB, {
    action: status === "COMPLETED"
      ? `privacy.request.${row.type.toLocaleLowerCase()}.completed`
      : "privacy.request.status.updated",
    result: "SUCCEEDED",
    actor,
    targetType: "PRIVACY_REQUEST",
    targetId: id,
    reason: input.reason,
  });
  const item = (await listPrivacyRequests(env)).find((request) => request.id === id);
  if (!item) throw new ApiInputError("PRIVACY_REQUEST_NOT_FOUND", "The privacy request is unavailable.", 500);
  return item;
}

export async function getDataKeyRotationStatus(
  env: SitesEnv,
): Promise<DataKeyRotationStatus> {
  const activeKeyId = env.CLOUDBRIDGE_DATA_KEY
    ? await sitesDataKeyId(env.CLOUDBRIDGE_DATA_KEY, "ORDER")
    : null;
  const nextKeyId = env.CLOUDBRIDGE_DATA_KEY_NEXT
    ? await sitesDataKeyId(env.CLOUDBRIDGE_DATA_KEY_NEXT, "ORDER")
    : null;
  const latest = await env.DB.prepare(
    `SELECT key_id AS keyId, status, error_code AS errorCode,
      completed_at AS completedAt FROM data_key_versions
     ORDER BY created_at DESC LIMIT 1`,
  ).first<{ keyId: string; status: string; errorCode: string | null; completedAt: string | null }>();
  const completedOnConfiguredKey = Boolean(
    latest?.status === "COMPLETED"
    && (latest.keyId === activeKeyId || latest.keyId === nextKeyId),
  );
  const contactsRemaining = nextKeyId
    ? await count(
        env.DB,
        `SELECT COUNT(*) AS count FROM orders
         WHERE contact_erased_at IS NULL AND contact_encrypted NOT LIKE ?`,
        `v3.${nextKeyId}.%`,
      )
    : 0;
  const backupsRemaining = nextKeyId && latest?.keyId === nextKeyId && latest.status === "COMPLETED"
    ? 0
    : nextKeyId
      ? await count(env.DB, "SELECT COUNT(*) AS count FROM backup_snapshots WHERE status = 'VERIFIED'")
      : 0;
  return {
    state: completedOnConfiguredKey
      ? "COMPLETED"
      : latest?.status === "RUNNING"
        ? "RUNNING"
        : latest?.status === "FAILED"
          ? "FAILED"
          : nextKeyId
            ? "READY"
            : "NEXT_KEY_MISSING",
    activeKeyId,
    nextKeyId,
    contactsRemaining,
    backupsRemaining,
    lastRotatedAt: latest?.completedAt ?? null,
    lastErrorCode: latest?.errorCode ?? null,
  };
}

export async function runDataKeyRotation(
  env: SitesEnv,
  actor: AdminIdentity,
  reason: string,
  confirmation: string,
): Promise<DataKeyRotationStatus> {
  if (confirmation !== "ROTATE DATA KEY") {
    throw new ApiInputError("DATA_KEY_ROTATION_CONFIRMATION_REQUIRED", "The key-rotation confirmation is invalid.", 422);
  }
  if (!env.CLOUDBRIDGE_DATA_KEY_NEXT) {
    throw new ApiInputError("DATA_KEY_NEXT_MISSING", "The next Sites data key is not configured.", 409);
  }
  const currentKeyId = await sitesDataKeyId(env.CLOUDBRIDGE_DATA_KEY, "ORDER");
  const nextKeyId = await sitesDataKeyId(env.CLOUDBRIDGE_DATA_KEY_NEXT, "ORDER");
  if (currentKeyId === nextKeyId) {
    throw new ApiInputError("DATA_KEY_UNCHANGED", "The next data key must differ from the active key.", 409);
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO data_key_versions
      (key_id, slot, status, contacts_migrated, backups_migrated,
       error_code, created_at, activated_at, completed_at)
     VALUES (?, 'NEXT', 'RUNNING', 0, 0, NULL, ?, ?, NULL)
     ON CONFLICT(key_id) DO UPDATE SET status = 'RUNNING', error_code = NULL,
       activated_at = excluded.activated_at, completed_at = NULL`,
  ).bind(nextKeyId, now, now).run();
  try {
    await createPreRotationBackup(
      env,
      actor,
      `Pre-rotation backup: ${reason}`,
    );
    const rows = await env.DB.prepare(
      `SELECT id, contact_encrypted AS contactEncrypted FROM orders
       WHERE contact_erased_at IS NULL ORDER BY created_at ASC, id ASC`,
    ).all<{ id: string; contactEncrypted: string }>();
    let contactsMigrated = 0;
    for (const row of rows.results ?? []) {
      if (row.contactEncrypted.startsWith(`v3.${nextKeyId}.`)) continue;
      const contact = await decryptOrderContact(
        row.contactEncrypted,
        env.CLOUDBRIDGE_DATA_KEY,
        "ORDER",
        env.CLOUDBRIDGE_DATA_KEY_NEXT,
      );
      const encrypted = await encryptOrderContact(
        contact,
        env.CLOUDBRIDGE_DATA_KEY,
        env.CLOUDBRIDGE_DATA_KEY_NEXT,
      );
      const lookupHash = await hashOrderContact(
        contact,
        env.CLOUDBRIDGE_DATA_KEY,
        env.CLOUDBRIDGE_DATA_KEY_NEXT,
      );
      const updated = await env.DB.prepare(
        `UPDATE orders SET contact_encrypted = ?, contact_hash = ?, updated_at = ?
         WHERE id = ? AND contact_encrypted = ?`,
      ).bind(encrypted, lookupHash, new Date().toISOString(), row.id, row.contactEncrypted).run();
      contactsMigrated += changes(updated);
    }
    const backupsMigrated = await reencryptVerifiedBackupsForRotation(env);
    const completedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE data_key_versions SET status = 'COMPLETED',
        contacts_migrated = ?, backups_migrated = ?, completed_at = ?,
        error_code = NULL WHERE key_id = ?`,
    ).bind(contactsMigrated, backupsMigrated, completedAt, nextKeyId).run();
    await writeAudit(env.DB, {
      action: "data-key.rotation.completed",
      result: "SUCCEEDED",
      actor,
      targetType: "DATA_KEY_VERSION",
      targetId: nextKeyId,
      reason,
    });
  } catch (error) {
    const errorCode = error instanceof ApiInputError ? error.code : "DATA_KEY_ROTATION_FAILED";
    await env.DB.prepare(
      `UPDATE data_key_versions SET status = 'FAILED', error_code = ?,
        completed_at = ? WHERE key_id = ?`,
    ).bind(errorCode, new Date().toISOString(), nextKeyId).run();
    await writeAudit(env.DB, {
      action: "data-key.rotation.completed",
      result: "FAILED",
      actor,
      targetType: "DATA_KEY_VERSION",
      targetId: nextKeyId,
      reason,
    });
    throw error;
  }
  return getDataKeyRotationStatus(env);
}

async function anonymizeMatchingOrders(
  env: SitesEnv,
  request: PrivacyRow,
  requestId: string,
): Promise<number> {
  const reference = await decryptOrderContact(
    request.requesterReference,
    env.CLOUDBRIDGE_DATA_KEY,
    "ORDER",
    env.CLOUDBRIDGE_DATA_KEY_NEXT,
  );
  const hmac = await hashOrderContact(
    reference,
    env.CLOUDBRIDGE_DATA_KEY,
    env.CLOUDBRIDGE_DATA_KEY_NEXT,
  );
  const legacyHash = await sha256(reference.normalize("NFKC").trim().toLocaleLowerCase());
  const now = new Date().toISOString();
  const updated = await env.DB.prepare(
    `UPDATE orders SET contact_encrypted = ?, contact_hash = ?,
      masked_contact = '已匿名 / Erased', contact_erased_at = ?,
      contact_erasure_request_id = ?, updated_at = ?
     WHERE contact_erased_at IS NULL AND contact_hash IN (?, ?)`,
  ).bind(
    `erased:${requestId}`,
    `erased:${crypto.randomUUID()}`,
    now,
    requestId,
    now,
    hmac,
    legacyHash,
  ).run();
  return changes(updated);
}

async function buildAccessResult(
  env: SitesEnv,
  request: PrivacyRow,
): Promise<NonNullable<PrivacyRequestItem["result"]>> {
  const [hmac, legacyHash] = await requestHashes(env, request);
  const rows = await env.DB.prepare(
    `SELECT order_number AS orderNumber, status, contact_channel AS contactChannel,
      masked_contact AS maskedContact, created_at AS createdAt
     FROM orders WHERE contact_erased_at IS NULL AND contact_hash IN (?, ?)
     ORDER BY created_at ASC, id ASC`,
  ).bind(hmac, legacyHash).all<{
    orderNumber: string;
    status: string;
    contactChannel: string;
    maskedContact: string;
    createdAt: string;
  }>();
  const exportedOrders = rows.results ?? [];
  return {
    action: "EXPORTED",
    affectedOrders: exportedOrders.length,
    exportedOrders,
  };
}

async function correctMatchingOrders(
  env: SitesEnv,
  request: PrivacyRow,
  correctedReference: string | undefined,
): Promise<NonNullable<PrivacyRequestItem["result"]>> {
  const nextReference = correctedReference?.normalize("NFKC").trim() ?? "";
  if (nextReference.length < 3 || nextReference.length > 240) {
    throw new ApiInputError("PRIVACY_CORRECTION_VALUE_INVALID", "The corrected contact value is invalid.", 422);
  }
  const [hmac, legacyHash] = await requestHashes(env, request);
  const updated = await env.DB.prepare(
    `UPDATE orders SET contact_encrypted = ?, contact_hash = ?, masked_contact = ?,
      updated_at = ? WHERE contact_erased_at IS NULL AND contact_hash IN (?, ?)`,
  ).bind(
    await encryptOrderContact(
      nextReference,
      env.CLOUDBRIDGE_DATA_KEY,
      env.CLOUDBRIDGE_DATA_KEY_NEXT,
    ),
    await hashOrderContact(
      nextReference,
      env.CLOUDBRIDGE_DATA_KEY,
      env.CLOUDBRIDGE_DATA_KEY_NEXT,
    ),
    maskReference(nextReference),
    new Date().toISOString(),
    hmac,
    legacyHash,
  ).run();
  return {
    action: "CORRECTED",
    affectedOrders: changes(updated),
  };
}

async function requestHashes(
  env: SitesEnv,
  request: PrivacyRow,
): Promise<[string, string]> {
  const reference = await decryptOrderContact(
    request.requesterReference,
    env.CLOUDBRIDGE_DATA_KEY,
    "ORDER",
    env.CLOUDBRIDGE_DATA_KEY_NEXT,
  );
  return [
    await hashOrderContact(
      reference,
      env.CLOUDBRIDGE_DATA_KEY,
      env.CLOUDBRIDGE_DATA_KEY_NEXT,
    ),
    await sha256(reference.normalize("NFKC").trim().toLocaleLowerCase()),
  ];
}

function privacyResult(value: string | null): PrivacyRequestItem["result"] {
  if (!value) return null;
  try {
    const result = JSON.parse(value) as PrivacyRequestItem["result"];
    if (
      !result
      || !["EXPORTED", "CORRECTED", "ANONYMIZED"].includes(result.action)
      || !Number.isSafeInteger(result.affectedOrders)
      || result.affectedOrders < 0
    ) return null;
    return result;
  } catch {
    return null;
  }
}

function maskReference(value: string): string {
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function cutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60_000).toISOString();
}

async function count(db: D1Database, sql: string, ...bindings: unknown[]): Promise<number> {
  return Number((await db.prepare(sql).bind(...bindings).first<{ count: number }>())?.count ?? 0);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function changes(result: D1Result): number {
  return Number(result.meta?.changes ?? result.meta?.rows_written ?? 0);
}
