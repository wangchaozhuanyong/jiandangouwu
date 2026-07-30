import { request } from "../../api";

export type SitesBackupSnapshot = {
  id: string;
  mode: "AUTOMATIC" | "MANUAL";
  status: "CREATING" | "VERIFIED" | "FAILED";
  schemaVersion: number;
  recordCounts: Record<string, number>;
  recordCount: number;
  byteSize: number | null;
  checksumSha256: string | null;
  createdByEmail: string | null;
  reason: string;
  errorCode: string | null;
  createdAt: string;
  verifiedAt: string | null;
  downloadable: boolean;
  restoreValidationStatus: "NOT_RUN" | "PASSED" | "FAILED";
  restoreValidation: {
    kind: "LOGICAL_PACKAGE" | "ISOLATED_SQLITE";
    tableCount: number;
    recordCount: number;
    relationshipChecks: number;
    encryptedContactChecks: number;
    jsonDocumentChecks: number;
    activeAdministratorCount: number;
    drillId?: string;
    target?: "NODE_SQLITE_MEMORY";
    payloadSha256?: string;
    readbackRecordCount?: number;
    foreignKeyViolationCount?: number;
    completedAt?: string;
  } | null;
  restoreValidatedAt: string | null;
  restoreValidatedByEmail: string | null;
  restoreValidationReason: string | null;
  restoreValidationErrorCode: string | null;
};

export type SitesBackupReadiness = {
  state: "READY" | "ATTENTION" | "BLOCKED";
  checkedAt: string;
  latestVerifiedAt: string | null;
  latestAutomaticAt: string | null;
  latestRestoreValidatedAt: string | null;
  failedRecentCount: number;
  staleCreatingCount: number;
  gates: Array<{
    code:
      | "RECENT_VERIFIED_BACKUP"
      | "TODAY_AUTOMATIC_BACKUP"
      | "NO_RECENT_BACKUP_FAILURE"
      | "RECENT_ISOLATED_RESTORE_DRILL"
      | "EXTERNAL_ALERT_DELIVERY";
    state: "PASS" | "FAIL";
    checkedAt: string | null;
  }>;
  externalAlerting: {
    state: "MISSING_SECRETS" | "UNVERIFIED" | "DISABLED" | "CONNECTED";
    configuredChannels: number;
    lastDeliveryVerifiedAt: string | null;
  };
};

export type SitesBackupsResponse = {
  items: SitesBackupSnapshot[];
  readiness: SitesBackupReadiness;
};

export type SitesRestoreDrillTransfer = {
  format: "cloudbridge-restore-drill-transfer";
  version: 1;
  algorithm: "RSA-OAEP-SHA256+AES-256-GCM";
  createdAt: string;
  expiresAt: string;
  drillToken: string;
  iv: string;
  wrappedKey: string;
  ciphertext: string;
};

export type SitesRestoreDrillCompletion = {
  token: string;
  proof: string;
  result: {
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
};

export const getSitesBackups = async (
  signal?: AbortSignal,
): Promise<SitesBackupsResponse> => (
  await request<SitesBackupsResponse>("/admin/backups", { signal })
).data;

export const createSitesBackup = async (
  reason: string,
): Promise<SitesBackupSnapshot> => (
  await request<SitesBackupSnapshot>("/admin/backups", {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
).data;

export const verifySitesBackup = async (
  id: string,
  reason: string,
): Promise<SitesBackupSnapshot> => (
  await request<SitesBackupSnapshot>(`/admin/backups/${encodeURIComponent(id)}/verify`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
).data;

export const validateSitesBackupRestorePackage = async (
  id: string,
  reason: string,
): Promise<SitesBackupSnapshot> => (
  await request<SitesBackupSnapshot>(
    `/admin/backups/${encodeURIComponent(id)}/restore-validation`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  )
).data;

export const createSitesBackupRestoreDrillTransfer = async (
  id: string,
  reason: string,
  publicKey: JsonWebKey,
): Promise<SitesRestoreDrillTransfer> => (
  await request<SitesRestoreDrillTransfer>(
    `/admin/backups/${encodeURIComponent(id)}/restore-drill-transfer`,
    {
      method: "POST",
      body: JSON.stringify({ reason, publicKey }),
    },
  )
).data;

export const completeSitesBackupRestoreDrill = async (
  id: string,
  reason: string,
  completion: SitesRestoreDrillCompletion,
): Promise<SitesBackupSnapshot> => (
  await request<SitesBackupSnapshot>(
    `/admin/backups/${encodeURIComponent(id)}/restore-drill-complete`,
    {
      method: "POST",
      body: JSON.stringify({ ...completion, reason }),
    },
  )
).data;

export const backupDownloadUrl = (id: string): string =>
  `/v1/admin/backups/${encodeURIComponent(id)}/download`;
