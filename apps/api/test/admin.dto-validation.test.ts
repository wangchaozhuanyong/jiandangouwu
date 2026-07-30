import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ValidationPipe,
  type Type,
} from "@nestjs/common";

const dtoPath = "../dist/src/admin/admin.dto.js";
const {
  AdminAuditExportDto,
  AdminAuditQueryDto,
  AdminListQueryDto,
} = await import(dtoPath) as typeof import("../src/admin/admin.dto.js");

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const validateQuery = <T>(metatype: Type<T>, value: unknown): Promise<T> =>
  validationPipe.transform(value, { type: "query", metatype }) as Promise<T>;

test("product query trims valid search and accepts only known statuses", async () => {
  const query = await validateQuery(AdminListQueryDto, {
    page: "2",
    pageSize: "30",
    search: "  Codex  ",
    status: "INACTIVE",
  });

  assert.deepEqual({ ...query }, {
    page: 2,
    pageSize: 30,
    search: "Codex",
    status: "INACTIVE",
  });
});

test("product query rejects blank search, invalid status, and unsafe pagination", async () => {
  for (const input of [
    { search: "   " },
    { status: "DELETED" },
    { page: "0" },
    { page: "1001" },
    { pageSize: "101" },
  ]) {
    await assert.rejects(validateQuery(AdminListQueryDto, input), BadRequestException);
  }
});

test("audit query trims valid strings and converts pagination", async () => {
  const query = await validateQuery(AdminAuditQueryDto, {
    page: "2",
    pageSize: "50",
    search: "  operator@example.com  ",
    result: "SUCCEEDED",
    actor: "administrator",
    targetType: "  Product  ",
    timeRange: "7d",
    scope: "security",
    category: "authorization",
    severity: "high",
  });

  assert.deepEqual({ ...query }, {
    page: 2,
    pageSize: 50,
    search: "operator@example.com",
    result: "SUCCEEDED",
    actor: "administrator",
    targetType: "Product",
    timeRange: "7d",
    scope: "security",
    category: "authorization",
    severity: "high",
  });
});

test("audit query rejects blank strings, invalid enums, and unsafe pagination", async () => {
  const invalidInputs = [
    { search: "   " },
    { targetType: "   " },
    { result: "PENDING" },
    { actor: "customer" },
    { timeRange: "90d" },
    { scope: "operations" },
    { category: "network" },
    { severity: "critical" },
    { page: "0" },
    { page: "1001" },
    { pageSize: "101" },
  ];

  for (const input of invalidInputs) {
    await assert.rejects(validateQuery(AdminAuditQueryDto, input), BadRequestException);
  }
});

test("audit export requires safe filters, a business reason, and exact confirmation", async () => {
  const input = await validationPipe.transform({
    search: "  operator@example.com  ",
    result: "DENIED",
    actor: "administrator",
    targetType: "  Order  ",
    timeRange: "30d",
    reason: "  Approved security review  ",
    confirmation: "EXPORT_AUDIT_CSV",
  }, {
    type: "body",
    metatype: AdminAuditExportDto,
  });

  assert.deepEqual({ ...input }, {
    search: "operator@example.com",
    result: "DENIED",
    actor: "administrator",
    targetType: "Order",
    timeRange: "30d",
    reason: "Approved security review",
    confirmation: "EXPORT_AUDIT_CSV",
  });
});

test("audit export rejects short reasons, unknown confirmation, and extra fields", async () => {
  for (const input of [
    { reason: "short", confirmation: "EXPORT_AUDIT_CSV" },
    { reason: "Approved review", confirmation: "YES" },
    { reason: "Approved review", confirmation: "EXPORT_AUDIT_CSV", page: 1 },
  ]) {
    await assert.rejects(
      validationPipe.transform(input, {
        type: "body",
        metatype: AdminAuditExportDto,
      }),
      BadRequestException,
    );
  }
});
