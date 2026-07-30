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

export type DataSecurityControl = {
  code: DataSecurityControlCode;
  state: "IMPLEMENTED_CODE";
};

export type DataSecurityBoundary = {
  code: DataSecurityBoundaryCode;
  access: "PUBLIC" | "INTERNAL" | "PERSONAL" | "RESTRICTED";
  retentionState: "DRAFT_DISABLED";
};

export type DataSecurityReadiness = {
  currentSession: {
    roleCount: number;
    roleKeys: ReadonlyArray<string>;
    permissionCount: number;
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
      { code: "PUBLIC_CATALOG", access: "PUBLIC", retentionState: "DRAFT_DISABLED" },
      { code: "ORDER_CONTACT", access: "PERSONAL", retentionState: "DRAFT_DISABLED" },
      { code: "ADMIN_IDENTITY", access: "RESTRICTED", retentionState: "DRAFT_DISABLED" },
      { code: "AUDIT_EVIDENCE", access: "INTERNAL", retentionState: "DRAFT_DISABLED" },
    ],
  };
}
