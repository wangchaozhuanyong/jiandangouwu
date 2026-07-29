import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ValidationPipe,
  type Type,
} from "@nestjs/common";

const dtoPath = "../dist/src/finance/manual-payment-events.dto.js";
const {
  AdminManualPaymentEventListQueryDto,
} = await import(dtoPath) as typeof import(
  "../src/finance/manual-payment-events.dto.js"
);

const validationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const validate = <T>(
  metatype: Type<T>,
  value: unknown,
): Promise<T> => validationPipe.transform(
  value,
  { type: "query", metatype },
) as Promise<T>;

test("manual payment event query trims and validates every server filter", async () => {
  const result = await validate(AdminManualPaymentEventListQueryDto, {
    page: "2",
    pageSize: "50",
    search: " history-1 ",
    eventType: " MANUALLY_RECORDED_REFUNDED ",
    currencyCode: " cny ",
    actorId: " admin-one ",
    assigneeId: " admin-two ",
  });

  assert.deepEqual({ ...result }, {
    page: 2,
    pageSize: 50,
    search: "history-1",
    eventType: "MANUALLY_RECORDED_REFUNDED",
    currencyCode: "CNY",
    actorId: "admin-one",
    assigneeId: "admin-two",
  });
});

test("manual payment event query rejects invalid enums and malformed filters", async () => {
  const invalidInputs = [
    { eventType: "PAID" },
    { currencyCode: "CNY;DROP" },
    { actorId: "admin/one" },
    { assigneeId: "admin/two" },
    { search: "   " },
    { page: "0" },
    { page: "1001" },
    { pageSize: "101" },
    { extra: "not-allowed" },
  ];

  for (const input of invalidInputs) {
    await assert.rejects(
      validate(AdminManualPaymentEventListQueryDto, input),
      BadRequestException,
    );
  }
});
