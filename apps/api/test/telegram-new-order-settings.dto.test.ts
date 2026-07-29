import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ValidationPipe,
  type Type,
} from "@nestjs/common";

const dtoPath =
  "../dist/src/notifications/telegram-new-order-settings.dto.js";
const {
  UpdateAdminTelegramNewOrderSettingsDto,
} = await import(dtoPath) as typeof import(
  "../src/notifications/telegram-new-order-settings.dto.js"
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
  { type: "body", metatype },
) as Promise<T>;

const validInput = () => ({
  version: 2,
  requestedEnabled: true,
  recipientGroupLabel: " 订单运营组 ",
  includedFields: [" ORDER_NUMBER ", " MASKED_CONTACT "],
  reason: " 配置新订单模拟消息字段 ",
});

const fakeBotToken = [
  "123456789",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi",
].join(":");

test("telegram settings DTO trims and accepts only the fixed configuration shape", async () => {
  const result = await validate(
    UpdateAdminTelegramNewOrderSettingsDto,
    validInput(),
  );
  assert.deepEqual({ ...result }, {
    version: 2,
    requestedEnabled: true,
    recipientGroupLabel: "订单运营组",
    includedFields: ["ORDER_NUMBER", "MASKED_CONTACT"],
    reason: "配置新订单模拟消息字段",
  });
});

test("telegram settings DTO rejects invalid fields, duplicates, and secret inputs", async () => {
  const invalidInputs = [
    { ...validInput(), includedFields: [] },
    {
      ...validInput(),
      includedFields: ["ORDER_NUMBER", "ORDER_NUMBER"],
    },
    { ...validInput(), includedFields: ["CONTACT_ENCRYPTED"] },
    { ...validInput(), recipientGroupLabel: "   " },
    { ...validInput(), recipientGroupLabel: "123456789" },
    { ...validInput(), recipientGroupLabel: "-100123456789" },
    {
      ...validInput(),
      recipientGroupLabel: fakeBotToken,
    },
    { ...validInput(), recipientGroupLabel: "订单\n运营组" },
    { ...validInput(), reason: "short" },
    { ...validInput(), reason: "配置原因\n包含控制字符" },
    {
      ...validInput(),
      reason: `配置原因 ${fakeBotToken}`,
    },
    { ...validInput(), reason: "配置原因包含群号 -100123456789" },
    { ...validInput(), version: -1 },
    { ...validInput(), version: 2_147_483_648 },
    { ...validInput(), botToken: "secret-token" },
    { ...validInput(), chatId: "-100123456" },
    { ...validInput(), customTemplate: "{{contact}}" },
    {
      ...validInput(),
      reason: `审计原因 x${fakeBotToken}`,
    },
    {
      ...validInput(),
      recipientGroupLabel: "接收组 1-100123456789",
    },
    {
      ...validInput(),
      reason: "审计原因包含\u202e双向控制符",
    },
  ];

  for (const input of invalidInputs) {
    await assert.rejects(
      validate(UpdateAdminTelegramNewOrderSettingsDto, input),
      BadRequestException,
    );
  }
});
