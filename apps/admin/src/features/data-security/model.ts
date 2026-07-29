import type {
  AdminUser,
  AuditEvent,
} from "../../api";

export const dataSecurityControlCodes = [
  "CONTACT_PROTECTION",
  "CREDENTIAL_PROTECTION",
  "SERVER_SESSION",
  "DATABASE_RBAC",
  "AUDIT_RECORDING",
] as const;
export type DataSecurityControlCode = (typeof dataSecurityControlCodes)[number];

export const dataSecurityBoundaryCodes = [
  "PUBLIC_CATALOG",
  "ORDER_CONTACT",
  "ADMIN_IDENTITY",
  "AUDIT_EVIDENCE",
] as const;
export type DataSecurityBoundaryCode = (typeof dataSecurityBoundaryCodes)[number];

export const dataGovernanceGateCodes = [
  "CLASSIFICATION_POLICY",
  "RETENTION_SCHEDULE",
  "DELETION_AND_ANONYMIZATION",
  "PRIVACY_REQUESTS",
  "PRODUCTION_KEY_MANAGEMENT",
] as const;
export type DataGovernanceGateCode = (typeof dataGovernanceGateCodes)[number];

export type DataSecurityControl = {
  code: DataSecurityControlCode;
  state: "IMPLEMENTED_CODE";
};

export type DataSecurityBoundary = {
  code: DataSecurityBoundaryCode;
  access: "PUBLIC" | "INTERNAL" | "PERSONAL" | "RESTRICTED";
  retentionState: "NOT_DEFINED";
};

export type DataGovernanceGate = {
  code: DataGovernanceGateCode;
  state: "NOT_DEFINED" | "NOT_IMPLEMENTED" | "NOT_CONNECTED";
};

export type DataSecurityReadiness = {
  currentSession: {
    roleCount: number;
    roleKeys: ReadonlyArray<string>;
    permissionCount: number;
    totpEnabled: boolean;
    auditReadGranted: boolean;
  };
  auditEvidence: {
    state: "AVAILABLE" | "LOADING" | "RESTRICTED";
    loadedCount: number | null;
    deniedOrFailedCount: number | null;
    sensitiveAccessCount: number | null;
    latestRecordedAt: string | null;
    recentEvents: ReadonlyArray<AuditEvent>;
  };
  controls: ReadonlyArray<DataSecurityControl>;
  boundaries: ReadonlyArray<DataSecurityBoundary>;
  gates: ReadonlyArray<DataGovernanceGate>;
};

const auditTimestamp = (event: Pick<AuditEvent, "createdAt">): number => {
  const timestamp = Date.parse(event.createdAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
};

export function buildDataSecurityReadiness({
  auditEvents,
  canReadAudit,
  user,
}: {
  auditEvents: ReadonlyArray<AuditEvent> | null;
  canReadAudit: boolean;
  user: AdminUser;
}): DataSecurityReadiness {
  const visibleAuditEvents = canReadAudit ? auditEvents : null;
  const sortedEvents = visibleAuditEvents
    ? [...visibleAuditEvents].sort((left, right) => {
      const difference = auditTimestamp(right) - auditTimestamp(left);
      return difference || right.id.localeCompare(left.id);
    })
    : [];
  const auditState = !canReadAudit
    ? "RESTRICTED"
    : auditEvents
      ? "AVAILABLE"
      : "LOADING";

  return {
    currentSession: {
      roleCount: user.roles.length,
      roleKeys: user.roles.map((role) => role.key).sort(),
      permissionCount: user.permissions.length,
      totpEnabled: user.totpEnabled,
      auditReadGranted: canReadAudit,
    },
    auditEvidence: {
      state: auditState,
      loadedCount: visibleAuditEvents ? visibleAuditEvents.length : null,
      deniedOrFailedCount: visibleAuditEvents
        ? visibleAuditEvents.filter((event) => event.result !== "SUCCEEDED").length
        : null,
      sensitiveAccessCount: visibleAuditEvents
        ? visibleAuditEvents.filter((event) => event.action === "order.contact.reveal").length
        : null,
      latestRecordedAt: sortedEvents[0]?.createdAt ?? null,
      recentEvents: sortedEvents.slice(0, 6),
    },
    controls: dataSecurityControlCodes.map((code) => ({
      code,
      state: "IMPLEMENTED_CODE",
    })),
    boundaries: [
      { code: "PUBLIC_CATALOG", access: "PUBLIC", retentionState: "NOT_DEFINED" },
      { code: "ORDER_CONTACT", access: "PERSONAL", retentionState: "NOT_DEFINED" },
      { code: "ADMIN_IDENTITY", access: "RESTRICTED", retentionState: "NOT_DEFINED" },
      { code: "AUDIT_EVIDENCE", access: "INTERNAL", retentionState: "NOT_DEFINED" },
    ],
    gates: [
      { code: "CLASSIFICATION_POLICY", state: "NOT_DEFINED" },
      { code: "RETENTION_SCHEDULE", state: "NOT_DEFINED" },
      { code: "DELETION_AND_ANONYMIZATION", state: "NOT_IMPLEMENTED" },
      { code: "PRIVACY_REQUESTS", state: "NOT_IMPLEMENTED" },
      { code: "PRODUCTION_KEY_MANAGEMENT", state: "NOT_CONNECTED" },
    ],
  };
}
