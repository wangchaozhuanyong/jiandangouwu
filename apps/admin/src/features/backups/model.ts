export const backupResourceCodes = [
  "LOCAL_MYSQL_VOLUME",
  "LOCAL_VALKEY_VOLUME",
  "AWS_RDS_AUTOMATED_BACKUP",
  "AWS_VALKEY_SNAPSHOT",
] as const;
export type BackupResourceCode = (typeof backupResourceCodes)[number];

export const backupControlCodes = [
  "LOCAL_NAMED_VOLUMES",
  "VALKEY_APPEND_ONLY",
  "RDS_STORAGE_ENCRYPTION",
  "RDS_BACKUP_RETENTION",
  "RDS_DELETION_PROTECTION",
  "VALKEY_SNAPSHOT_RETENTION",
] as const;
export type BackupControlCode = (typeof backupControlCodes)[number];

export const backupGateCodes = [
  "LOCAL_AUTOMATED_BACKUP",
  "OFF_HOST_BACKUP_COPY",
  "AWS_DEPLOYMENT_EVIDENCE",
  "RUNTIME_BACKUP_INVENTORY",
  "BACKUP_FAILURE_ALERTING",
  "RECOVERY_RUNBOOK",
  "RPO_RTO_APPROVAL",
  "ISOLATED_RESTORE_DRILL",
] as const;
export type BackupGateCode = (typeof backupGateCodes)[number];

export type BackupResource = {
  code: BackupResourceCode;
  environment: "LOCAL_DEVELOPMENT" | "AWS_STAGING";
  dataScope: "MYSQL_DATABASE" | "VALKEY_SESSION_DATA";
  repositorySource:
    | "COMPOSE_NAMED_VOLUME"
    | "RDS_AUTOMATED_BACKUP"
    | "ELASTICACHE_SNAPSHOT";
  persistenceState: "DEFINED_LOCAL_CONFIG" | "DEFINED_INFRA";
  backupState: "NOT_A_BACKUP" | "NOT_DEPLOYED";
  retentionDefinition: "NOT_DEFINED" | "7_DAYS" | "7_SNAPSHOTS";
  restoreEvidence: "NOT_PERFORMED";
};

export const backupResources: ReadonlyArray<BackupResource> = [
  {
    code: "LOCAL_MYSQL_VOLUME",
    environment: "LOCAL_DEVELOPMENT",
    dataScope: "MYSQL_DATABASE",
    repositorySource: "COMPOSE_NAMED_VOLUME",
    persistenceState: "DEFINED_LOCAL_CONFIG",
    backupState: "NOT_A_BACKUP",
    retentionDefinition: "NOT_DEFINED",
    restoreEvidence: "NOT_PERFORMED",
  },
  {
    code: "LOCAL_VALKEY_VOLUME",
    environment: "LOCAL_DEVELOPMENT",
    dataScope: "VALKEY_SESSION_DATA",
    repositorySource: "COMPOSE_NAMED_VOLUME",
    persistenceState: "DEFINED_LOCAL_CONFIG",
    backupState: "NOT_A_BACKUP",
    retentionDefinition: "NOT_DEFINED",
    restoreEvidence: "NOT_PERFORMED",
  },
  {
    code: "AWS_RDS_AUTOMATED_BACKUP",
    environment: "AWS_STAGING",
    dataScope: "MYSQL_DATABASE",
    repositorySource: "RDS_AUTOMATED_BACKUP",
    persistenceState: "DEFINED_INFRA",
    backupState: "NOT_DEPLOYED",
    retentionDefinition: "7_DAYS",
    restoreEvidence: "NOT_PERFORMED",
  },
  {
    code: "AWS_VALKEY_SNAPSHOT",
    environment: "AWS_STAGING",
    dataScope: "VALKEY_SESSION_DATA",
    repositorySource: "ELASTICACHE_SNAPSHOT",
    persistenceState: "DEFINED_INFRA",
    backupState: "NOT_DEPLOYED",
    retentionDefinition: "7_SNAPSHOTS",
    restoreEvidence: "NOT_PERFORMED",
  },
];

export type BackupReadiness = {
  localVolumeDefinitionCount: 2;
  awsProtectionDefinitionCount: 2;
  localBackupJobCount: 0;
  restoreDrillCount: 0;
  controls: ReadonlyArray<{
    code: BackupControlCode;
    state: "DEFINED_LOCAL_CONFIG" | "DEFINED_INFRA";
  }>;
  gates: ReadonlyArray<{
    code: BackupGateCode;
    state: "NOT_DEPLOYED" | "NOT_IMPLEMENTED" | "NOT_DEFINED" | "NOT_PERFORMED";
  }>;
  resources: ReadonlyArray<BackupResource>;
};

export function buildBackupReadiness(): BackupReadiness {
  return {
    localVolumeDefinitionCount: 2,
    awsProtectionDefinitionCount: 2,
    localBackupJobCount: 0,
    restoreDrillCount: 0,
    controls: backupControlCodes.map((code) => ({
      code,
      state: code === "LOCAL_NAMED_VOLUMES" || code === "VALKEY_APPEND_ONLY"
        ? "DEFINED_LOCAL_CONFIG"
        : "DEFINED_INFRA",
    })),
    gates: [
      { code: "LOCAL_AUTOMATED_BACKUP", state: "NOT_IMPLEMENTED" },
      { code: "OFF_HOST_BACKUP_COPY", state: "NOT_DEFINED" },
      { code: "AWS_DEPLOYMENT_EVIDENCE", state: "NOT_DEPLOYED" },
      { code: "RUNTIME_BACKUP_INVENTORY", state: "NOT_IMPLEMENTED" },
      { code: "BACKUP_FAILURE_ALERTING", state: "NOT_IMPLEMENTED" },
      { code: "RECOVERY_RUNBOOK", state: "NOT_DEFINED" },
      { code: "RPO_RTO_APPROVAL", state: "NOT_DEFINED" },
      { code: "ISOLATED_RESTORE_DRILL", state: "NOT_PERFORMED" },
    ],
    resources: backupResources,
  };
}
