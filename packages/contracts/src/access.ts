import type { LocalizedText } from "./common.js";

export type AdminAccountStatus = "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";

export type AdminAccessRoleSummary = {
  id: string;
  key: string;
  name: LocalizedText;
  description: string | null;
};

export type AdminTeamMember = {
  id: string;
  email: string;
  displayName: string;
  status: AdminAccountStatus;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: AdminAccessRoleSummary[];
};

export type AdminTeamOverview = {
  members: AdminTeamMember[];
  availableRoles: AdminAccessRoleSummary[];
};

export type AdminSessionSummary = {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type AdminSessionOverview = {
  source: "VALKEY";
  sessions: AdminSessionSummary[];
};

export type AdminPermissionSummary = {
  key: string;
  description: string | null;
};

export type AdminRoleDetail = AdminAccessRoleSummary & {
  permissions: string[];
  memberCount: number;
  updatedAt: string;
  systemProtected: boolean;
};

export type AdminRolesOverview = {
  roles: AdminRoleDetail[];
  permissions: AdminPermissionSummary[];
};
