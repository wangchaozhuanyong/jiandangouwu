import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ValidationPipe,
  type Type,
} from "@nestjs/common";

const dtoPath = "../dist/src/access/access.dto.js";
const {
  CreateRoleDto,
  DeleteRoleDto,
  UpdateMemberLifecycleDto,
  UpdateMemberRolesDto,
  UpdateRoleMetadataDto,
  UpdateRolePermissionsDto,
} = await import(dtoPath) as typeof import("../src/access/access.dto.js");

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const validateBody = <T>(metatype: Type<T>, value: unknown): Promise<T> =>
  validationPipe.transform(value, { type: "body", metatype }) as Promise<T>;

test("access DTOs trim reasons and accept unique access keys", async () => {
  const member = await validateBody(UpdateMemberRolesDto, {
    roleIds: ["role-1", "role-2"],
    expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
    reason: "  职责调整，需要新的订单权限  ",
  });
  assert.equal(member.reason, "职责调整，需要新的订单权限");

  const role = await validateBody(UpdateRolePermissionsDto, {
    permissionKeys: ["orders.read", "orders.write"],
    expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
    reason: "  Support scope changed  ",
  });
  assert.equal(role.reason, "Support scope changed");

  const lifecycle = await validateBody(UpdateMemberLifecycleDto, {
    action: "RESET_TOTP",
    expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
    reason: "  成员遗失了原双重验证设备  ",
  });
  assert.equal(lifecycle.action, "RESET_TOTP");
  assert.equal(lifecycle.reason, "成员遗失了原双重验证设备");

  const createdRole = await validateBody(CreateRoleDto, {
    key: "  order_reviewer  ",
    nameZh: "  订单复核员  ",
    nameEn: "  Order reviewer  ",
    description: "  复核人工订单  ",
    permissionKeys: ["orders.read", "orders.write"],
    reason: "  新增订单复核职责角色  ",
  });
  assert.equal(createdRole.key, "ORDER_REVIEWER");
  assert.equal(createdRole.nameZh, "订单复核员");
  assert.equal(createdRole.description, "复核人工订单");

  const metadata = await validateBody(UpdateRoleMetadataDto, {
    nameZh: "  订单审核员  ",
    nameEn: "  Order auditor  ",
    description: "  只负责复核  ",
    expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
    reason: "  角色职责名称需要调整  ",
  });
  assert.equal(metadata.nameEn, "Order auditor");
  assert.equal(metadata.reason, "角色职责名称需要调整");

  const deletion = await validateBody(DeleteRoleDto, {
    expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
    reason: "  该空角色已经停止使用  ",
  });
  assert.equal(deletion.reason, "该空角色已经停止使用");
});

test("access DTOs reject empty, duplicate, stale-shape, and unexplained changes", async () => {
  const invalidBodies: Array<[Type<unknown>, unknown]> = [
    [UpdateMemberRolesDto, {
      roleIds: [],
      expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
      reason: "职责调整，需要新的订单权限",
    }],
    [UpdateMemberRolesDto, {
      roleIds: ["role-1", "role-1"],
      expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
      reason: "职责调整，需要新的订单权限",
    }],
    [UpdateRolePermissionsDto, {
      permissionKeys: ["orders.read"],
      expectedUpdatedAt: "yesterday",
      reason: "Support scope changed",
    }],
    [UpdateRolePermissionsDto, {
      permissionKeys: ["orders.read"],
      expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
      reason: "short",
    }],
    [UpdateMemberLifecycleDto, {
      action: "DELETE",
      expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
      reason: "账号安全操作原因完整",
    }],
    [UpdateMemberLifecycleDto, {
      action: "DISABLE",
      expectedUpdatedAt: "yesterday",
      reason: "账号安全操作原因完整",
    }],
    [CreateRoleDto, {
      key: "super-admin",
      nameZh: "管理员",
      nameEn: "Admin",
      description: "",
      permissionKeys: ["roles.manage"],
      reason: "新增业务角色用于权限管理",
    }],
    [CreateRoleDto, {
      key: "ORDER_REVIEWER",
      nameZh: "订单复核员",
      nameEn: "Order reviewer",
      description: "",
      permissionKeys: [],
      reason: "新增业务角色用于订单复核",
    }],
    [UpdateRoleMetadataDto, {
      nameZh: "员",
      nameEn: "R",
      description: "",
      expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
      reason: "角色职责名称需要调整",
    }],
    [DeleteRoleDto, {
      expectedUpdatedAt: "stale",
      reason: "该空角色已经停止使用",
    }],
  ];

  for (const [metatype, body] of invalidBodies) {
    await assert.rejects(validateBody(metatype, body), BadRequestException);
  }
});
