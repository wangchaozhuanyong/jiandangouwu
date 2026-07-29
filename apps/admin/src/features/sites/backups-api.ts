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
};

export const getSitesBackups = async (
  signal?: AbortSignal,
): Promise<SitesBackupSnapshot[]> => (
  await request<SitesBackupSnapshot[]>("/admin/backups", { signal })
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

export const backupDownloadUrl = (id: string): string =>
  `/v1/admin/backups/${encodeURIComponent(id)}/download`;
