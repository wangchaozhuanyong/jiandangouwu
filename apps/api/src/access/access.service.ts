import type {
  AdminAccessRoleSummary,
  AdminRoleDetail,
  AdminRolesOverview,
  AdminTeamMember,
  AdminTeamOverview,
} from "@cloudbridge/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AuditService } from "../audit/audit.service.js";
import type { AdminActor } from "../common/admin-actor.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { UpdateMemberRolesDto, UpdateRolePermissionsDto } from "./access.dto.js";

const SYSTEM_ROLE_KEY = "SUPER_ADMIN";
const RECENT_AUTH_WINDOW_MS = 5 * 60_000;

type RoleSummaryRow = {
  id: string;
  key: string;
  nameZh: string;
  nameEn: string;
  description: string | null;
};

type MemberRow = {
  id: string;
  email: string;
  displayName: string;
  status: "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";
  totpEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: Array<{ role: RoleSummaryRow }>;
};

type RoleDetailRow = RoleSummaryRow & {
  updatedAt: Date;
  permissions: Array<{ permission: { key: string } }>;
  _count: { users: number };
};

const roleSummary = (role: RoleSummaryRow): AdminAccessRoleSummary => ({
  id: role.id,
  key: role.key,
  name: { zh: role.nameZh, en: role.nameEn },
  description: role.description,
});

const memberView = (member: MemberRow): AdminTeamMember => ({
  id: member.id,
  email: member.email,
  displayName: member.displayName,
  status: member.status,
  totpEnabled: member.totpEnabled,
  lastLoginAt: member.lastLoginAt?.toISOString() ?? null,
  createdAt: member.createdAt.toISOString(),
  updatedAt: member.updatedAt.toISOString(),
  roles: member.roles.map(({ role }) => roleSummary(role)),
});

const roleView = (role: RoleDetailRow): AdminRoleDetail => ({
  ...roleSummary(role),
  permissions: role.permissions.map(({ permission }) => permission.key).sort(),
  memberCount: role._count.users,
  updatedAt: role.updatedAt.toISOString(),
  systemProtected: role.key === SYSTEM_ROLE_KEY,
});

