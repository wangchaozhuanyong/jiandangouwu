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
    kind: "LOGICAL_PACKAGE";
    tableCount: number;
    recordCount: number;
    relationshipChecks: number;
    encryptedContactChecks: number;
    jsonDocumentChecks: number;
    activeAdministratorCount: number;
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
      | "RECENT_LOGICAL_RESTORE_VALIDATION";
    state: "PASS" | "FAIL";
    checkedAt: string | null;
  }>;
  externalAlerting: "NOT_CONNECTED";
};

export type SitesBackupsResponse = {
  items: SitesBackupSnapshot[];
  readiness: SitesBackupReadiness;
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

export const backupDownloadUrl = (id: string): string =>
  `/v1/admin/backups/${encodeURIComponent(id)}/download`;
