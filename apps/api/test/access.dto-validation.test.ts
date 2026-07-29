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
  UpdateMemberLifecycleDto,
  UpdateMemberRolesDto,
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
  ];

  for (const [metatype, body] of invalidBodies) {
    await assert.rejects(validateBody(metatype, body), BadRequestException);
  }
});