@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async members(): Promise<AdminTeamOverview> {
    const [members, roles] = await Promise.all([
      this.prisma.adminUser.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          totpEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          roles: {
            orderBy: { assignedAt: "asc" },
            select: {
              role: {
                select: {
                  id: true,
                  key: true,
                  nameZh: true,
                  nameEn: true,
                  description: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.role.findMany({
        orderBy: [{ key: "asc" }],
        select: {
          id: true,
          key: true,
          nameZh: true,
          nameEn: true,
          description: true,
        },
      }),
    ]);
    return {
      members: members.map((member) => memberView(member)),
      availableRoles: roles.map((role) => roleSummary(role)),
    };
  }

  async roles(): Promise<AdminRolesOverview> {
    const [roles, permissions] = await Promise.all([
      this.prisma.role.findMany({
        orderBy: [{ key: "asc" }],
        include: {
          permissions: {
            include: { permission: true },
          },
          _count: { select: { users: true } },
        },
      }),
      this.prisma.permission.findMany({
        orderBy: { key: "asc" },
        select: { key: true, description: true },
      }),
    ]);
    return {
      roles: roles.map((role) => roleView(role)),
      permissions,
    };
  }

  async updateMemberRoles(
    memberId: string,
    input: UpdateMemberRolesDto,
    actor: AdminActor,
  ): Promise<AdminTeamMember> {
    await this.requireRecentAuthentication(
      actor,
      "team.member.roles.update",
      "AdminUser",
      memberId,
      input.reason,
    );
    if (memberId === actor.userId) {
      await this.audit.record({
        actorId: actor.userId,
        action: "team.member.roles.update",
        targetType: "AdminUser",
        targetId: memberId,
        result: "DENIED",
        requestId: actor.requestId,
        reason: input.reason,
        ip: actor.ip,
      });
      throw new ForbiddenException("Administrators cannot change their own roles.");
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.adminUser.findUnique({
          where: { id: memberId },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });
        if (!current) throw new NotFoundException("Administrator not found.");

        const nextRoles = await transaction.role.findMany({
          where: { id: { in: input.roleIds } },
          select: {
            id: true,
            key: true,
            nameZh: true,
            nameEn: true,
            description: true,
          },
        });
        if (nextRoles.length !== input.roleIds.length) {
          throw new BadRequestException("One or more roles do not exist.");
        }

        const beforeRoleKeys = current.roles.map(({ role }) => role.key).sort();
        const afterRoleKeys = nextRoles.map((role) => role.key).sort();
        if (
          current.status === "ACTIVE"
          && beforeRoleKeys.includes(SYSTEM_ROLE_KEY)
          && !afterRoleKeys.includes(SYSTEM_ROLE_KEY)
        ) {
          const activeSuperAdmins = await transaction.adminUser.count({
            where: {
              status: "ACTIVE",
              roles: {
                some: {
                  role: { key: SYSTEM_ROLE_KEY },
                },
              },
            },
          });
          if (activeSuperAdmins <= 1) {
            throw new ConflictException("The last active super administrator must keep that role.");
          }
        }

        const nextUpdatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
        const changed = await transaction.adminUser.updateMany({
          where: {
            id: memberId,
            updatedAt: new Date(input.expectedUpdatedAt),
          },
          data: { updatedAt: nextUpdatedAt },
        });
        if (changed.count !== 1) {
          throw new ConflictException("Administrator access changed. Reload before saving.");
        }
        await transaction.adminUserRole.deleteMany({ where: { adminUserId: memberId } });
        await transaction.adminUserRole.createMany({
          data: input.roleIds.map((roleId) => ({ adminUserId: memberId, roleId })),
        });
        await this.audit.record({
          actorId: actor.userId,
          action: "team.member.roles.update",
          targetType: "AdminUser",
          targetId: memberId,
          result: "SUCCEEDED",
          requestId: actor.requestId,
          reason: input.reason,
          beforeData: { roles: beforeRoleKeys },
          afterData: { roles: afterRoleKeys },
          ip: actor.ip,
        }, transaction);
        const committed = await transaction.adminUser.findUniqueOrThrow({
          where: { id: memberId },
          select: {
            id: true,
            email: true,
            displayName: true,
            status: true,
            totpEnabled: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            roles: {
              orderBy: { assignedAt: "asc" },
              select: {
                role: {
                  select: {
                    id: true,
                    key: true,
                    nameZh: true,
                    nameEn: true,
                    description: true,
                  },
                },
              },
            },
          },
        });
        return memberView(committed);
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2034"
      ) {
        throw new ConflictException("Administrator access changed. Reload before saving.");
      }
      throw error;
    }
  }

  async updateRolePermissions(
    roleId: string,
    input: UpdateRolePermissionsDto,
    actor: AdminActor,
  ): Promise<AdminRoleDetail> {
    await this.requireRecentAuthentication(
      actor,
      "access.role.permissions.update",
      "Role",
      roleId,
      input.reason,
    );
    const candidate = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { key: true },
    });
    if (!candidate) throw new NotFoundException("Role not found.");
    if (candidate.key === SYSTEM_ROLE_KEY) {
      await this.audit.record({
        actorId: actor.userId,
        action: "access.role.permissions.update",
        targetType: "Role",
        targetId: roleId,
        result: "DENIED",
        requestId: actor.requestId,
        reason: input.reason,
        ip: actor.ip,
      });
      throw new ForbiddenException("The super administrator role is system protected.");
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.role.findUnique({
          where: { id: roleId },
          include: {
            permissions: { include: { permission: true } },
          },
        });
        if (!current) throw new NotFoundException("Role not found.");
        const permissions = await transaction.permission.findMany({
          where: { key: { in: input.permissionKeys } },
          select: { id: true, key: true },
        });
        if (permissions.length !== input.permissionKeys.length) {
          throw new BadRequestException("One or more permissions do not exist.");
        }

        const beforePermissionKeys = current.permissions
          .map(({ permission }) => permission.key)
          .sort();
        const afterPermissionKeys = permissions.map(({ key }) => key).sort();
        const nextUpdatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
        const changed = await transaction.role.updateMany({
          where: {
            id: roleId,
            updatedAt: new Date(input.expectedUpdatedAt),
          },
          data: { updatedAt: nextUpdatedAt },
        });
        if (changed.count !== 1) {
          throw new ConflictException("Role permissions changed. Reload before saving.");
        }
        await transaction.rolePermission.deleteMany({ where: { roleId } });
        await transaction.rolePermission.createMany({
          data: permissions.map(({ id: permissionId }) => ({ roleId, permissionId })),
        });
        await this.audit.record({
          actorId: actor.userId,
          action: "access.role.permissions.update",
          targetType: "Role",
          targetId: roleId,
          result: "SUCCEEDED",
          requestId: actor.requestId,
          reason: input.reason,
          beforeData: { permissions: beforePermissionKeys },
          afterData: { permissions: afterPermissionKeys },
          ip: actor.ip,
        }, transaction);
        const committed = await transaction.role.findUniqueOrThrow({
          where: { id: roleId },
          include: {
            permissions: { include: { permission: true } },
            _count: { select: { users: true } },
          },
        });
        return roleView(committed);
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === "P2034"
      ) {
        throw new ConflictException("Role permissions changed. Reload before saving.");
      }
      throw error;
    }
  }

  private async requireRecentAuthentication(
    actor: AdminActor,
    action: string,
    targetType: string,
    targetId: string,
    reason: string,
  ): Promise<void> {
    const now = Date.now();
    if (
      Number.isFinite(actor.reauthenticatedAt)
      && actor.reauthenticatedAt
      && actor.reauthenticatedAt <= now
      && now - actor.reauthenticatedAt <= RECENT_AUTH_WINDOW_MS
    ) return;
    await this.audit.record({
      actorId: actor.userId,
      action,
      targetType,
      targetId,
      result: "DENIED",
      requestId: actor.requestId,
      reason,
      ip: actor.ip,
    });
    throw new ForbiddenException("Recent reauthentication is required.");
  }
}
