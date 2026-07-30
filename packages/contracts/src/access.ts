import type { LocalizedText } from "./common.js";

export type AdminAccountStatus = "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";

export const adminRoleKeys = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "CUSTOMER_SUPPORT",
  "READ_ONLY",
] as const;
export type AdminRoleKey = (typeof adminRoleKeys)[number];
export type AssignableAdminRoleKey = Exclude<AdminRoleKey, "SUPER_ADMIN">;

export type AdminAccessRoleSummary = {
  id: string;
  key: AdminRoleKey;
  name: LocalizedText;
  description: LocalizedText;
  assignable: boolean;
};

export type AdminTeamMember = {
  id: string;
  email: string;
  displayName: string;
  status: AdminAccountStatus;
  authProvider: "SITES";
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  roles: AdminAccessRoleSummary[];
};

export type AdminTeamOverview = {
  members: AdminTeamMember[];
  availableRoles: AdminAccessRoleSummary[];
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
  capabilities: LocalizedText[];
  restrictions: LocalizedText[];
};

export type AdminRolesOverview = {
  roles: AdminRoleDetail[];
  permissions: AdminPermissionSummary[];
};

export type CreateAdminMemberInput = {
  displayName: string;
  email: string;
  roleKey: AssignableAdminRoleKey;
  confirmationEmail: string;
  reason: string;
};

export type UpdateAdminMemberInput = {
  expectedUpdatedAt: string;
  roleKey?: AssignableAdminRoleKey;
  status?: "ACTIVE" | "DISABLED";
  confirmationEmail: string;
  reason: string;
};
