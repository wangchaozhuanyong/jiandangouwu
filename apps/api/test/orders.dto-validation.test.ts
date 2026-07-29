import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ValidationPipe,
  type Type,
} from "@nestjs/common";

const adminDtoPath = "../dist/src/orders/orders.admin.dto.js";
const publicDtoPath = "../dist/src/orders/orders.dto.js";
const {
  AdminOrderListQueryDto,
  AssignAdminOrderDto,
  RevealAdminOrderContactDto,
  UpdateAdminOrderStatusDto,
} = await import(adminDtoPath) as typeof import("../src/orders/orders.admin.dto.js");
const {
  CreateOrderDto,
} = await import(publicDtoPath) as typeof import("../src/orders/orders.dto.js");

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const validate = <T>(
  metatype: Type<T>,
  value: unknown,
  type: "body" | "query" = "body",
): Promise<T> => validationPipe.transform(value, { type, metatype }) as Promise<T>;

const statusInput = () => ({
  expectedStatus: " MANUAL_PENDING ",
  expectedUpdatedAt: " 2026-07-28T12:00:00.000Z ",
  status: " CONTACTED ",
  reason: " 客服已经确认联系方式 ",
});

const assignmentInput = () => ({
  assigneeId: " admin-two ",
  expectedAssigneeId: " admin-one ",
  expectedUpdatedAt: " 2026-07-28T12:00:00.000Z ",
  reason: " 转交给当班订单管理员 ",
});

const publicOrderInput = () => ({
  locale: " zh ",
  productId: " product-1 ",
  currency: " CNY ",
  contactChannel: " WHATSAPP ",
  contactValue: " +60128886618 ",
  acceptedPolicyVersion: " 2026-07-27 ",
  expectedPrice: {
    amount: " 119.16 ",
    currency: " CNY ",
  },
});

test("admin order DTOs trim valid query and mutation strings", async () => {
  const query = await validate(AdminOrderListQueryDto, {
    page: "2",
    pageSize: "50",
    search: " CB-260728 ",
    scope: " AFTER_SALES ",
    status: " CONTACTED ",
    assigneeId: " admin-one ",
    contactChannel: " WHATSAPP ",
  }, "query");
  assert.deepEqual({ ...query }, {
    page: 2,
    pageSize: 50,
    search: "CB-260728",
    scope: "AFTER_SALES",
    status: "CONTACTED",
    assigneeId: "admin-one",
    contactChannel: "WHATSAPP",
  });

  const status = await validate(UpdateAdminOrderStatusDto, statusInput());
  assert.equal(status.expectedStatus, "MANUAL_PENDING");
  assert.equal(status.expectedUpdatedAt, "2026-07-28T12:00:00.000Z");
  assert.equal(status.status, "CONTACTED");
  assert.equal(status.reason, "客服已经确认联系方式");

  const assignment = await validate(AssignAdminOrderDto, assignmentInput());
  assert.equal(assignment.assigneeId, "admin-two");
  assert.equal(assignment.expectedAssigneeId, "admin-one");
  assert.equal(assignment.expectedUpdatedAt, "2026-07-28T12:00:00.000Z");
  assert.equal(assignment.reason, "转交给当班订单管理员");

  const reveal = await validate(RevealAdminOrderContactDto, {
    reason: " 处理订单需要联系客户 ",
  });
  assert.equal(reveal.reason, "处理订单需要联系客户");
});

test("admin order DTOs reject invalid enums, timestamps, and whitespace reasons", async () => {
  const invalidInputs: Array<[Type<unknown>, unknown, "body" | "query"]> = [
    [AdminOrderListQueryDto, { scope: "PAYMENTS" }, "query"],
    [AdminOrderListQueryDto, { status: "UNKNOWN" }, "query"],
    [AdminOrderListQueryDto, { contactChannel: "SMS" }, "query"],
    [AdminOrderListQueryDto, { search: "   " }, "query"],
    [UpdateAdminOrderStatusDto, {
      ...statusInput(),
      expectedUpdatedAt: "not-an-iso-date",
    }, "body"],
    [UpdateAdminOrderStatusDto, {
      ...statusInput(),
      status: "UNKNOWN",
    }, "body"],
    [UpdateAdminOrderStatusDto, {
      ...statusInput(),
      reason: "        ",
    }, "body"],
    [AssignAdminOrderDto, {
      ...assignmentInput(),
      expectedUpdatedAt: "tomorrow",
    }, "body"],
    [AssignAdminOrderDto, {
      ...assignmentInput(),
      reason: "        ",
    }, "body"],
    [RevealAdminOrderContactDto, { reason: "        " }, "body"],
  ];
  for (const [metatype, value, type] of invalidInputs) {
    await assert.rejects(validate(metatype, value, type), BadRequestException);
  }
});

test("public order DTO requires nested expected price and rejects blank contact", async () => {
  const result = await validate(CreateOrderDto, publicOrderInput());
  assert.equal(result.locale, "zh");
  assert.equal(result.productId, "product-1");
  assert.equal(result.currency, "CNY");
  assert.equal(result.contactChannel, "WHATSAPP");
  assert.equal(result.contactValue, "+60128886618");
  assert.equal(result.acceptedPolicyVersion, "2026-07-27");
  assert.deepEqual({ ...result.expectedPrice }, {
    amount: "119.16",
    currency: "CNY",
  });

  const { expectedPrice: _expectedPrice, ...withoutExpectedPrice } = publicOrderInput();
  await assert.rejects(
    validate(CreateOrderDto, withoutExpectedPrice),
    BadRequestException,
  );
  await assert.rejects(
    validate(CreateOrderDto, {
      ...publicOrderInput(),
      contactValue: "        ",
    }),
    BadRequestException,
  );
});
